import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.integrations.sms import DevelopmentSms, NoSms, SmsSender, SmsUnavailable
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.identity.recovery import service as recovery
from app.modules.identity.recovery.schemas import CodeSentOut
from app.modules.privacy import rules, service
from app.modules.privacy.schemas import PrivacyOutcomeIn, PrivacyRequestIn, PrivacyRequestOut, RegisterEntryOut

router = APIRouter(prefix="/v1/privacy", tags=["privacy"])

Db = Annotated[Session, Depends(get_db)]
CanHandle = Annotated[Staff, Depends(require_permission(rules.HANDLE))]


def _sms(request: Request) -> SmsSender:
    return request.app.state.sms


def _secret(request: Request) -> str:
    return request.app.state.settings.jwt_secret.get_secret_value()


def _notify(sms: SmsSender, phone: str, text: str) -> None:
    try:
        sms.send(phone, text)
    except SmsUnavailable:
        pass


@router.post(
    "/closure-code",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        409: {"description": "no_recovery_number"},
        429: {"description": "too_many_requests, with Retry-After"},
        503: {"description": "sms_not_configured"},
    },
)
def send_closure_code(member: CurrentMember, request: Request, db: Db) -> CodeSentOut:
    """P06: a one-time code to the confirmed number, to confirm closing the account (FR-PROF-018)."""
    if isinstance(_sms(request), NoSms):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sms_not_configured")
    try:
        code = service.send_closure_code(db, _sms(request), member.id, client_ip(request), _secret(request))
    except service.RequestRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    except recovery.TooManyRequests as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too_many_requests",
            headers={"Retry-After": str(error.retry_after)},
        ) from None
    except SmsUnavailable:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="sms_not_configured") from None
    return CodeSentOut(sent=True, dev_code=code if isinstance(_sms(request), DevelopmentSms) else None)


@router.post(
    "/requests",
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"description": "wrong_password, invalid_code or too_many_attempts (closure)"},
        409: {"description": "no_recovery_number"},
    },
)
def make_request(body: PrivacyRequestIn, member: CurrentMember, request: Request, db: Db) -> PrivacyRequestOut:
    """P06: a copy of one's personal data (FR-PROF-019) or closing the account (FR-PROF-018), each with
    a receipt and the date it is due. Asking again while one is open returns it."""
    ip = client_ip(request)
    try:
        if body.kind == "copy":
            made = service.request_copy(db, member.id, body.note, ip)
        else:
            made = service.request_closure(
                db, member.id, password=body.password or "", code=body.code or "", note=body.note, ip=ip,
                jwt_secret=_secret(request),
            )
    except service.RequestRefused as error:
        code = status.HTTP_409_CONFLICT if error.code == "no_recovery_number" else status.HTTP_401_UNAUTHORIZED
        raise HTTPException(status_code=code, detail=error.code) from None
    return PrivacyRequestOut.build(made)


@router.get("/requests/mine")
def list_my_requests(member: CurrentMember, db: Db) -> list[PrivacyRequestOut]:
    return [PrivacyRequestOut.build(made) for made in service.my_requests(db, member.id)]


@router.get("/requests")
def read_register(
    staff: CanHandle,
    db: Db,
    state: Annotated[list[Literal["open", "completed", "refused"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[RegisterEntryOut]:
    """The DPO register, soonest due first. Needs privacy.requests.handle."""
    states = list(state) if state else ["open"]
    return [RegisterEntryOut.entry(made) for made in service.register(db, states, limit)]


@router.post(
    "/requests/{request_id}/decision",
    responses={403: {"description": "own_record"}, 404: {"description": "not_found"}, 409: {"description": "already_closed"}},
)
def close_request(
    request_id: uuid.UUID,
    body: PrivacyOutcomeIn,
    staff: CanHandle,
    request: Request,
    background: BackgroundTasks,
    db: Db,
) -> RegisterEntryOut:
    """Complete or refuse with a note. Completing a closure closes the account in both APIs; the
    member is told by SMS when a number is confirmed."""
    try:
        closed, phone = service.close(db, staff, request_id, body.outcome, body.note, client_ip(request))
    except service.RequestNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.RequestRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    if phone is not None:
        background.add_task(_notify, _sms(request), phone, service.outcome_message(closed))
    return RegisterEntryOut.entry(closed)
