"""Staff broadcasts (BRD GAP-05; FR-ADM-007, FR-MSG-003, 007, BR-083, BR-145, BR-146).

A holder of notifications.send composes a bilingual announcement for an area
inside their own scope; targeting another area is refused (BR-083). The
preview gives the number of members it reaches. Submitting checks the text
for ID numbers (FR-MSG-007) and schedules it, for now or later; an area wider
than a district waits for approval by a Tier 4 or 5 holder over the area who
did not submit it. The dispatcher sends it when due: one inbox item per
member in the area, pushed by their topic choice (emergencies count as
urgent and ignore quiet hours).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import Area, AreaPath, area_from_key, highest_tier
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.messaging.broadcasts import repository, rules
from app.modules.messaging.broadcasts.repository import StoredBroadcast
from app.modules.messaging.broadcasts.rules import SEND


class BroadcastNotFound(Exception):
    pass


class BroadcastRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class BroadcastInvalid(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


def _path(broadcast: StoredBroadcast) -> AreaPath:
    return tuple(area_from_key(key) for key in broadcast.area_path)


def _record(db: Session, staff: Staff, action: str, broadcast: StoredBroadcast, ip: str, **details: object) -> None:
    audit.record(
        db, actor_id=staff.member_id, action=action, target_type="broadcast", target_id=str(broadcast.id),
        area_path=_path(broadcast), details={"broadcastRef": broadcast.broadcast_ref, **details}, ip=ip,
    )


def _in_scope(db: Session, staff: Staff, path: AreaPath, target: tuple[str, str], ip: str) -> None:
    if not access.has_permission_over(staff, SEND, path):
        access.refuse(db, staff, SEND, "outside_your_area", ip, target=target, area_path=path)


def _managed(db: Session, staff: Staff, broadcast_id: uuid.UUID, ip: str) -> StoredBroadcast:
    broadcast = repository.find(db, broadcast_id, for_update=True)
    if broadcast is None:
        raise BroadcastNotFound()
    _in_scope(db, staff, _path(broadcast), ("broadcast", str(broadcast.id)), ip)
    return broadcast


def _require(action: rules.Action, broadcast: StoredBroadcast) -> None:
    problem = rules.check_transition(action, broadcast.state)
    if problem:
        raise BroadcastRefused(problem)


def create(db: Session, staff: Staff, details: dict[str, Any], area: Area, ip: str) -> StoredBroadcast:
    path = access_repository.area_path(db, area)
    if path is None:
        raise BroadcastInvalid(["unknown_area"])
    _in_scope(db, staff, path, ("broadcast", "new"), ip)
    broadcast = repository.insert(
        db, details=details, area_level=area.level, area_key=area.key, area_path=[a.key for a in path],
        created_by=staff.member_id,
    )
    _record(db, staff, "messaging.broadcast.created", broadcast, ip)
    db.commit()
    return broadcast


def update(db: Session, staff: Staff, broadcast_id: uuid.UUID, changes: dict[str, Any], ip: str) -> StoredBroadcast:
    broadcast = _managed(db, staff, broadcast_id, ip)
    _require("edit", broadcast)
    if changes:
        repository.update(db, broadcast.id, changes)
    db.commit()
    updated = repository.find(db, broadcast.id)
    assert updated is not None
    return updated


@dataclass(frozen=True)
class Preview:
    broadcast: StoredBroadcast
    recipients: int
    problems: list[str]
    needs_approval: bool


def preview(db: Session, staff: Staff, broadcast_id: uuid.UUID, ip: str) -> Preview:
    broadcast = _managed(db, staff, broadcast_id, ip)
    db.commit()
    return Preview(
        broadcast=broadcast,
        recipients=repository.recipients(db, broadcast.area_level, broadcast.area_key),
        problems=rules.check_content(broadcast.title_en, broadcast.title_ta, broadcast.body_en, broadcast.body_ta),
        needs_approval=rules.needs_approval(broadcast.area_level),
    )


def submit(db: Session, staff: Staff, broadcast_id: uuid.UUID, send_at: datetime | None, ip: str) -> StoredBroadcast:
    broadcast = _managed(db, staff, broadcast_id, ip)
    _require("submit", broadcast)
    problems = rules.check_content(broadcast.title_en, broadcast.title_ta, broadcast.body_en, broadcast.body_ta)
    if problems:
        raise BroadcastInvalid(problems)
    state = "pending_approval" if rules.needs_approval(broadcast.area_level) else "scheduled"
    repository.set_state(db, broadcast.id, state, submitted_by=staff.member_id, send_at=send_at)
    _record(db, staff, "messaging.broadcast.submitted", broadcast, ip, state=state)
    db.commit()
    return _reload(db, broadcast.id)


def approve(db: Session, staff: Staff, broadcast_id: uuid.UUID, ip: str) -> StoredBroadcast:
    broadcast = _managed(db, staff, broadcast_id, ip)
    _require("approve", broadcast)
    problem = rules.check_approver(
        staff.member_id, broadcast.submitted_by, highest_tier(staff.rule_assignments(), SEND, _path(broadcast))
    )
    if problem:
        raise BroadcastRefused(problem)
    repository.set_state(db, broadcast.id, "scheduled", approved_by=staff.member_id)
    _record(db, staff, "messaging.broadcast.approved", broadcast, ip)
    db.commit()
    return _reload(db, broadcast.id)


def cancel(db: Session, staff: Staff, broadcast_id: uuid.UUID, ip: str) -> StoredBroadcast:
    broadcast = _managed(db, staff, broadcast_id, ip)
    _require("cancel", broadcast)
    repository.set_state(db, broadcast.id, "cancelled")
    _record(db, staff, "messaging.broadcast.cancelled", broadcast, ip)
    db.commit()
    return _reload(db, broadcast.id)


def managed(db: Session, staff: Staff, states: list[str], limit: int) -> list[StoredBroadcast]:
    return repository.managed(db, visible_areas=access.visible_areas(staff, SEND), states=states, limit=limit)


def _reload(db: Session, broadcast_id: uuid.UUID) -> StoredBroadcast:
    broadcast = repository.find(db, broadcast_id)
    assert broadcast is not None
    return broadcast


def send_due(db: Session, now: datetime | None = None) -> int:
    """Send every scheduled broadcast whose time has come; for the dispatcher. Returns how many."""
    sent = 0
    for broadcast_id in repository.due(db, now or datetime.now(UTC)):
        broadcast = repository.find(db, broadcast_id)
        assert broadcast is not None
        count = repository.fan_out(db, broadcast)
        repository.set_state(db, broadcast.id, "sent", sent_at=now or datetime.now(UTC), recipients=count)
        audit.record(
            db, actor_id=None, action="messaging.broadcast.sent", target_type="broadcast", target_id=str(broadcast.id),
            area_path=_path(broadcast), details={"broadcastRef": broadcast.broadcast_ref, "recipients": count},
        )
        sent += 1
    db.commit()
    return sent
