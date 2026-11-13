"""Offline field visits (BRD S05 to S07, D24, FR-FLD-001 to 009).

Coordinators with field.collect record community visits on their phones, usually without signal, and
sync them later. The server decides: each visit has a version, and an edit made from an older version
comes back as a conflict with the server's copy for the coordinator to resolve (FR-FLD-008). Visits
are only for GN divisions inside the coordinator's assignment. Supervisors see visits and open
follow-ups in their areas. After 12 months visits are deleted and only counts remain.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff, visible_areas
from app.modules.audit import service as audit
from app.modules.engagement.field import repository, rules
from app.modules.engagement.field.repository import Visit


@dataclass(frozen=True)
class VisitIn:
    client_id: uuid.UUID
    base_version: int | None
    gn_code: str
    visited_at: datetime
    consent: str
    concerns: list[str]
    notes: str | None
    place_text: str | None
    follow_up: str | None
    case_number: str | None
    confirmed_not_political: bool


@dataclass(frozen=True)
class SyncResult:
    client_id: uuid.UUID
    outcome: rules.SyncOutcome
    problems: list[str]
    visit: Visit | None  # the server's copy: the saved one, or the one in conflict


def _require(staff: Staff) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION):
        raise AccessRefused("forbidden")  # FR-FLD-001


def _clean(text_value: str | None) -> str | None:
    return text_value.strip() if text_value and text_value.strip() else None


def sync(db: Session, staff: Staff, visits: list[VisitIn], ip: str) -> list[SyncResult]:
    """Each visit is judged on its own; one refusal does not stop the others."""
    _require(staff)
    results = []
    for item in visits:
        path = access_repository.area_path(db, Area("gn", item.gn_code))
        if path is None or not access_rules.holds(staff.rule_assignments(), rules.PERMISSION, path):
            results.append(SyncResult(item.client_id, "refused", ["outside_your_area"], None))  # FR-FLD-003
            continue
        declined = item.consent == "declined"
        values: dict[str, Any] = {
            "gn_code": item.gn_code, "area_path": [a.key for a in path], "visited_at": item.visited_at,
            "consent": item.consent, "concerns": [] if declined else sorted(set(item.concerns)),
            "notes": None if declined else _clean(item.notes), "place_text": None if declined else _clean(item.place_text),
            "follow_up": None if declined else _clean(item.follow_up),
            "case_number": None if declined else _clean(item.case_number),
        }
        problems = rules.check_visit(
            consent=item.consent, concerns=values["concerns"], notes=values["notes"], place_text=values["place_text"],
            follow_up=values["follow_up"], case_number=values["case_number"],
            confirmed_not_political=item.confirmed_not_political,
        )
        if problems:
            results.append(SyncResult(item.client_id, "refused", problems, None))
            continue
        existing = repository.by_client_id(db, item.client_id, lock=True)
        if existing is not None and existing.coordinator_id != staff.member_id:
            results.append(SyncResult(item.client_id, "refused", ["not_your_visit"], None))
            continue
        outcome = rules.sync_outcome(exists=existing is not None, server_version=existing.version if existing else None,
                                     base_version=item.base_version)
        if outcome == "conflict":
            results.append(SyncResult(item.client_id, "conflict", [], existing))
            continue
        if outcome == "created":
            repository.insert(db, item.client_id, staff.member_id, values)
        else:
            repository.update(db, item.client_id, values)
        saved = repository.by_client_id(db, item.client_id)
        assert saved is not None
        # Ids and the consent answer only: never notes or places.
        audit.record(db, actor_id=staff.member_id, action=f"field.visit.{outcome}", target_type="field_visit",
                     target_id=str(saved.id), area_path=path, details={"consent": item.consent}, ip=ip)
        results.append(SyncResult(item.client_id, outcome, [], saved))
    db.commit()
    return results


def my_visits(db: Session, staff: Staff, since: datetime | None) -> list[Visit]:
    _require(staff)
    return repository.mine(db, staff.member_id, since)


def supervised(db: Session, staff: Staff, open_follow_ups: bool) -> list[Visit]:
    """D24: visits and follow-ups in the supervisor's areas."""
    _require(staff)
    return repository.in_areas(db, visible_areas(staff, rules.PERMISSION), open_follow_ups, 300)


def counts(db: Session, staff: Staff) -> list[tuple[str, str, int]]:
    _require(staff)
    return repository.counts(db, visible_areas(staff, rules.PERMISSION))


def set_follow_up(db: Session, staff: Staff, visit_id: uuid.UUID, done: bool, ip: str) -> Visit:
    _require(staff)
    visit = repository.find(db, visit_id)
    if visit is None or not access_rules.holds(
        staff.rule_assignments(), rules.PERMISSION, tuple(access_rules.area_from_key(k) for k in visit.area_path)
    ):
        raise AccessRefused("outside_your_area")
    repository.set_follow_up(db, visit_id, staff.member_id, done)
    audit.record(db, actor_id=staff.member_id, action="field.follow_up.done" if done else "field.follow_up.reopened",
                 target_type="field_visit", target_id=str(visit_id), ip=ip)
    db.commit()
    found = repository.find(db, visit_id)
    assert found is not None
    return found


def purge(db: Session, now: datetime) -> int:
    """FR-FLD-009, run by the notifications task: delete visits older than the retention period."""
    removed = repository.purge_older_than(db, now - timedelta(days=30 * rules.RETENTION_MONTHS))
    db.commit()
    return removed
