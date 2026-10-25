"""SQL for membership.card (Alembic revision 0011)."""

import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.membership.card.tokens import new_card_ref


def card_ref(db: Session, member_id: uuid.UUID) -> str:
    """The member's current card reference, created on first use."""
    db.execute(
        text("INSERT INTO membership.card (member_id, card_ref) VALUES (:id, :ref) ON CONFLICT (member_id) DO NOTHING"),
        {"id": member_id, "ref": new_card_ref()},
    )
    return db.scalar(text("SELECT card_ref FROM membership.card WHERE member_id = :id"), {"id": member_id})


def member_by_card_ref(db: Session, ref: str) -> uuid.UUID | None:
    return db.scalar(text("SELECT member_id FROM membership.card WHERE card_ref = :ref"), {"ref": ref})


def replace_card_ref(db: Session, member_id: uuid.UUID) -> None:
    """Every code issued so far stops naming anyone (FR-CARD-015)."""
    db.execute(
        text(
            """
            UPDATE membership.card SET card_ref = :ref, replaced_at = clock_timestamp(), last_scanned_at = NULL,
                                       last_scanned_by = NULL
            WHERE member_id = :id
            """
        ),
        {"id": member_id, "ref": new_card_ref()},
    )


def record_scan(db: Session, member_id: uuid.UUID, scanner_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE membership.card SET last_scanned_at = clock_timestamp(), last_scanned_by = :scanner
            WHERE member_id = :id
            """
        ),
        {"id": member_id, "scanner": scanner_id},
    )


def last_scanned_at(db: Session, member_id: uuid.UUID) -> datetime | None:
    return db.scalar(text("SELECT last_scanned_at FROM membership.card WHERE member_id = :id"), {"id": member_id})
