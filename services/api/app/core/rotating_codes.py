"""Short-lived signed QR codes: the member card (C1) and the event pass (E1).

A code carries only an opaque reference, the issue time, the expiry, a key
identifier and an HMAC-SHA256 signature: no name, ID number, phone or member
id. A new code is issued every 60 seconds; a scanner accepts one up to 15
seconds after it expires, for the time it takes to scan [ASSUMPTION]. Each
kind of code signs with its own key derived from JWT_SECRET, so one kind can
never be read as another.

Format: <version>.<reference>.<issued at>.<expires at>.<key id>.<signature>
"""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass

from app.core.sealing import derived_key

LIFETIME_SECONDS = 60
SCAN_LEEWAY_SECONDS = 15


class CodeExpired(Exception):
    pass


class CodeInvalid(Exception):
    pass


@dataclass(frozen=True)
class RotatingCode:
    code: str
    issued_at: int
    expires_at: int


@dataclass(frozen=True)
class CodeKind:
    version: str  # e.g. "C1"; never contains a dot
    purpose: bytes  # the key derivation label, e.g. b"my-people member card v1"

    def _key(self, jwt_secret: str) -> bytes:
        return derived_key(jwt_secret, self.purpose)

    def key_id(self, jwt_secret: str) -> str:
        """Names the signing key, so codes signed before a key change are recognised as such."""
        return hashlib.sha256(self._key(jwt_secret)).hexdigest()[:8]

    def _signature(self, payload: str, jwt_secret: str) -> str:
        digest = hmac.new(self._key(jwt_secret), payload.encode("ascii"), hashlib.sha256).digest()
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    def sign(self, reference: str, jwt_secret: str, now: int) -> RotatingCode:
        expires_at = now + LIFETIME_SECONDS
        payload = f"{self.version}.{reference}.{now}.{expires_at}.{self.key_id(jwt_secret)}"
        return RotatingCode(code=f"{payload}.{self._signature(payload, jwt_secret)}", issued_at=now, expires_at=expires_at)

    def read(self, code: str, jwt_secret: str, now: int) -> str:
        """The reference in a genuine, current code of this kind."""
        parts = code.split(".")
        if len(parts) != 6 or parts[0] != self.version or parts[4] != self.key_id(jwt_secret):
            raise CodeInvalid()
        payload, signature = ".".join(parts[:5]), parts[5]
        if not hmac.compare_digest(signature, self._signature(payload, jwt_secret)):
            raise CodeInvalid()
        try:
            issued_at, expires_at = int(parts[2]), int(parts[3])
        except ValueError:
            raise CodeInvalid() from None
        if issued_at > now + SCAN_LEEWAY_SECONDS:
            raise CodeInvalid()  # issued in the future: not from this server's clock
        if now > expires_at + SCAN_LEEWAY_SECONDS:
            raise CodeExpired()
        return parts[1]


def new_reference() -> str:
    return secrets.token_urlsafe(16)  # letters, digits, - and _: never a dot
