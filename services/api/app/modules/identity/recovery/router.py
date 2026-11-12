import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.request_info import client_ip
from app.core.security import nic_hash, passport_hash
from app.db.session import get_db
from app.integrations.sms import DevelopmentSms, NoSms, SmsDeliveryFailed, SmsSender, SmsUnavailable
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.auth.session_cookie import clear_session_cookie
from app.modules.identity.recovery import reset_tokens, rules, service
from app.modules.identity.recovery.schemas import (
    AccountNumber,
    AssistedRecoveryInput,
    AssistedRecoveryReceipt,
    AssistedRequestOut,
    AssistedResolutionInput,
    CodeSentOut,
    PasswordChangeInput,
    PasswordResetInput,
    PhoneConfirmInput,
    PhoneInput,
    RecoveryCodeInput,
    RecoveryContactOut,
    ResetTokenOut,
)

router = APIRouter(tags=["recovery"])

Db = Annotated[Session, Depends(get_db)]
CanHandle = Annotated[Staff, Depends(require_permission(rules.HANDLE_ASSISTED))]

NOT_CONFIGURED = {
    502: {"description": "sms_failed: the SMS provider did not accept the message"},
    503: {"description": "sms_not_configured: no SMS provider is set up yet (INT-01)"},
}
LIMITED = {429: {"description": "too_many_requests, with Retry-After"}}


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _sms(request: Request) -> SmsSender:
    return request.app.state.sms


def _secret(request: Request) -> str:
    return _settings(request).jwt_secret.get_secret_value()


def _id_hash(body: AccountNumber, request: Request) -> str:
    pepper = _settings(request).nic_pepper.get_secret_value()
    if body.nic is not None:
        return nic_hash(body.nic, pepper)
    return passport_hash(body.passport_number or "", body.passport_country or "", pepper)


def _sent(request: Request, code: str | None) -> CodeSentOut:
    # Only the in-memory development outbox ever returns a code.
    return CodeSentOut(sent=True, dev_code=code if isinstance(_sms(request), DevelopmentSms) else None)


def _unavailable() -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sms_not_configured")


def _not_delivered() -> HTTPException:
    # The provider was asked and did not take the message; trying again later can work.
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="sms_failed")


def _too_many(error: service.TooManyRequests) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="too_many_requests",
        headers={"Retry-After": str(error.retry_after)},
    )


# --- The member's recovery number (FR-REG-028) ---------------------------------------------------------


@router.get("/v1/identity/me/phone")
def read_my_phone(member: CurrentMember, db: Db) -> RecoveryContactOut | None:
    """The confirmed recovery number, or null."""
    phone = service.my_phone(db, member.id)
    return RecoveryContactOut(phone=phone) if phone else None


@router.post(
    "/v1/identity/me/phone",
    status_code=status.HTTP_202_ACCEPTED,
    responses={**NOT_CONFIGURED, **LIMITED, 422: {"description": "invalid_phone"}},
)
def request_phone_confirmation(body: PhoneInput, member: CurrentMember, request: Request, db: Db) -> CodeSentOut:
    """Send a code to a new number. It becomes the recovery contact only once the code is entered.
    The answer is the same whether or not another account has the number; confirming says so."""
    try:
        code = service.request_phone_confirmation(db, _sms(request), member.id, body.phone, client_ip(request), _secret(request))
    except service.InvalidPhone:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="invalid_phone") from None
    except service.TooManyRequests as error:
        raise _too_many(error) from None
    except SmsDeliveryFailed:
        raise _not_delivered() from None
    except SmsUnavailable:
        raise _unavailable() from None
    return _sent(request, code)


@router.post(
    "/v1/identity/me/phone/confirm",
    responses={401: {"description": "invalid_code, too_many_attempts or wrong_password"}, 409: {"description": "phone_unavailable"}, **LIMITED},
)
def confirm_phone(body: PhoneConfirmInput, member: CurrentMember, request: Request, db: Db) -> RecoveryContactOut:
    """Enter the code; replacing a confirmed number also needs the current password."""
    try:
        phone = service.confirm_phone(
            db, _sms(request), member.id, body.phone, body.code, client_ip(request), _secret(request), body.current_password
        )
    except service.InvalidPhone:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="invalid_phone") from None
    except service.CodeRefused as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error.reason) from None
    except service.WrongPassword:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong_password") from None
    except service.TooManyRequests as error:
        raise _too_many(error) from None
    except service.PhoneUnavailable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="phone_unavailable") from None
    return RecoveryContactOut(phone=phone)


# --- Recovery (A16, FR-AUTH-014 to 016) ----------------------------------------------------------------


@router.post("/v1/auth/recovery/request", status_code=status.HTTP_202_ACCEPTED, responses=NOT_CONFIGURED)
def request_recovery(body: AccountNumber, request: Request, background: BackgroundTasks, db: Db) -> CodeSentOut:
    """Send a recovery code to the account's confirmed contact. The answer is the same whether or
    not the number is registered or has a contact (BR-023), and it goes before the SMS is sent, so
    its timing does not tell either."""
    if isinstance(_sms(request), NoSms):
        raise _unavailable()  # the same for every caller, so it reveals nothing about accounts
    pending = service.request_recovery(db, _id_hash(body, request), client_ip(request), _secret(request))
    if pending is not None:
        background.add_task(service.deliver, _sms(request), pending)
    return _sent(request, pending.code if pending else None)


@router.post("/v1/auth/recovery/verify", responses={401: {"description": "invalid_code or too_many_attempts"}})
def verify_recovery(body: RecoveryCodeInput, request: Request, db: Db) -> ResetTokenOut:
    """A correct code gives a reset token valid for 10 minutes (FR-AUTH-015)."""
    try:
        token = service.verify_recovery(db, _id_hash(body, request), body.code, _secret(request))
    except service.CodeRefused as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error.reason) from None
    return ResetTokenOut(reset_token=token, expires_in_seconds=int(reset_tokens.LIFETIME.total_seconds()))


@router.post(
    "/v1/auth/recovery/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"description": "invalid_reset_token"}, 422: {"description": '{"code": "password_refused", "problems": [...]}'}},
)
def reset_password(body: PasswordResetInput, request: Request, db: Db) -> None:
    """Set a new password. Every session of the account ends, and the contact is told (FR-AUTH-016)."""
    try:
        service.reset_password(db, _sms(request), body.reset_token, body.new_password, client_ip(request), _secret(request))
    except reset_tokens.InvalidResetToken:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_reset_token") from None
    except service.PasswordRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "password_refused", "problems": error.problems},
        ) from None


@router.post(
    "/v1/auth/password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        401: {"description": "wrong_password"},
        422: {"description": '{"code": "password_refused", "problems": [...]}, e.g. "same_password"'},
        429: {"description": "too_many_requests, with Retry-After"},
    },
)
def change_password(body: PasswordChangeInput, member: CurrentMember, request: Request, response: Response, db: Db) -> None:
    """P05: a new password, only with the current one (FR-PROF-014). Every session ends, this one too,
    so the app signs in again; the confirmed number is told."""
    try:
        service.change_password(
            db, _sms(request), member.id, body.current_password, body.new_password, client_ip(request)
        )
    except service.TooManyRequests as error:
        raise _too_many(error) from None
    except service.WrongPassword:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="wrong_password") from None
    except service.PasswordRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "password_refused", "problems": error.problems},
        ) from None
    clear_session_cookie(response, _settings(request))


@router.post("/v1/auth/recovery/assisted", status_code=status.HTTP_202_ACCEPTED, responses=LIMITED)
def request_assisted_recovery(body: AssistedRecoveryInput, request: Request, db: Db) -> AssistedRecoveryReceipt:
    """For someone who cannot use their recovery contact: a reference, and a request the support
    team handles (FR-AUTH-017). The answer is the same whether or not the number is registered."""
    form = service.AssistedForm(
        id_hash=_id_hash(body, request),
        contact_method=body.contact_method,
        contact_value=body.contact_value,
        message=body.message,
    )
    try:
        reference = service.request_assisted(db, form, client_ip(request))
    except service.TooManyRequests as error:
        raise _too_many(error) from None
    return AssistedRecoveryReceipt(reference=reference)


# --- The support queue -----------------------------------------------------------------------------


@router.get("/v1/identity/recovery-requests")
def list_recovery_requests(
    staff: CanHandle, db: Db, limit: Annotated[int, Query(ge=1, le=100)] = 50
) -> list[AssistedRequestOut]:
    """Open assisted-recovery requests in the caller's areas, oldest first."""
    requests = service.assisted_queue(db, staff, states=["open"], limit=limit)
    return [AssistedRequestOut.from_stored(r) for r in requests]


@router.post(
    "/v1/identity/recovery-requests/{request_id}/resolve",
    responses={
        403: {"description": "forbidden, own_record or outside_your_area"},
        404: {"description": "not_found"},
        409: {"description": "not_open, no_matching_account or phone_unavailable"},
    },
)
def resolve_recovery_request(
    request_id: uuid.UUID, body: AssistedResolutionInput, staff: CanHandle, request: Request, db: Db
) -> AssistedRequestOut:
    """After checking the person's identity, replace their recovery number (they then recover
    normally), or decline with a note."""
    try:
        resolved = service.resolve_assisted(
            db,
            _sms(request),
            staff,
            request_id,
            outcome=body.outcome,
            new_phone=body.new_phone,
            note=body.note,
            ip=client_ip(request),
        )
    except service.RequestNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ResolutionRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    except service.InvalidPhone:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="invalid_phone") from None
    except service.PhoneUnavailable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="phone_unavailable") from None
    return AssistedRequestOut.from_stored(resolved)
