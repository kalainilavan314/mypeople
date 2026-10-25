"""The member QR code (BRD FR-CARD-003, FR-CARD-004, BR-063, BR-064).

A code carries only an opaque card reference, the issue time, the expiry, a
key identifier and an HMAC-SHA256 signature: no name, ID number, phone or
member id. A new code is issued every 60 seconds; a scanner accepts one up
to 15 seconds after it expires, for the time it takes to scan [ASSUMPTION].

Format: C1.<card ref>.<issued at>.<expires at>.<key id>.<signature>
"""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass

from app.core.sealing import derived_key

VERSION = "C1"
LIFETIME_SECONDS = 60
SCAN_LEEWAY_SECONDS = 15


class CardCodeExpired(Exception):
    pass


class CardCodeInvalid(Exception):
    pass


@dataclass(frozen=True)
class CardCode:
    code: str
    issued_at: int
    expires_at: int


def _key(jwt_secret: str) -> bytes:
    return derived_key(jwt_secret, b"my-people member card v1")


def key_id(jwt_secret: str) -> str:
    """Names the signing key, so codes signed before a key change are recognised as such."""
    return hashlib.sha256(_key(jwt_secret)).hexdigest()[:8]


def new_card_ref() -> str:
    return secrets.token_urlsafe(16)  # letters, digits, - and _: never a dot


def _signature(payload: str, jwt_secret: str) -> str:
    digest = hmac.new(_key(jwt_secret), payload.encode("ascii"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def sign(card_ref: str, jwt_secret: str, now: int) -> CardCode:
    expires_at = now + LIFETIME_SECONDS
    payload = f"{VERSION}.{card_ref}.{now}.{expires_at}.{key_id(jwt_secret)}"
    return CardCode(code=f"{payload}.{_signature(payload, jwt_secret)}", issued_at=now, expires_at=expires_at)


def read(code: str, jwt_secret: str, now: int) -> str:
    """The card reference in a genuine, current code."""
    parts = code.split(".")
    if len(parts) != 6 or parts[0] != VERSION or parts[4] != key_id(jwt_secret):
        raise CardCodeInvalid()
    payload, signature = ".".join(parts[:5]), parts[5]
    if not hmac.compare_digest(signature, _signature(payload, jwt_secret)):
        raise CardCodeInvalid()
    try:
        issued_at, expires_at = int(parts[2]), int(parts[3])
    except ValueError:
        raise CardCodeInvalid() from None
    if issued_at > now + SCAN_LEEWAY_SECONDS:
        raise CardCodeInvalid()  # issued in the future: not from this server's clock
    if now > expires_at + SCAN_LEEWAY_SECONDS:
        raise CardCodeExpired()
    return parts[1]
