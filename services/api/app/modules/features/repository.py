"""SQL for feature flags (ops.feature_flag and ops.feature_flag_change, Alembic revision 0018)."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredFlag:
    key: str
    enabled: bool
    gate: str | None
    approval_ref: str | None
    gate_recorded_at: datetime | None
    updated_at: datetime


def flags(db: Session) -> dict[str, StoredFlag]:
    rows = db.execute(
        text("SELECT key, enabled, gate, approval_ref, gate_recorded_at, updated_at FROM ops.feature_flag")
    ).mappings()
    return {row["key"]: StoredFlag(**row) for row in rows}


def is_enabled(db: Session, key: str) -> bool:
    return bool(db.scalar(text("SELECT enabled FROM ops.feature_flag WHERE key = :key"), {"key": key}))


def ensure(db: Session, key: str) -> None:
    db.execute(text("INSERT INTO ops.feature_flag (key) VALUES (:key) ON CONFLICT (key) DO NOTHING"), {"key": key})


def lock(db: Session, key: str) -> StoredFlag:
    ensure(db, key)
    row = db.execute(
        text(
            """
            SELECT key, enabled, gate, approval_ref, gate_recorded_at, updated_at FROM ops.feature_flag
            WHERE key = :key FOR UPDATE
            """
        ),
        {"key": key},
    ).mappings().one()
    return StoredFlag(**row)


def record_gate(db: Session, key: str, gate: str, approval_ref: str, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE ops.feature_flag
            SET gate = :gate, approval_ref = :ref, gate_recorded_by = :member, gate_recorded_at = clock_timestamp(),
                updated_by = :member, updated_at = clock_timestamp()
            WHERE key = :key
            """
        ),
        {"key": key, "gate": gate, "ref": approval_ref, "member": member_id},
    )


def set_enabled(db: Session, key: str, enabled: bool, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE ops.feature_flag SET enabled = :enabled, updated_by = :member, updated_at = clock_timestamp()
            WHERE key = :key
            """
        ),
        {"key": key, "enabled": enabled, "member": member_id},
    )


def add_change(db: Session, key: str, action: str, gate: str | None, reason: str, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            INSERT INTO ops.feature_flag_change (key, action, gate, reason, changed_by)
            VALUES (:key, :action, :gate, :reason, :member)
            """
        ),
        {"key": key, "action": action, "gate": gate, "reason": reason, "member": member_id},
    )
