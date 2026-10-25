"""Encryption at rest for small secrets and files: AES-256-GCM with associated data.

The associated data binds a sealed value to what it belongs to (a document id,
a member id), so a value copied onto another record fails to open instead of
being read as that record's. Format: b"MPE1" + a 12-byte random nonce + the
ciphertext and its tag.
"""

import hashlib
import hmac
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

FORMAT = b"MPE1"
NONCE_BYTES = 12


class UnsealError(Exception):
    """Wrong key, wrong record, or a damaged value."""


def seal(key: bytes, associated_data: bytes, data: bytes) -> bytes:
    nonce = os.urandom(NONCE_BYTES)
    return FORMAT + nonce + AESGCM(key).encrypt(nonce, data, associated_data)


def unseal(key: bytes, associated_data: bytes, sealed: bytes) -> bytes:
    if not sealed.startswith(FORMAT):
        raise UnsealError("unknown format")
    nonce = sealed[len(FORMAT) : len(FORMAT) + NONCE_BYTES]
    try:
        return AESGCM(key).decrypt(nonce, sealed[len(FORMAT) + NONCE_BYTES :], associated_data)
    except InvalidTag:
        raise UnsealError("wrong key, wrong record or damaged value") from None


def derived_key(secret: str, purpose: bytes) -> bytes:
    """A 32-byte key for one purpose, derived from an application secret (HMAC-SHA256)."""
    return hmac.new(secret.encode("utf-8"), purpose, hashlib.sha256).digest()
