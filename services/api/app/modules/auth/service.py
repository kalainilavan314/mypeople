"""Turns a session token into the signed-in member, with the same rules as Express."""

from typing import Literal

from sqlalchemy.orm import Session

from app.core.security import InvalidSessionToken, read_session_token
from app.modules.auth.repository import SessionMember, find_session_member


class NotAuthenticated(Exception):
    """No valid session. The reason is the error code the client receives."""

    def __init__(self, reason: Literal["unauthorized", "session_expired"]) -> None:
        super().__init__(reason)
        self.reason = reason


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
