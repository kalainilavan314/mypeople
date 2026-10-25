"""Sign-in, sign-out and session checks, with the same rules as the Express API."""

import uuid
from dataclasses import dataclass
from functools import cache
from typing import Literal

from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.security import (
    InvalidSessionToken,
    hash_password,
    read_session_token,
    sign_session_token,
    verify_password,
)
from app.modules.auth import throttle
from app.modules.auth.repository import (
    SessionMember,
    SignInMember,
    clear_failures,
    count_recent_failures,
    find_session_member,
    find_sign_in_member,
    record_attempt,
    revoke_sessions,
)


class NotAuthenticated(Exception):
    """No valid session. The reason is the error code the client receives."""

    def __init__(self, reason: Literal["unauthorized", "session_expired"]) -> None:
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


def authenticate(db: Session, token: str | None, jwt_secret: str) -> SessionMember:
    """Return the member a session token belongs to (requireMember in Express)."""
    if not token:
        raise NotAuthenticated("unauthorized")

    try:
        claims = read_session_token(token, jwt_secret)
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

    return member


async def sign_in(db: Session, identifier: str, password: str, ip: str, jwt_secret: str) -> SignedIn:
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

    member = await run_in_threadpool(_check_password, db, identifier, ip, password)
    return SignedIn(member_id=member.id, token=sign_session_token(member.id, member.session_version, jwt_secret))


def sign_out(db: Session, token: str | None, jwt_secret: str) -> None:
    """Revoke every session of the token's member, on this and other devices.

    Clearing the cookie alone would leave a copied token valid for the rest of
    its 30 days, which is not what signing out of a shared phone should mean.
    """
    if not token:
        return
    try:
        claims = read_session_token(token, jwt_secret)
    except InvalidSessionToken:
        return  # an unreadable token has nothing to revoke
    revoke_sessions(db, claims.member_id)
    db.commit()


def _check_throttle(db: Session, identifier: str, ip: str) -> throttle.SignInGate:
    failures = count_recent_failures(db, identifier, ip, throttle.WINDOW)
    db.commit()  # end the read, so no connection is held during the delay
    return throttle.sign_in_gate(failures)


def _check_password(db: Session, identifier: str, ip: str, password: str) -> SignInMember:
    member = find_sign_in_member(db, identifier)
    # Run bcrypt even for an unknown NIC, so the response time does not reveal
    # which NICs are registered. (The Express API skips it; this is stricter.)
    succeeded = verify_password(password, member.password_hash if member else _unmatchable_hash())
    succeeded = succeeded and member is not None

    record_attempt(db, identifier, ip, succeeded)
    if succeeded:
        # A correct password clears the slate, so a member who eventually
        # remembers it is not still slowed down afterwards.
        clear_failures(db, identifier, ip)
    db.commit()

    if not succeeded or member is None:
        raise InvalidCredentials()
    return member


@cache
def _unmatchable_hash() -> str:
    return hash_password("no member has this password; it only costs the same time")
