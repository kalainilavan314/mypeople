"""SQL for data-subject requests (privacy.request, Alembic revision 0016)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredRequest:
    id: uuid.UUID
    request_ref: str
    member_id: uuid.UUID
    member_code: str
    kind: str
    note: str
    state: str
    due_at: datetime
    outcome_note: str | None
    created_at: datetime
    closed_at: datetime | None


_SELECT = """
    SELECT r.id, r.request_ref, r.member_id, m.member_code, r.kind, r.note, r.state, r.due_at, r.outcome_note,
           r.created_at, r.closed_at
    FROM privacy.request r JOIN npm.member m ON m.id = r.member_id
"""


def _request(row: Any) -> StoredRequest:
    return StoredRequest(**row)


def insert(db: Session, *, member_id: uuid.UUID, kind: str, note: str, due_at: datetime) -> StoredRequest:
    request_id = db.scalar(
        text(
            """
            INSERT INTO privacy.request (member_id, kind, note, due_at) VALUES (:member, :kind, :note, :due)
            RETURNING id
            """
        ),
        {"member": member_id, "kind": kind, "note": note, "due": due_at},
    )
    stored = find(db, request_id)
    assert stored is not None
    return stored


def find(db: Session, request_id: uuid.UUID, *, for_update: bool = False) -> StoredRequest | None:
    if for_update:
        db.execute(text("SELECT 1 FROM privacy.request WHERE id = :id FOR UPDATE"), {"id": request_id})
    row = db.execute(text(f"{_SELECT} WHERE r.id = :id"), {"id": request_id}).mappings().one_or_none()
    return _request(row) if row else None


def open_of(db: Session, member_id: uuid.UUID, kind: str) -> StoredRequest | None:
    row = db.execute(
        text(f"{_SELECT} WHERE r.member_id = :member AND r.kind = :kind AND r.state = 'open'"),
        {"member": member_id, "kind": kind},
    ).mappings().one_or_none()
    return _request(row) if row else None


def of_member(db: Session, member_id: uuid.UUID) -> list[StoredRequest]:
    rows = db.execute(text(f"{_SELECT} WHERE r.member_id = :member ORDER BY r.created_at DESC"), {"member": member_id})
    return [_request(row) for row in rows.mappings()]


def queue(db: Session, *, states: list[str], limit: int) -> list[StoredRequest]:
    """Soonest due first: the DPO register (KPI-21)."""
    rows = db.execute(
        text(f"{_SELECT} WHERE r.state = ANY(CAST(:states AS text[])) ORDER BY r.due_at, r.request_ref LIMIT :limit"),
        {"states": states, "limit": limit},
    )
    return [_request(row) for row in rows.mappings()]


def close(db: Session, request_id: uuid.UUID, *, state: str, outcome_note: str, handled_by: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE privacy.request
            SET state = :state, outcome_note = :note, handled_by = :member, closed_at = clock_timestamp()
            WHERE id = :id AND state = 'open'
            """
        ),
        {"id": request_id, "state": state, "note": outcome_note, "member": handled_by},
    )


def close_account(db: Session, member_id: uuid.UUID) -> None:
    """The account stops working in both APIs: marked deleted (sign-in refused) and every session
    ended. The data stays until the retention rules remove or anonymise it."""
    db.execute(
        text(
            """
            UPDATE npm.member SET deleted_at = clock_timestamp(), session_version = session_version + 1
            WHERE id = :id AND deleted_at IS NULL
            """
        ),
        {"id": member_id},
    )
    db.execute(
        text(
            """
            UPDATE identity.session SET revoked_at = clock_timestamp(), revoked_reason = 'member'
            WHERE member_id = :id AND revoked_at IS NULL
            """
        ),
        {"id": member_id},
    )
