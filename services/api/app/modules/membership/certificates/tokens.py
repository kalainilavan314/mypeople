"""Certificate tokens (BRD BR-137, INT-22).

A certificate's token is its id signed with a key derived from JWT_SECRET for this purpose alone,
so the app can show the same QR whenever the member opens the certificate, while nobody can make
a token for an id they guess. Only the token's SHA-256 hash is stored (ENT-53), and a check looks
the hash up: a revoked or superseded certificate still verifies, as such. Rotating JWT_SECRET
retires every printed QR; the member's next download carries a new one.
"""

import base64
import hashlib
import hmac
import uuid


def _key(secret: str) -> bytes:
    return hmac.new(secret.encode("utf-8"), b"my-people certificate token v1", hashlib.sha256).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def token_for(certificate_id: uuid.UUID, secret: str) -> str:
    signature = hmac.new(_key(secret), certificate_id.bytes, hashlib.sha256).digest()[:18]
    return f"{_b64(certificate_id.bytes)}.{_b64(signature)}"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def caller_hash(ip: str, secret: str) -> str:
    """The rate limit's key: the address keyed with the secret, so the table never holds an address."""
    return hmac.new(_key(secret), f"check-caller:{ip}".encode(), hashlib.sha256).hexdigest()
