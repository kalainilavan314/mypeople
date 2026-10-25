"""The append-only audit log (BRD ENT-26, FR-ADM-011, AP-08).

Each entry stores the SHA-256 of the entry before it, computed over a fixed
JSON form of its own fields. Editing or deleting any entry therefore breaks
every hash after it, which verify_chain() reports. The database refuses
UPDATE, DELETE and TRUNCATE on the table as well (Alembic revision 0002).

Details must never hold sensitive data: ids, permission names and codes
only, never NIC numbers, documents, health or household information.
"""

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access.rules import AreaPath
from app.modules.audit import repository
from app.modules.audit.repository import AuditEntry

GENESIS_HASH = "0" * 64


def entry_hash(prev_hash: str, fields: dict[str, Any]) -> str:
    canonical = json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256((prev_hash + canonical).encode("utf-8")).hexdigest()


def _hashed_fields(entry: dict[str, Any]) -> dict[str, Any]:
    """The fields covered by the hash, in a form that reads back identically from the database."""
    return {
        "occurred_at": entry["occurred_at"].isoformat(),
        "actor_id": str(entry["actor_id"]) if entry["actor_id"] else None,
        "action": entry["action"],
        "target_type": entry["target_type"],
        "target_id": entry["target_id"],
        "area_level": entry["area_level"],
        "area_code": entry["area_code"],
        "details": entry["details"],
        "ip": entry["ip"],
    }


def record(
    db: Session,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    area_path: AreaPath | None = None,
    details: dict[str, Any] | None = None,
    ip: str | None = None,
) -> None:
    """Append one entry in the caller's transaction; it is saved when the caller commits."""
    area = area_path[-1] if area_path else None
    entry = {
        "occurred_at": datetime.now(UTC),
        "actor_id": actor_id,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "area_level": area.level if area else None,
        "area_code": area.code if area else None,
        "details": details or {},
        "ip": ip,
    }
    prev_hash = repository.lock_chain_and_get_last_hash(db) or GENESIS_HASH
    repository.insert_entry(
        db,
        area_path=[a.key for a in area_path or ()],
        prev_hash=prev_hash,
        entry_hash=entry_hash(prev_hash, _hashed_fields(entry)),
        **entry,
    )


def list_entries(
    db: Session,
    *,
    visible_areas: list[str] | None,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    before_id: int | None = None,
    limit: int = 50,
) -> list[AuditEntry]:
    return repository.list_entries(
        db, visible_areas=visible_areas, actor_id=actor_id, action=action, before_id=before_id, limit=limit
    )


@dataclass(frozen=True)
class ChainCheck:
    ok: bool
    checked: int
    first_broken_id: int | None


def verify_chain(db: Session) -> ChainCheck:
    """Recompute every hash in order and report the first entry that does not match."""
    prev_hash = GENESIS_HASH
    checked = 0
    for entry in repository.all_entries_in_order(db):
        expected = entry_hash(prev_hash, _hashed_fields(entry.__dict__))
        if entry.prev_hash != prev_hash or entry.entry_hash != expected:
            return ChainCheck(ok=False, checked=checked, first_broken_id=entry.id)
        prev_hash = entry.entry_hash
        checked += 1
    return ChainCheck(ok=True, checked=checked, first_broken_id=None)
