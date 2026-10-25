"""SQL for identity.identity_document (created by Alembic revision 0003).

Rows describe images; the images themselves are encrypted files in the
evidence vault (vault.py), never in the database.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

DocumentKind = Literal["nic_front", "nic_back", "passport_page", "selfie"]  # ENT-03 IdentityDocument.kind

# Serialises uploads per member, so two at once cannot both take the same
# version number. Two-key advisory locks never collide with the audit log's
# single-key lock.
_UPLOAD_LOCK_SPACE = 30_001


@dataclass(frozen=True)
class StoredDocument:
    id: uuid.UUID
    member_id: uuid.UUID
    kind: DocumentKind
    version: int
    state: str
    content_type: str
    byte_size: int
    key_id: str
    server_ack_at: datetime


_SELECT = """
    SELECT id, member_id, kind, version, state, content_type, byte_size, key_id, server_ack_at
    FROM identity.identity_document
"""


def lock_member_uploads(db: Session, member_id: uuid.UUID) -> None:
    """One upload at a time per member, until the caller commits."""
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:member_id AS text)))"),
        {"space": _UPLOAD_LOCK_SPACE, "member_id": member_id},
    )


def recent_uploads(db: Session, member_id: uuid.UUID, window: str) -> tuple[int, int]:
    """(images the member uploaded in the window, seconds until the oldest of them leaves it)."""
    row = db.execute(
        text(
            """
            SELECT count(*) AS uploads,
                   COALESCE(CEIL(EXTRACT(EPOCH FROM min(server_ack_at) + CAST(:window AS interval) - now())), 0)::int
                       AS oldest_leaves_in
            FROM identity.identity_document
            WHERE member_id = :member_id AND server_ack_at > now() - CAST(:window AS interval)
            """
        ),
        {"member_id": member_id, "window": window},
    ).one()
    return row.uploads, max(row.oldest_leaves_in, 1)


def insert_document(
    db: Session,
    *,
    document_id: uuid.UUID,
    member_id: uuid.UUID,
    kind: DocumentKind,
    content_type: str,
    byte_size: int,
    key_id: str,
) -> StoredDocument:
    """Add a new version of the member's image of this kind; the current one becomes superseded."""
    params = {"member_id": member_id, "kind": kind}
    lock_member_uploads(db, member_id)
    db.execute(
        text(
            """
            UPDATE identity.identity_document SET state = 'superseded', superseded_at = now()
            WHERE member_id = :member_id AND kind = :kind AND state = 'current'
            """
        ),
        params,
    )
    db.execute(
        text(
            """
            INSERT INTO identity.identity_document (id, member_id, kind, version, content_type, byte_size, key_id)
            SELECT :id, :member_id, :kind, COALESCE(max(version), 0) + 1, :content_type, :byte_size, :key_id
            FROM identity.identity_document WHERE member_id = :member_id AND kind = :kind
            """
        ),
        {**params, "id": document_id, "content_type": content_type, "byte_size": byte_size, "key_id": key_id},
    )
    stored = find_document(db, document_id)
    assert stored is not None
    return stored


def find_document(db: Session, document_id: uuid.UUID) -> StoredDocument | None:
    row = db.execute(text(f"{_SELECT} WHERE id = :id"), {"id": document_id}).mappings().one_or_none()
    return StoredDocument(**row) if row else None


def current_documents(db: Session, member_id: uuid.UUID) -> list[StoredDocument]:
    rows = db.execute(
        text(f"{_SELECT} WHERE member_id = :member_id AND state = 'current' ORDER BY kind"),
        {"member_id": member_id},
    ).mappings()
    return [StoredDocument(**row) for row in rows]


def member_exists(db: Session, member_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM npm.member WHERE id = :id AND deleted_at IS NULL)"),
            {"id": member_id},
        )
    )
