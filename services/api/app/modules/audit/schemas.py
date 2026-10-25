import uuid
from datetime import datetime
from typing import Any, Self

from app.core.schemas import CamelModel
from app.modules.audit.repository import AuditEntry


class AuditEntryOut(CamelModel):
    id: int
    occurred_at: datetime
    actor_id: uuid.UUID | None
    action: str
    target_type: str | None
    target_id: str | None
    area_level: str | None
    area_code: str | None
    details: dict[str, Any]
    entry_hash: str

    @classmethod
    def from_entry(cls, entry: AuditEntry) -> Self:
        return cls(
            id=entry.id,
            occurred_at=entry.occurred_at,
            actor_id=entry.actor_id,
            action=entry.action,
            target_type=entry.target_type,
            target_id=entry.target_id,
            area_level=entry.area_level,
            area_code=entry.area_code,
            details=entry.details,
            entry_hash=entry.entry_hash,
        )


class ChainCheckOut(CamelModel):
    ok: bool
    checked: int
    first_broken_id: int | None
