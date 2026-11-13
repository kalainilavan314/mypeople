"""The election duty roster (BRD M30, S15, FR-ELX-005 to 007, 009, BR-129, BR-130, BR-135).

Coordinators with election.roster.manage create shifts for a declared election period in their area
and offer them to Verified and Active members; volunteers accept or decline, check in and out with an
optional site confirmation and no location tracking. Coordinators send operational messages to the
volunteers rostered on a shift, those who accepted it. Nothing here records a vote choice, intention or
proof of voting. Tier 5 reads the election-period audit report for a period in their area.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.election.roster import repository
from app.modules.election.roster.repository import Assignment, ReportEntry, SentMessage, Shift
from app.modules.messaging.notifications import service as notifications

PERMISSION = "election.roster.manage"  # PRM-49
REPORT = "election.mode.manage"  # PRM-48
CHECK_IN_EARLY = timedelta(hours=1)
REPORT_ENTRIES = 500


class RosterRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class RosterNotFound(Exception):
    pass


def _path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(k) for k in keys)


def _require(db: Session, staff: Staff, keys: list[str], ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), PERMISSION, _path(keys)):
        refuse(db, staff, PERMISSION, "outside_your_area", ip, target=("roster_shift", target), area_path=_path(keys))


# --- Coordinators (S15) --------------------------------------------------------------------------------


def shifts(db: Session, staff: Staff, period_id: uuid.UUID | None) -> list[Shift]:
    if not access_rules.holds(staff.rule_assignments(), PERMISSION):
        raise AccessRefused("forbidden")
    return repository.shifts(db, visible_areas(staff, PERMISSION), period_id)


@dataclass(frozen=True)
class OpenPeriod:
    id: uuid.UUID
    period_ref: str
    title_en: str
    title_ta: str
    area_key: str
    starts_at: datetime
    ends_at: datetime
    polling_day: Any


def periods(db: Session, staff: Staff) -> list[OpenPeriod]:
    """Declared periods that cover, or lie inside, an area where the coordinator manages the roster.

    A GN coordinator sees a district-wide period (it covers their GN); a district coordinator sees a
    period declared for one of their GNs.
    """
    if not access_rules.holds(staff.rule_assignments(), PERMISSION):
        raise AccessRefused("forbidden")
    inside = visible_areas(staff, PERMISSION)
    covering: list[str] = []
    for assignment in staff.assignments:
        if PERMISSION in assignment.permissions:
            path = access_repository.area_path(db, assignment.area)
            covering.extend(a.key for a in path or [])
    rows = db.execute(
        text(
            """SELECT id, period_ref, title_en, title_ta, area_key, starts_at, ends_at, polling_day FROM election.period
               WHERE state = 'declared' AND ends_at > now()
                 AND (CAST(:inside AS text[]) IS NULL OR area_path && CAST(:inside AS text[])
                      OR area_key = ANY(CAST(:covering AS text[])))
               ORDER BY starts_at"""
        ),
        {"inside": inside, "covering": covering},
    ).mappings()
    return [OpenPeriod(**row) for row in rows]


def create_shift(db: Session, staff: Staff, period_id: uuid.UUID, area: Area, values: dict[str, Any], ip: str) -> Shift:
    period = db.execute(
        text("SELECT state, area_path, ends_at FROM election.period WHERE id = :id"), {"id": period_id}
    ).one_or_none()
    if period is None or period.state != "declared":
        raise RosterRefused("period_not_declared")
    path = access_repository.area_path(db, area)
    if path is None:
        raise RosterRefused("unknown_area")
    keys = [a.key for a in path]
    if period.area_path[-1] not in keys:
        raise RosterRefused("outside_the_election_area")
    _require(db, staff, keys, ip, "new")
    if values["ends_at"] <= values["starts_at"]:
        raise RosterRefused("ends_before_start")
    shift_id = repository.insert_shift(db, {**values, "period_id": period_id, "area_key": area.key, "area_path": keys,
                                            "created_by": staff.member_id})
    audit.record(db, actor_id=staff.member_id, action="election.roster.shift_created", target_type="roster_shift",
                 target_id=str(shift_id), area_path=path, ip=ip)
    db.commit()
    found = repository.find_shift(db, shift_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class ShiftFile:
    shift: Shift
    assignments: list[Assignment]
    messages: list[SentMessage]


def _file(db: Session, shift_id: uuid.UUID) -> ShiftFile:
    shift = repository.find_shift(db, shift_id)
    assert shift is not None
    return ShiftFile(shift, repository.assignments(db, shift_id), repository.messages(db, shift_id))


def shift_file(db: Session, staff: Staff, shift_id: uuid.UUID, ip: str) -> ShiftFile:
    shift = repository.find_shift(db, shift_id)
    if shift is None:
        raise RosterNotFound()
    _require(db, staff, shift.area_path, ip, str(shift_id))
    return _file(db, shift_id)


def offer(db: Session, staff: Staff, shift_id: uuid.UUID, member_code: str, ip: str) -> ShiftFile:
    shift = repository.find_shift(db, shift_id, lock=True)
    if shift is None:
        raise RosterNotFound()
    _require(db, staff, shift.area_path, ip, str(shift_id))
    if shift.state != "open":
        raise RosterRefused("shift_cancelled")
    if shift.accepted + shift.offered >= shift.places:
        raise RosterRefused("places_filled")
    member_id = repository.member_by_code(db, member_code.strip())
    status = access_repository.find_member_status(db, member_id) if member_id else None
    if member_id is None or status is None:
        raise RosterRefused("member_not_found")
    if not (status.identity_verified and status.membership_active):
        raise RosterRefused("membership_not_active")
    if shift.area_key not in [a.key for a in access_repository.member_area_path(db, member_id)]:
        raise RosterRefused("member_outside_shift_area")
    assignment_id = repository.insert_assignment(db, shift_id, member_id, staff.member_id)
    if assignment_id is None:
        raise RosterRefused("already_offered")
    notifications.notify(db, member_id, "roster_offered", assignment_id)
    audit.record(db, actor_id=staff.member_id, action="election.roster.offered", target_type="roster_shift",
                 target_id=str(shift_id), area_path=_path(shift.area_path), ip=ip)
    db.commit()
    return _file(db, shift_id)


def cancel(db: Session, staff: Staff, shift_id: uuid.UUID, reason: str, ip: str) -> ShiftFile:
    shift = repository.find_shift(db, shift_id, lock=True)
    if shift is None:
        raise RosterNotFound()
    _require(db, staff, shift.area_path, ip, str(shift_id))
    people = [a.member_id for a in repository.assignments(db, shift_id) if a.state in ("offered", "accepted")]
    repository.cancel_shift(db, shift_id)
    for member_id in people:
        notifications.notify(db, member_id, "roster_cancelled", shift_id)
    audit.record(db, actor_id=staff.member_id, action="election.roster.shift_cancelled", target_type="roster_shift",
                 target_id=str(shift_id), area_path=_path(shift.area_path), details={"reason": reason.strip()}, ip=ip)
    db.commit()
    return _file(db, shift_id)


def message(db: Session, staff: Staff, shift_id: uuid.UUID, body_en: str, body_ta: str, ip: str) -> int:
    """FR-ELX-007: an operational message to the volunteers rostered on the shift, within the sender's
    scope. Only those who accepted it are rostered; an open offer is not yet a duty."""
    shift = repository.find_shift(db, shift_id)
    if shift is None:
        raise RosterNotFound()
    _require(db, staff, shift.area_path, ip, str(shift_id))
    people = [a.member_id for a in repository.assignments(db, shift_id) if a.state == "accepted"]
    for member_id in people:
        notifications.notify(db, member_id, "roster_message", shift_id, body_en=body_en.strip(), body_ta=body_ta.strip())
    repository.insert_message(db, shift_id, body_en.strip(), body_ta.strip(), staff.member_id, len(people))
    audit.record(db, actor_id=staff.member_id, action="election.roster.message_sent", target_type="roster_shift",
                 target_id=str(shift_id), area_path=_path(shift.area_path), details={"recipients": len(people)}, ip=ip)
    db.commit()
    return len(people)


def _reported_period(db: Session, staff: Staff, period_id: uuid.UUID, ip: str) -> None:
    """Tier 5 reads the report only for a period inside an area where they manage election mode."""
    if not access_rules.holds(staff.rule_assignments(), REPORT):
        raise AccessRefused("forbidden")
    keys = db.scalar(text("SELECT area_path FROM election.period WHERE id = :id"), {"id": period_id})
    if keys is None:
        raise RosterNotFound()
    path = _path(list(keys))
    if not access_rules.holds(staff.rule_assignments(), REPORT, path):
        refuse(db, staff, REPORT, "outside_your_area", ip, target=("election_period", str(period_id)), area_path=path)


def report(db: Session, staff: Staff, period_id: uuid.UUID, ip: str) -> dict[str, int]:
    """FR-ELX-009: the election-period audit report: counts of messages, roster changes and content."""
    _reported_period(db, staff, period_id, ip)
    return repository.period_report(db, period_id)


def report_entries(db: Session, staff: Staff, period_id: uuid.UUID, ip: str) -> list[ReportEntry]:
    """FR-ELX-009: the entries behind the report, newest first, ids only."""
    _reported_period(db, staff, period_id, ip)
    return repository.period_report_entries(db, period_id, REPORT_ENTRIES)


# --- Volunteers (M30) ------------------------------------------------------------------------------------


@dataclass(frozen=True)
class MyShift:
    assignment: Assignment
    shift: Shift


def my_shifts(db: Session, member_id: uuid.UUID) -> list[MyShift]:
    result = []
    for assignment in repository.member_assignments(db, member_id):
        shift = repository.find_shift(db, assignment.shift_id)
        assert shift is not None
        result.append(MyShift(assignment, shift))
    return result


def _mine(db: Session, member_id: uuid.UUID, assignment_id: uuid.UUID) -> tuple[Assignment, Shift]:
    assignment = repository.find_assignment(db, assignment_id, lock=True)
    if assignment is None or assignment.member_id != member_id:
        raise RosterNotFound()
    shift = repository.find_shift(db, assignment.shift_id)
    assert shift is not None
    return assignment, shift


def respond(db: Session, member_id: uuid.UUID, assignment_id: uuid.UUID, accept: bool, ip: str) -> MyShift:
    assignment, shift = _mine(db, member_id, assignment_id)
    if assignment.state != "offered" or shift.state != "open":
        raise RosterRefused("not_awaiting_answer")
    repository.update_assignment(db, assignment_id, {"state": "accepted" if accept else "declined",
                                                     "responded_at": datetime.now(UTC)})
    audit.record(db, actor_id=member_id, action="election.roster.accepted" if accept else "election.roster.declined",
                 target_type="roster_shift", target_id=str(shift.id), area_path=_path(shift.area_path), ip=ip)
    db.commit()
    updated = repository.find_assignment(db, assignment_id)
    assert updated is not None
    return MyShift(updated, shift)


def check_in(db: Session, member_id: uuid.UUID, assignment_id: uuid.UUID, site_confirmed: bool | None, ip: str) -> MyShift:
    """FR-ELX-006: a time and an optional "I am at the site"; never a location."""
    assignment, shift = _mine(db, member_id, assignment_id)
    now = datetime.now(UTC)
    if assignment.state != "accepted":
        raise RosterRefused("not_accepted")
    if assignment.checked_in_at is not None:
        raise RosterRefused("already_checked_in")
    if not (shift.starts_at - CHECK_IN_EARLY <= now <= shift.ends_at):
        raise RosterRefused("outside_shift_time")
    repository.update_assignment(db, assignment_id, {"checked_in_at": now, "site_confirmed": site_confirmed})
    audit.record(db, actor_id=member_id, action="election.roster.checked_in", target_type="roster_shift",
                 target_id=str(shift.id), area_path=_path(shift.area_path), ip=ip)
    db.commit()
    updated = repository.find_assignment(db, assignment_id)
    assert updated is not None
    return MyShift(updated, shift)


def check_out(db: Session, member_id: uuid.UUID, assignment_id: uuid.UUID, ip: str) -> MyShift:
    assignment, shift = _mine(db, member_id, assignment_id)
    if assignment.checked_in_at is None:
        raise RosterRefused("not_checked_in")
    if assignment.checked_out_at is not None:
        raise RosterRefused("already_checked_out")
    repository.update_assignment(db, assignment_id, {"checked_out_at": datetime.now(UTC)})
    audit.record(db, actor_id=member_id, action="election.roster.checked_out", target_type="roster_shift",
                 target_id=str(shift.id), area_path=_path(shift.area_path), ip=ip)
    db.commit()
    updated = repository.find_assignment(db, assignment_id)
    assert updated is not None
    return MyShift(updated, shift)
