"""SQL for ops.audit_log (created by Alembic revision 0002)."""

import json
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Held until the transaction ends, so two writers never read the same
# "previous" entry and fork the chain. The number only has to be unique.
_CHAIN_LOCK = 82_910_726


@dataclass(frozen=True)
class AuditEntry:
    id: int
    occurred_at: datetime
    actor_id: uuid.UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    area_level: str | None
    area_code: str | None
    details: dict[str, Any]
    ip: str | None
    prev_hash: str
    entry_hash: str


_SELECT = """
    SELECT id, occurred_at, actor_id, action, target_type, target_id, area_level, area_code,
           details, ip, prev_hash, entry_hash
    FROM ops.audit_log
"""


def lock_chain_and_get_last_hash(db: Session) -> str | None:
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _CHAIN_LOCK})
    return db.scalar(text("SELECT entry_hash FROM ops.audit_log ORDER BY id DESC LIMIT 1"))


def insert_entry(db: Session, *, area_path: list[str], prev_hash: str, entry_hash: str, **fields: Any) -> None:
    db.execute(
        text(
            """
            INSERT INTO ops.audit_log (occurred_at, actor_id, action, target_type, target_id,
                                       area_level, area_code, area_path, details, ip, prev_hash, entry_hash)
            VALUES (:occurred_at, :actor_id, :action, :target_type, :target_id,
                    :area_level, :area_code, :area_path, CAST(:details AS jsonb), :ip, :prev_hash, :entry_hash)
            """
        ),
        {
            **fields,
            "details": json.dumps(fields["details"], ensure_ascii=False),
            "area_path": area_path,
            "prev_hash": prev_hash,
            "entry_hash": entry_hash,
        },
    )


def list_entries(
    db: Session,
    *,
    visible_areas: list[str] | None,
    actor_id: uuid.UUID | None,
    action: str | None,
    before_id: int | None,
    limit: int,
) -> list[AuditEntry]:
    """Newest first. visible_areas=None means everything; otherwise only entries in those areas."""
    conditions: list[str] = []
    params: dict[str, Any] = {"limit": limit}
    if visible_areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    if actor_id is not None:
        conditions.append("actor_id = :actor_id")
        params["actor_id"] = actor_id
    if action is not None:
        conditions.append("action = :action")
        params["action"] = action
    if before_id is not None:
        conditions.append("id < :before_id")
        params["before_id"] = before_id
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = db.execute(text(f"{_SELECT} {where} ORDER BY id DESC LIMIT :limit"), params).mappings()
    return [AuditEntry(**row) for row in rows]


def entries_about_member(db: Session, *, action: str, member_id: uuid.UUID, limit: int) -> list[AuditEntry]:
    """Newest first: entries of one action whose details name the member (details.memberId)."""
    rows = db.execute(
        text(f"{_SELECT} WHERE action = :action AND details->>'memberId' = :member_id ORDER BY id DESC LIMIT :limit"),
        {"action": action, "member_id": str(member_id), "limit": limit},
    ).mappings()
    return [AuditEntry(**row) for row in rows]


def all_entries_in_order(db: Session) -> Iterator[AuditEntry]:
    for row in db.execute(text(f"{_SELECT} ORDER BY id")).mappings():
        yield AuditEntry(**row)
