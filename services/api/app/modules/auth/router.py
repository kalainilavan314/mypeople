import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.request_info import client_ip
from app.core.security import nic_hash, passport_hash
from app.db.session import get_db
from app.modules.auth import service
from app.modules.auth.dependencies import SessionToken
from app.modules.auth.dependencies import CurrentMember
from app.modules.auth import security_alerts
from app.modules.auth.refresh import REFRESH_COOKIE
from app.modules.auth.schemas import (
    AlertAnswerIn,
    MfaCodeInput,
    MfaStatusOut,
    RefreshIn,
    SecurityAlertOut,
    SessionOut,
    SignInRequest,
    SignInResponse,
    TokensOut,
    TotpEnrolmentOut,
    TotpStartInput,
)
from app.modules.auth.device import describe
from app.modules.auth.session_cookie import clear_session_cookie, set_refresh_cookie, set_session_cookie
from app.modules.identity.recovery import service as recovery
from app.modules.identity.recovery.rules import MFA_LOCKED_MESSAGE, NEW_DEVICE_MESSAGE, SUSPICIOUS_SIGN_IN_MESSAGE
from app.modules.membership.repository import find_member_profile
from app.modules.membership.schemas import MemberProfile

router = APIRouter(prefix="/v1/auth", tags=["auth"])

Db = Annotated[Session, Depends(get_db)]


@router.post(
    "/sign-in",
    responses={401: {"description": "invalid_credentials"}, 429: {"description": "too_many_attempts"}},
)
async def sign_in(body: SignInRequest, request: Request, response: Response, db: Db) -> SignInResponse:
    """Sign in with the NIC, or the passport number and country, the account registered with, and
    the password (FR-AUTH-005). Sets the session cookie and returns the token."""
    settings: Settings = request.app.state.settings
    try:
        pepper = settings.nic_pepper.get_secret_value()
        identifier = (
            nic_hash(body.nic, pepper)
            if body.nic is not None
            else passport_hash(body.passport_number or "", body.passport_country or "", pepper)
        )
        signed_in = await service.sign_in(
            db,
            identifier=identifier,
            password=body.password,
            ip=client_ip(request),
            jwt_secret=settings.jwt_secret.get_secret_value(),
            device=describe(request.headers.get("user-agent"), request.headers.get("x-device-id")),
        )
    except service.TooManyAttempts as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too_many_attempts",
            headers={"Retry-After": str(error.retry_after)},
        ) from None
    except service.InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials") from None

    set_session_cookie(response, signed_in.token, settings)
    set_refresh_cookie(response, signed_in.refresh_token, settings)
    if signed_in.alert is not None:
        # FR-AUTH-018: a flagged sign-in is also sent to the confirmed number (the inbox notice is already saved).
        await run_in_threadpool(
            recovery.notify_member, db, request.app.state.sms, signed_in.member_id, SUSPICIOUS_SIGN_IN_MESSAGE
        )
    elif signed_in.new_device:
        # FR-AUTH-019: tell the member, on their confirmed number, about a new device.
        await run_in_threadpool(recovery.notify_member, db, request.app.state.sms, signed_in.member_id, NEW_DEVICE_MESSAGE)
    profile = await run_in_threadpool(find_member_profile, db, signed_in.member_id)
    if profile is None:
        # The member was deleted in the moment between the password check and here.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    return SignInResponse(
        token=signed_in.token, refresh_token=signed_in.refresh_token, member=MemberProfile.model_validate(dict(profile))
    )


@router.post(
    "/refresh",
    responses={401: {"description": "invalid_refresh_token, refresh_reused (the session is ended) or session_expired"}},
)
def refresh_session(body: RefreshIn, request: Request, response: Response, db: Db) -> TokensOut:
    """Renew a session's 15-minute token with its refresh token (FR-AUTH-025). Each refresh token
    works once and is replaced; presenting one a second time ends the session and alerts the member."""
    settings: Settings = request.app.state.settings
    presented = body.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not presented:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_refresh_token")
    try:
        renewed = service.renew(db, presented, settings.jwt_secret.get_secret_value())
    except service.RefreshRefused as error:
        if error.alert is not None:
            recovery.notify_member(db, request.app.state.sms, error.alert.member_id, SUSPICIOUS_SIGN_IN_MESSAGE)
        clear_session_cookie(response, settings)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error.code) from None
    set_session_cookie(response, renewed.token, settings)
    set_refresh_cookie(response, renewed.refresh_token, settings)
    return TokensOut(token=renewed.token, refresh_token=renewed.refresh_token)


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response, db: Db, token: SessionToken) -> None:
    """Sign out everywhere: every session token this member holds stops working."""
    settings: Settings = request.app.state.settings
    service.sign_out(db, token, settings.jwt_secret.get_secret_value())
    clear_session_cookie(response, settings)


# --- Sessions (FR-AUTH-020, 021) and the staff second factor (NFR-SEC-04) ----------------------------------


@router.get("/sessions")
def list_my_sessions(member: CurrentMember, db: Db) -> list[SessionOut]:
    """The member's signed-in devices: a coarse label and times, never a location (FR-AUTH-020).
    Sessions from the Express API are not listed; "sign out" ends those too."""
    return [
        SessionOut(
            id=s.id,
            device_label=s.device_label,
            created_at=s.created_at,
            last_seen_at=s.last_seen_at,
            current=s.id == member.session_id,
        )
        for s in service.my_sessions(db, member.id)
    ]


@router.post("/sessions/{session_id}/revoke", status_code=status.HTTP_204_NO_CONTENT, responses={404: {"description": "not_found"}})
def revoke_my_session(session_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    """End one session; its next request is refused (FR-AUTH-021, NFR-SEC-11)."""
    try:
        service.revoke_my_session(db, member, session_id)
    except service.SessionNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None


@router.post("/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
def revoke_my_other_sessions(member: CurrentMember, db: Db) -> None:
    """End every session except this one."""
    service.revoke_my_other_sessions(db, member)


# --- Security alerts (FR-AUTH-018, M50) -------------------------------------------------------------------


def _alert_out(alert: security_alerts.StoredAlert) -> SecurityAlertOut:
    return SecurityAlertOut(
        id=alert.id,
        kind=alert.kind,  # type: ignore[arg-type]
        signals=alert.signals,
        device_label=alert.device_label,
        created_at=alert.created_at,
        answered_at=alert.answered_at,
        answer=alert.answer,  # type: ignore[arg-type]
        session_active=alert.session_active,
    )


@router.get("/security-alerts")
def list_my_security_alerts(member: CurrentMember, db: Db) -> list[SecurityAlertOut]:
    """M50: flagged sign-ins and reused refresh tokens, newest first."""
    return [_alert_out(alert) for alert in security_alerts.my_alerts(db, member.id)]


@router.post(
    "/security-alerts/{alert_id}/answer",
    responses={404: {"description": "not_found"}, 409: {"description": "already_answered"}},
)
def answer_security_alert(
    alert_id: uuid.UUID, body: AlertAnswerIn, member: CurrentMember, request: Request, db: Db
) -> SecurityAlertOut:
    """It was me, or this wasn't me: the second ends the flagged session and every other one
    except the one in use. Then change the password (POST /v1/auth/password)."""
    try:
        answered = security_alerts.answer(db, member, alert_id, body.answer, client_ip(request))
    except security_alerts.AlertNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except security_alerts.AlertAnswered:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already_answered") from None
    return _alert_out(answered.alert)


@router.get("/mfa")
def read_my_mfa(member: CurrentMember, db: Db) -> MfaStatusOut:
    enrolled, enabled = service.mfa_status(db, member.id)
    return MfaStatusOut(enrolled=enrolled, enabled=enabled, session_verified=member.mfa_verified)


def _mfa_error(error: service.MfaRefused) -> HTTPException:
    if error.code in ("invalid_code", "too_many_attempts", "wrong_password"):
        return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error.code)
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


def _mfa_locked(error: service.MfaLocked, member_id: uuid.UUID, request: Request, db: Session) -> HTTPException:
    if error.started_now:
        # Someone with the password is guessing codes, or the staff member is: either way they should know.
        recovery.notify_member(db, request.app.state.sms, member_id, MFA_LOCKED_MESSAGE)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="mfa_locked", headers={"Retry-After": str(error.retry_after)}
    )


_MFA_CODE_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"description": "invalid_code, or too_many_attempts (five in this session: the session is ended)"},
    409: {"description": "not_enrolled, already_enabled or session_not_registered"},
    429: {"description": "mfa_locked: too many wrong codes on this authenticator; see Retry-After"},
}


@router.post("/mfa/totp", responses={401: {"description": "wrong_password"}, 409: {"description": "already_enabled"}, 429: {"description": "too_many_attempts"}})
def start_totp(body: TotpStartInput, member: CurrentMember, request: Request, db: Db) -> TotpEnrolmentOut:
    """Re-enter the account password before issuing a secret or QR for an authenticator app."""
    try:
        secret, uri = service.start_totp(
            db, member, request.app.state.settings.jwt_secret.get_secret_value(), body.current_password, client_ip(request)
        )
    except service.MfaRefused as error:
        raise _mfa_error(error) from None
    except service.TooManyAttempts as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_attempts",
            headers={"Retry-After": str(error.retry_after)},
        ) from None
    return TotpEnrolmentOut(secret=secret, otpauth_uri=uri)


@router.post("/mfa/totp/confirm", status_code=status.HTTP_204_NO_CONTENT, responses=_MFA_CODE_RESPONSES)
def confirm_totp(body: MfaCodeInput, member: CurrentMember, request: Request, db: Db) -> None:
    """The first code from the app enables it, and counts as the second factor for this session."""
    jwt_secret = request.app.state.settings.jwt_secret.get_secret_value()
    try:
        service.confirm_totp(db, member, body.code, jwt_secret, client_ip(request))
    except service.MfaRefused as error:
        raise _mfa_error(error) from None
    except service.MfaLocked as error:
        raise _mfa_locked(error, member.id, request, db) from None


@router.post("/mfa/verify", status_code=status.HTTP_204_NO_CONTENT, responses=_MFA_CODE_RESPONSES)
def verify_mfa(body: MfaCodeInput, member: CurrentMember, request: Request, db: Db) -> None:
    """Give the authenticator code for this session; staff endpoints need it (NFR-SEC-04).
    Wrong codes count against the authenticator in every session: five lock it, for longer each time."""
    jwt_secret = request.app.state.settings.jwt_secret.get_secret_value()
    try:
        service.verify_mfa(db, member, body.code, jwt_secret, client_ip(request))
    except service.MfaRefused as error:
        raise _mfa_error(error) from None
    except service.MfaLocked as error:
        raise _mfa_locked(error, member.id, request, db) from None
