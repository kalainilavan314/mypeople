"""Signing official content with Ed25519, and checking signatures (BRD FR-AUT-001, 002, INT-24).

The service signs through the Signer interface and never touches a private key itself.
[ASSUMPTION] INT-24: the BRD wants signing keys held in a KMS. Until one is chosen the only
implementation reads the key from a server setting (CONTENT_SIGNING_KEY); a KMS signer replaces
SettingKeySigner without changing anything else. Without a configured key build_signer returns
None and publishing is refused (fails closed).
"""

import base64
import binascii
import hashlib
from typing import Protocol

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.core.config import Settings

ALGORITHM = "ed25519"


class Signer(Protocol):
    @property
    def key_id(self) -> str: ...

    @property
    def public_key(self) -> str:
        """The raw 32-byte public key, base64-encoded."""
        ...

    def sign(self, payload: bytes) -> str:
        """The 64-byte signature, base64-encoded."""
        ...


def key_id_for(public_key_raw: bytes) -> str:
    """A short, stable name for a public key, so a signature says which key made it."""
    return f"{ALGORITHM}:{hashlib.sha256(public_key_raw).hexdigest()[:16]}"


class SettingKeySigner:
    """[ASSUMPTION] INT-24: the private key from a server setting, until a KMS is chosen."""

    def __init__(self, seed: bytes) -> None:
        self._key = Ed25519PrivateKey.from_private_bytes(seed)
        raw = self._key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
        self._public_key = base64.b64encode(raw).decode()
        self._key_id = key_id_for(raw)

    @property
    def key_id(self) -> str:
        return self._key_id

    @property
    def public_key(self) -> str:
        return self._public_key

    def sign(self, payload: bytes) -> str:
        return base64.b64encode(self._key.sign(payload)).decode()


def build_signer(settings: Settings) -> Signer | None:
    if settings.content_signing_key is None:
        return None
    return SettingKeySigner(base64.b64decode(settings.content_signing_key.get_secret_value()))


def verify(public_key: str, payload: bytes, signature: str) -> bool:
    """True only when the signature was made over exactly this payload by the key's private half."""
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key, validate=True)).verify(
            base64.b64decode(signature, validate=True), payload
        )
    except (InvalidSignature, ValueError, binascii.Error):
        return False
    return True
