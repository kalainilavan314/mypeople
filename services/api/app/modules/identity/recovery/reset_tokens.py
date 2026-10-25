"""The short-lived token between a correct recovery code and the new password (FR-AUTH-015).

It names the account and its current session version, expires after 10
minutes and is signed with a key derived from JWT_SECRET for this purpose
alone, with its own audience, so it can never be used as a session. A reset
increments the session version, which also makes the token single-use.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

LIFETIME = timedelta(minutes=10)
_AUDIENCE = "my-people:password-reset"


class InvalidResetToken(Exception):
    pass


@dataclass(frozen=True)
class ResetClaims:
    member_id: uuid.UUID
    session_version: int


def _key(jwt_secret: str) -> bytes:
    return hmac.new(jwt_secret.encode("utf-8"), b"my-people password reset v1", hashlib.sha256).digest()


def sign(member_id: uuid.UUID, session_version: int, jwt_secret: str, issued_at: datetime | None = None) -> str:
    issued_at = issued_at or datetime.now(UTC)
    payload = {
        "sub": str(member_id),
        "sv": session_version,
        "aud": _AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + LIFETIME).timestamp()),
    }
    return jwt.encode(payload, _key(jwt_secret), algorithm="HS256")


def read(token: str, jwt_secret: str) -> ResetClaims:
    try:
        payload = jwt.decode(
            token, _key(jwt_secret), algorithms=["HS256"], audience=_AUDIENCE, options={"require": ["sub", "sv", "exp"]}
        )
        return ResetClaims(member_id=uuid.UUID(payload["sub"]), session_version=int(payload["sv"]))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise InvalidResetToken() from None
