"""Encrypted vault for contribution slip evidence (BRD MP-DEC-001, M1.4).

Each slip is encrypted with AES-256-GCM using the separate FINANCE_ENCRYPTION_KEY.
The contribution id and version are bound into the encryption as associated data,
preventing ciphertext transplant attacks across contributions or versions.
Plaintext images are never stored in the database or files.
"""

import hashlib
from uuid import UUID

from app.core import sealing


class SlipUnreadable(Exception):
    """The slip ciphertext is missing, corrupted, or sealed with another key or context."""


def key_id(key: bytes) -> str:
    """A short fingerprint naming the key, stored with the slip record."""
    return hashlib.sha256(b"my-people finance slip key id\x00" + key).hexdigest()[:16]


def seal(key: bytes, contribution_id: UUID, version: int, data: bytes) -> bytes:
    associated_data = f"{contribution_id}:{version}".encode("ascii")
    return sealing.seal(key, associated_data, data)


def unseal(key: bytes, contribution_id: UUID, version: int, sealed: bytes) -> bytes:
    associated_data = f"{contribution_id}:{version}".encode("ascii")
    try:
        return sealing.unseal(key, associated_data, sealed)
    except sealing.UnsealError as err:
        raise SlipUnreadable(str(err)) from None
