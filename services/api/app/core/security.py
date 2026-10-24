"""NIC hashing, password hashing and session tokens, shared with the Express API.

While both APIs run side by side they read the same members table and the same
session cookie, so each function here must produce or accept exactly what
server/src/lib.js does. tests/test_security.py checks this against vectors
generated from lib.js, and tests/test_express_compat.py against lib.js itself.
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

SESSION_LIFETIME = timedelta(days=30)  # lib.js signToken: expiresIn "30d"
BCRYPT_COST = 10  # the Express signup uses bcrypt.hash(password, 10)
BCRYPT_MAX_BYTES = 72


def nic_hash(nic: str, pepper: str) -> str:
    """Hash a NIC so members can be found by it without storing the NIC itself.

    Same as lib.js nicHash: SHA-256 of the pepper followed by the trimmed,
    upper-cased NIC. The pepper (NIC_PEPPER) must never change, or no existing
    member can be found by NIC again.
    """
    return hashlib.sha256((pepper + nic.strip().upper()).encode("utf-8")).hexdigest()


def _password_bytes(password: str) -> bytes:
    # bcryptjs (Express) silently uses only the first 72 bytes of the UTF-8
    # password, while Python's bcrypt refuses longer input. Cutting at 72 bytes
    # keeps both in agreement. Tamil characters take 3 bytes each, so a
    # 64-character Tamil password can reach 192 bytes.
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt(BCRYPT_COST)).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_password_bytes(password), password_hash.encode("ascii"))
    except ValueError:
        # A stored value that is not a bcrypt hash can never match.
        return False


@dataclass(frozen=True)
class SessionClaims:
    member_id: uuid.UUID
    session_version: int


class InvalidSessionToken(Exception):
    """The token is malformed, expired, or not signed with our secret."""


def sign_session_token(
    member_id: uuid.UUID | str,
    session_version: int,
    secret: str,
    issued_at: datetime | None = None,
) -> str:
    """Sign a 30-day session token, as lib.js signToken does."""
    iat = int((issued_at or datetime.now(UTC)).timestamp())
    # Same claims in the same order as jsonwebtoken, so a token signed here is
    # byte-for-byte the one lib.js signs in the same second.
    payload = {
        "sub": str(member_id),
        "sv": session_version,
        "iat": iat,
        "exp": iat + int(SESSION_LIFETIME.total_seconds()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def read_session_token(token: str, secret: str) -> SessionClaims:
    """Verify a session token's signature and expiry and return its claims.

    Only HS256 is accepted, as in lib.js verifyToken, so a token cannot choose
    a weaker algorithm (or "none") for itself. This does not check that the
    member still exists or that the session was not revoked; the auth module
    does that against the database.
    """
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], options={"require": ["sub", "exp"]})
        member_id = uuid.UUID(payload["sub"])
        # Tokens signed before session revocation existed carry no "sv";
        # lib.js treats them as version 0, so nobody was signed out by that change.
        session_version = int(payload.get("sv", 0))
    except (jwt.InvalidTokenError, ValueError, TypeError) as error:
        raise InvalidSessionToken(str(error)) from error
    return SessionClaims(member_id=member_id, session_version=session_version)
