"""Encrypted storage for identity evidence (BRD FR-ARCH-007, INT-08, Sensitive class).

Each image is encrypted with AES-256-GCM before it reaches the disk, under a
key that lives only in the API's settings. The document id is bound into the
encryption as associated data, so a file copied or renamed to another
document fails to decrypt instead of showing the wrong person's ID.

File layout: <root>/<first two hex digits of the id>/<id>.bin, each file
being b"MPE1" + a 12-byte random nonce + the ciphertext and its tag. Paths
are built from the document id only, never from anything a client sends.

The store is a private directory today. An S3-compatible bucket for the
identity vault (separate account and keys, INT-08) can replace FileStore
behind the same put/get methods once hosting is decided (OD-20).
"""

import hashlib
import os
import uuid
from pathlib import Path

from app.core import sealing


class EvidenceUnreadable(Exception):
    """The file is missing, damaged, or sealed with another key or for another document."""


def key_id(key: bytes) -> str:
    """A short fingerprint naming the key, stored with each document; reveals nothing about the key."""
    return hashlib.sha256(b"my-people evidence key id\x00" + key).hexdigest()[:16]


def seal(key: bytes, document_id: uuid.UUID, data: bytes) -> bytes:
    return sealing.seal(key, document_id.bytes, data)


def unseal(key: bytes, document_id: uuid.UUID, sealed: bytes) -> bytes:
    try:
        return sealing.unseal(key, document_id.bytes, sealed)
    except sealing.UnsealError as error:
        raise EvidenceUnreadable(str(error)) from None


class FileStore:
    """Sealed files in a private directory. Readable by the API's own user only."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def _path(self, document_id: uuid.UUID) -> Path:
        return self.root / document_id.hex[:2] / f"{document_id}.bin"

    def put(self, document_id: uuid.UUID, sealed: bytes) -> None:
        path = self._path(document_id)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Written to a temporary name and renamed, so a crash never leaves half a file.
        partial = path.with_suffix(".partial")
        descriptor = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_BINARY", 0), 0o600)
        with os.fdopen(descriptor, "wb") as file:
            file.write(sealed)
            file.flush()
            os.fsync(file.fileno())
        os.replace(partial, path)

    def get(self, document_id: uuid.UUID) -> bytes | None:
        try:
            return self._path(document_id).read_bytes()
        except FileNotFoundError:
            return None


class EvidenceVault:
    def __init__(self, store: FileStore, key: bytes) -> None:
        self.store = store
        self.key = key
        self.key_id = key_id(key)

    def save(self, document_id: uuid.UUID, data: bytes) -> str:
        """Encrypt and store an image; returns the id of the key that sealed it."""
        self.store.put(document_id, seal(self.key, document_id, data))
        return self.key_id

    def read(self, document_id: uuid.UUID, sealed_with: str) -> bytes:
        if sealed_with != self.key_id:
            raise EvidenceUnreadable("sealed with a key this server does not hold")
        sealed = self.store.get(document_id)
        if sealed is None:
            raise EvidenceUnreadable("missing file")
        return unseal(self.key, document_id, sealed)
