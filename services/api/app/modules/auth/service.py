"""Sign-in, sign-out and session checks, with the same rules as the Express API, plus this
API's session registry (FR-AUTH-020, 021, 025) and the staff second factor (NFR-SEC-04).

Tokens from this API name a session row: it can be ended on its own, it
expires after 30 days without use, and it records whether the staff second
factor was given. Tokens from the Express API name no session; they still
work for member endpoints, end only with "sign out everywhere", and never
count as having given the second factor.

This API's tokens last 15 minutes and are renewed with a refresh token that
changes on every use (FR-AUTH-025); an already-used one ends the session and
alerts the member. Each sign-in is checked against the risk rules (risk.py,
NFR-SEC-12) and a flagged one raises a security alert (FR-AUTH-018).
"""

import time
import uuid
from dataclasses import dataclass
from functools import cache
from typing import Literal, NoReturn

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.security import (
    ACCESS_LIFETIME,
    ExpiredSessionToken,
    InvalidSessionToken,
    hash_password,
    read_session_token,
    sign_session_token,
    verify_password,
)
from app.core.sealing import UnsealError, derived_key, seal, unseal
from app.modules.audit import service as audit
from app.modules.auth import mfa_lockout, refresh, repository, risk, security_alerts, throttle, totp
from app.modules.auth.device import Device
from app.modules.auth.repository import (
    SessionMember,
    SignInMember,
    StoredAlert,
    StoredSession,
    clear_failures,
    count_recent_failures,
    find_session_member,
    find_sign_in_member,
    record_attempt,
    revoke_sessions,
)

IDLE_LIMIT = "30 days"  # FR-AUTH-025 [ASSUMPTION in the BRD]
TOUCH_INTERVAL = "5 minutes"  # how often a session's last use is written, to spare the database
MAX_MFA_FAILURES = 5  # wrong codes in one session before it is ended; the authenticator's own limit is in mfa_lockout


class NotAuthenticated(Exception):
    """No valid session. The reason is the error code the client receives."""

    def __init__(self, reason: Literal["unauthorized", "session_expired", "token_expired"]) -> None:
        super().__init__(reason)
        self.reason = reason


class TooManyAttempts(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"retry after {retry_after}s")
        self.retry_after = retry_after


class InvalidCredentials(Exception):
    """Unknown NIC or wrong password. Deliberately one error for both."""


@dataclass(frozen=True)
class SignedIn:
    member_id: uuid.UUID
    token: str
    refresh_token: str
    new_device: bool  # a sign-in from a device this member has not used before (FR-AUTH-019)
    alert: StoredAlert | None = None  # the risk rules flagged it (FR-AUTH-018)


class RefreshRefused(Exception):
    """invalid_refresh_token, refresh_reused or session_expired; alert is set for a reuse."""

    def __init__(self, code: str, alert: StoredAlert | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.alert = alert


class MfaRefused(Exception):
    """invalid_code, too_many_attempts, not_enrolled, already_enabled or session_not_registered."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class MfaLocked(Exception):
    """Too many wrong codes on this authenticator; no code is checked for retry_after seconds."""

    def __init__(self, retry_after: int, *, started_now: bool) -> None:
        super().__init__(f"retry after {retry_after}s")
        self.retry_after = retry_after
        self.started_now = started_now  # this request started the lockout: tell the member


class SessionNotFound(Exception):
    pass


def authenticate(db: Session, token: str | None, jwt_secret: str) -> SessionMember:
    """Return the member a session token belongs to (requireMember in Express)."""
    if not token:
        raise NotAuthenticated("unauthorized")

    try:
        claims = read_session_token(token, jwt_secret)
    except ExpiredSessionToken:
        raise NotAuthenticated("token_expired") from None  # renew it with the refresh token
    except InvalidSessionToken:
        raise NotAuthenticated("unauthorized") from None

    member = find_session_member(db, claims.member_id)
    if member is None:
        raise NotAuthenticated("unauthorized")

    # Signing out (or a password change) increments the member's
    # session_version. A token signed before that has a valid signature but an
    # older version, and must no longer work.
    if claims.session_version != member.session_version:
        raise NotAuthenticated("session_expired")

    if claims.session_id is None:
        return member  # an Express token: no session row, no second factor
    session = repository.find_session(db, claims.session_id, IDLE_LIMIT, TOUCH_INTERVAL)
    if session is None or session.member_id != member.id or session.revoked:
        raise NotAuthenticated("session_expired")  # ended on this or another device (NFR-SEC-11)
    if session.idle:
        repository.revoke_session(db, session.id, "idle")
        db.commit()
        raise NotAuthenticated("session_expired")
    if session.stale:
        repository.touch_session(db, session.id)
        db.commit()
    return SessionMember(
        id=member.id, session_version=member.session_version, session_id=session.id, mfa_verified=session.mfa_verified
    )


def start_session(
    db: Session,
    member_id: uuid.UUID,
    session_version: int,
    device: Device,
    jwt_secret: str,
    *,
    recent_failures: int = 0,
) -> SignedIn:
    """Record a session for a sign-in or a new account, check it against the risk rules,
    and sign its token and first refresh token."""
    recent_sign_ins = repository.count_recent_sessions(db, member_id, risk.VELOCITY_WINDOW)
    session_id, new_device = repository.start_session(db, member_id, device.label, device.key)
    refresh_token, refresh_hash = refresh.new_refresh_token(session_id)
    repository.rotate_refresh_hash(db, session_id, refresh_hash, None)
    signals = risk.signals(new_device=new_device, recent_failures=recent_failures, recent_sign_ins=recent_sign_ins)
    alert = (
        security_alerts.raise_alert(db, member_id, session_id, "suspicious_sign_in", signals, device.label)
        if signals
        else None
    )
    db.commit()
    token = sign_session_token(member_id, session_version, jwt_secret, session_id=session_id, lifetime=ACCESS_LIFETIME)
    return SignedIn(member_id=member_id, token=token, refresh_token=refresh_token, new_device=new_device, alert=alert)


@dataclass(frozen=True)
class Refreshed:
    member_id: uuid.UUID
    token: str
    refresh_token: str


def renew(db: Session, presented: str, jwt_secret: str) -> Refreshed:
    """A new token and refresh token for a session (FR-AUTH-025). The presented refresh token
    stops working. One that was already used means a copy exists: the session ends for every
    copy and the member is alerted."""
    parsed = refresh.parse(presented)
    if parsed is None:
        raise RefreshRefused("invalid_refresh_token")
    session_id, secret = parsed
    session = repository.lock_session_for_refresh(db, session_id, IDLE_LIMIT)
    if session is None:
        raise RefreshRefused("invalid_refresh_token")
    secret_hash = refresh.hash_secret(secret)
    # The secret is checked before anything about the session is revealed, so a guessed one
    # learns nothing, not even whether the session has ended.
    current = refresh.matches(secret_hash, session.refresh_hash)
    reused = refresh.matches(secret_hash, session.previous_refresh_hash)
    if not current and not reused:
        db.commit()
        raise RefreshRefused("invalid_refresh_token")
    if session.revoked:
        db.commit()
        raise RefreshRefused("session_expired")
    if reused:
        repository.revoke_session(db, session.id, "refresh_reuse")
        alert = security_alerts.raise_alert(
            db, session.member_id, session.id, "refresh_reuse", ["refresh_token_reused"], session.device_label
        )
        db.commit()
        raise RefreshRefused("refresh_reused", alert)
    if session.idle:
        repository.revoke_session(db, session.id, "idle")
        db.commit()
        raise RefreshRefused("session_expired")
    member = find_session_member(db, session.member_id)
    if member is None:
        db.commit()
        raise RefreshRefused("invalid_refresh_token")
    new_token, new_hash = refresh.new_refresh_token(session.id)
    repository.rotate_refresh_hash(db, session.id, new_hash, session.refresh_hash)
    db.commit()
    token = sign_session_token(member.id, member.session_version, jwt_secret, session_id=session.id, lifetime=ACCESS_LIFETIME)
    return Refreshed(member_id=member.id, token=token, refresh_token=new_token)


async def sign_in(db: Session, identifier: str, password: str, ip: str, jwt_secret: str, device: Device) -> SignedIn:
    """Check an ID-number hash and password under the sign-in throttle and issue a session token.

    identifier is the account's ID-number hash: nic_hash for a NIC, passport_hash
    for a passport, so each signs in only with the number it registered with.

    Async because of the throttle's delay: waiting up to two seconds must not
    hold one of the worker threads every other endpoint needs. Database work
    and bcrypt still run on worker threads, between the waits.
    """
    # The throttle is keyed on the hash, so no ID number is ever stored, and
    # failures are recorded for numbers nobody has registered too: probing for
    # registered numbers looks the same as guessing a password.
    gate = await run_in_threadpool(_check_throttle, db, identifier, ip)
    if not gate.allowed:
        raise TooManyAttempts(gate.retry_after or throttle.LOCKOUT_SECONDS)
    await throttle.wait(gate.delay_seconds)

    member, recent_failures = await run_in_threadpool(_check_password, db, identifier, ip, password)
    return await run_in_threadpool(
        lambda: start_session(db, member.id, member.session_version, device, jwt_secret, recent_failures=recent_failures)
    )


def sign_out(db: Session, token: str | None, jwt_secret: str) -> None:
    """Revoke every session of the token's member, on this and other devices.

    Clearing the cookie alone would leave a copied token valid for the rest of
    its 30 days, which is not what signing out of a shared phone should mean.
    Only a token that still works may do it: an old or ended one, a copy left
    on that shared phone say, must not keep signing the member out everywhere
    (review finding, 25 October 2026). The cookie is cleared either way.
    """
    try:
        member = authenticate(db, token, jwt_secret)
    except NotAuthenticated:
        return
    revoke_sessions(db, member.id)
    repository.revoke_member_sessions(db, member.id, "member")
    db.commit()


# --- Sessions (FR-AUTH-020, 021) ---------------------------------------------------------------------


def my_sessions(db: Session, member_id: uuid.UUID) -> list[StoredSession]:
    return repository.active_sessions(db, member_id, IDLE_LIMIT)


def revoke_my_session(db: Session, member: SessionMember, session_id: uuid.UUID) -> None:
    """End one of the member's sessions; its next request is refused."""
    session = repository.find_session(db, session_id, IDLE_LIMIT, TOUCH_INTERVAL)
    if session is None or session.member_id != member.id:
        raise SessionNotFound()
    repository.revoke_session(db, session_id, "member")
    db.commit()


def revoke_my_other_sessions(db: Session, member: SessionMember) -> None:
    """End every session except this one. Express tokens end only with sign-out everywhere."""
    repository.revoke_member_sessions(db, member.id, "member", keep=member.session_id)
    db.commit()


# --- The staff second factor: an authenticator app (NFR-SEC-04, FR-STF-001) ------------------------------


def _factor_key(jwt_secret: str) -> bytes:
    # Derived from JWT_SECRET for this purpose alone. Changing JWT_SECRET signs
    # everyone out; it also means staff enrol their authenticator again.
    return derived_key(jwt_secret, b"my-people mfa secret v1")


def mfa_status(db: Session, member_id: uuid.UUID) -> tuple[bool, bool]:
    """(an authenticator is enrolling or enrolled, it is enabled)."""
    factor = repository.find_factor(db, member_id)
    return factor is not None, bool(factor and factor.enabled)


def start_totp(db: Session, member: SessionMember, jwt_secret: str) -> tuple[str, str]:
    """A new secret to add to an authenticator app; enabled once the first code is confirmed."""
    factor = repository.find_factor(db, member.id)
    if factor is not None and factor.enabled:
        raise MfaRefused("already_enabled")
    secret = totp.new_secret()
    repository.save_pending_factor(db, member.id, seal(_factor_key(jwt_secret), member.id.bytes, secret))
    db.commit()
    label = repository.member_code(db, member.id)
    return totp.secret_text(secret), totp.provisioning_uri(secret, label)


def _check_code(db: Session, member: SessionMember, code: str, jwt_secret: str, *, enabled: bool, ip: str) -> None:
    factor = repository.find_factor(db, member.id, for_update=True)
    if factor is None or factor.enabled != enabled:
        db.commit()
        raise MfaRefused("not_enrolled" if enabled else "already_enabled")
    if factor.locked_for:
        db.commit()
        raise MfaLocked(factor.locked_for, started_now=False)  # not even checked: no guess counts while locked
    try:
        secret = unseal(_factor_key(jwt_secret), member.id.bytes, factor.secret_sealed)
    except UnsealError:
        db.commit()
        raise MfaRefused("not_enrolled") from None  # sealed under an earlier JWT_SECRET: enrol again
    step = totp.matching_step(secret, code, time.time(), factor.last_used_step)
    if step is None:
        _record_wrong_code(db, member, factor, ip)
    repository.use_factor(db, member.id, step)
    if member.session_id is not None:
        repository.mark_session_mfa_verified(db, member.session_id)
    db.commit()


def _record_wrong_code(db: Session, member: SessionMember, factor: repository.StoredFactor, ip: str) -> NoReturn:
    """Count a wrong code against the authenticator, whichever session sent it, and lock it
    after too many (see mfa_lockout). Five in one session also end that session."""
    failures = repository.add_factor_failure(db, member.id)
    _audit_mfa(db, member.id, "auth.mfa.failed", ip, failures=failures)
    session_ended = False
    if member.session_id is not None and repository.add_mfa_failure(db, member.session_id) >= MAX_MFA_FAILURES:
        repository.revoke_session(db, member.session_id, "mfa_failures")
        session_ended = True
    seconds = mfa_lockout.lockout_seconds(failures, factor.lockouts)
    if seconds is not None:
        repository.lock_factor(db, member.id, seconds)
        _audit_mfa(db, member.id, "auth.mfa.locked", ip, seconds=seconds, lockout=factor.lockouts + 1)
    db.commit()
    if seconds is not None:
        raise MfaLocked(seconds, started_now=True)
    raise MfaRefused("too_many_attempts" if session_ended else "invalid_code")


def _audit_mfa(db: Session, member_id: uuid.UUID, action: str, ip: str, **details: object) -> None:
    audit.record(
        db,
        actor_id=member_id,
        action=action,
        target_type="mfa_factor",
        target_id=str(member_id),
        details={"memberId": str(member_id), **details},
        ip=ip,
    )


def confirm_totp(db: Session, member: SessionMember, code: str, jwt_secret: str, ip: str) -> None:
    """The first code enables the authenticator, and counts as the second factor for this session."""
    _check_code(db, member, code, jwt_secret, enabled=False, ip=ip)


def verify_mfa(db: Session, member: SessionMember, code: str, jwt_secret: str, ip: str) -> None:
    """Give the second factor for this session, as staff must before any staff endpoint."""
    if member.session_id is None:
        raise MfaRefused("session_not_registered")  # an Express token: sign in through this API
    _check_code(db, member, code, jwt_secret, enabled=True, ip=ip)


def has_enabled_factor(db: Session, member_id: uuid.UUID) -> bool:
    return mfa_status(db, member_id)[1]


def _check_throttle(db: Session, identifier: str, ip: str) -> throttle.SignInGate:
    """Decide, and count this attempt as a failure until its password proves right.

    Counting only after the password check let concurrent guesses all read the
    same count and slip past the lockout together (review finding, 25 October
    2026). Under the shared lock each attempt sees the ones before it, in this
    API and in Express.
    """
    repository.lock_attempts(db, identifier, ip)
    gate = throttle.sign_in_gate(count_recent_failures(db, identifier, ip, throttle.WINDOW))
    if gate.allowed:
        record_attempt(db, identifier, ip, succeeded=False)
    db.commit()  # releases the lock, so no connection is held during the delay
    return gate


def _check_password(db: Session, identifier: str, ip: str, password: str) -> tuple[SignInMember, int]:
    """The member, and how many wrong passwords the account had in the last hour before this
    attempt, from any address (a risk signal, NFR-SEC-12)."""
    member = find_sign_in_member(db, identifier)
    # Run bcrypt even for an unknown NIC, so the response time does not reveal
    # which NICs are registered. (The Express API skips it; this is stricter.)
    succeeded = verify_password(password, member.password_hash if member else _unmatchable_hash())
    succeeded = succeeded and member is not None

    recent_failures = 0
    if succeeded:
        # This attempt's own provisional failure is among them; it is not a signal.
        recent_failures = max(repository.count_account_failures(db, identifier, risk.FAILURE_WINDOW) - 1, 0)
        # A correct password clears the slate, this attempt's provisional failure
        # included, so a member who eventually remembers it is not still slowed down.
        clear_failures(db, identifier, ip)
        record_attempt(db, identifier, ip, succeeded=True)
    db.commit()

    if not succeeded or member is None:
        raise InvalidCredentials()
    return member, recent_failures


@cache
def _unmatchable_hash() -> str:
    return hash_password("no member has this password; it only costs the same time")
