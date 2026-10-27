"""Refresh tokens (FR-AUTH-025) as plain functions.

A refresh token is "<session id>.<secret>": 32 random bytes the server keeps
only as a SHA-256 hash on the session row. Each use replaces it, and the hash
of the one before is kept, so a token used twice shows that it was copied:
whoever presents an already-used token ends the session for both copies.
"""

import hashlib
import hmac
import secrets
import uuid

REFRESH_COOKIE = "mp_refresh"
REFRESH_COOKIE_PATH = "/v1/auth"  # sent only to the auth endpoints, never to Express


def new_refresh_token(session_id: uuid.UUID) -> tuple[str, str]:
    """A new token and the hash to store for it."""
    secret = secrets.token_urlsafe(32)
    return f"{session_id}.{secret}", hash_secret(secret)


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def parse(token: str) -> tuple[uuid.UUID, str] | None:
    """The session id and secret, or None for anything malformed."""
    session_part, _, secret = token.partition(".")
    if not secret or len(secret) > 100:
        return None
    try:
        return uuid.UUID(session_part), secret
    except ValueError:
        return None


def matches(secret_hash: str, stored: str | None) -> bool:
    return stored is not None and hmac.compare_digest(secret_hash, stored)
