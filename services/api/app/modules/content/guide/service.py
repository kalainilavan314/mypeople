"""Welfare, jobs and livelihood guide (BRD M39, M40, D28; FR-LIV-001 to 006, BR-142).

One trusted place to find public help, jobs and training. Editors draft entries in Tamil and
English; a second person reviews each one before it is published, and an entry leaves the list
the day after its end date. Members search the published entries, read each with its source,
dates and the eligibility disclaimer, and report an entry that looks outdated; the report reaches
the editors' queue with the entry's link. Changing a published entry takes it off the guide until
it is reviewed again, so members never read unreviewed wording.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE
from app.modules.access.service import AccessRefused, Staff, refuse
from app.modules.audit import service as audit
from app.modules.content.guide import repository, rules
from app.modules.content.guide.repository import Entry, Report
from app.modules.messaging.notifications import service as notifications


class GuideRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class GuideNotFound(Exception):
    pass


def today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()


def _values(entry: Entry) -> dict[str, Any]:
    return {name: getattr(entry, name) for name in repository.FIELDS}


# --- Members (M39, M40) -------------------------------------------------------------------------


def search(db: Session, query: str | None, category: str | None) -> list[Entry]:
    return repository.published(db, today=today(), category=category, pattern=rules.search_pattern(query))


@dataclass(frozen=True)
class MemberView:
    entry: Entry
    my_open_report: Report | None


def member_view(db: Session, member_id: uuid.UUID, entry_id: uuid.UUID) -> MemberView:
    entry = repository.find(db, entry_id)
    if entry is None or entry.state != "published" or rules.is_expired(entry.expires_on, today()):
        raise GuideNotFound()
    return MemberView(entry, repository.open_report_of(db, entry_id, member_id))


def report(db: Session, member_id: uuid.UUID, entry_id: uuid.UUID, reason: str, note: str | None, ip: str) -> Report:
    """FR-LIV-006: the editors get the report with the entry's link (the notice opens the entry)."""
    member_view(db, member_id, entry_id)
    if repository.open_report_of(db, entry_id, member_id) is not None:
        raise GuideRefused("already_reported")
    try:
        report_id = repository.insert_report(db, entry_id, member_id, reason, (note or "").strip() or None)
    except IntegrityError:
        db.rollback()  # the same member reporting twice at the same moment
        raise GuideRefused("already_reported") from None
    for editor in repository.permission_holders(db, rules.EDIT):
        notifications.notify(db, editor, "guide_entry_reported", entry_id)
    audit.record(db, actor_id=member_id, action="guide.entry.reported", target_type="guide_entry",
                 target_id=str(entry_id), details={"reason": reason}, ip=ip)
    db.commit()
    found = repository.find_report(db, report_id)
    assert found is not None
    return found


# --- Content editors and reviewers (D28) --------------------------------------------------------


def _holds(staff: Staff, permission: str) -> bool:
    # [ASSUMPTION] Like PRM-47, the guide is one platform-wide list: the permission counts in any area.
    return access_rules.holds(staff.rule_assignments(), permission)


def _require_any(staff: Staff) -> None:
    if not (_holds(staff, rules.EDIT) or _holds(staff, rules.REVIEW)):
        raise AccessRefused("forbidden")


def _require(staff: Staff, permission: str) -> None:
    if not _holds(staff, permission):
        raise AccessRefused("forbidden")


def managed(db: Session, staff: Staff, state: str | None, expired_only: bool, query: str | None) -> list[Entry]:
    _require_any(staff)
    return repository.managed(db, state=state, expired_only=expired_only, today=today(),
                              pattern=rules.search_pattern(query))


@dataclass(frozen=True)
class StaffView:
    entry: Entry
    reports: list[Report]


def staff_view(db: Session, staff: Staff, entry_id: uuid.UUID) -> StaffView:
    _require_any(staff)
    entry = repository.find(db, entry_id)
    if entry is None:
        raise GuideNotFound()
    return StaffView(entry, repository.reports(db, state=None, entry_id=entry_id))


def _found(db: Session, entry_id: uuid.UUID) -> Entry:
    entry = repository.find(db, entry_id)
    assert entry is not None
    return entry


def save(db: Session, staff: Staff, entry_id: uuid.UUID | None, values: dict[str, Any], ip: str) -> Entry:
    """A draft may be incomplete; it is checked in full when review is asked for (FR-LIV-002, 005)."""
    _require(staff, rules.EDIT)
    clean = {name: (value.strip() or None) if isinstance(value, str) else value for name, value in values.items()}
    problems = rules.check_wording(clean)
    if problems:
        raise GuideRefused(problems)
    if entry_id is None:
        entry_id = repository.insert(db, clean, staff.member_id)
        action = "guide.entry.drafted"
    else:
        entry = repository.find(db, entry_id, lock=True)
        if entry is None:
            raise GuideNotFound()
        if entry.state == "withdrawn":
            raise GuideRefused("not_allowed_from:withdrawn")
        # A change to a published or waiting entry goes back through review (FR-LIV-003).
        repository.update(db, entry_id, {**{name: clean.get(name) for name in repository.FIELDS}, "state": "draft",
                                         "updated_by": staff.member_id, "review_requested_by": None,
                                         "reviewed_by": None})
        if entry.state == "in_review":
            notifications.complete_action(db, "guide_review", entry_id)
        action = "guide.entry.changed" if entry.state == "published" else "guide.entry.draft_saved"
    audit.record(db, actor_id=staff.member_id, action=action, target_type="guide_entry", target_id=str(entry_id), ip=ip)
    db.commit()
    return _found(db, entry_id)


def request_review(db: Session, staff: Staff, entry_id: uuid.UUID, ip: str) -> Entry:
    _require(staff, rules.EDIT)
    entry = repository.find(db, entry_id, lock=True)
    if entry is None:
        raise GuideNotFound()
    if entry.state != "draft":
        raise GuideRefused(f"not_allowed_from:{entry.state}")
    problems = rules.check_publishable(_values(entry), today())
    if problems:
        raise GuideRefused(problems)
    repository.update(db, entry_id, {"state": "in_review", "review_requested_by": staff.member_id, "review_note": None})
    for reviewer in repository.permission_holders(db, rules.REVIEW):
        if reviewer not in (staff.member_id, entry.updated_by):
            notifications.notify(db, reviewer, "guide_review_needed", entry_id)
    audit.record(db, actor_id=staff.member_id, action="guide.entry.review_requested", target_type="guide_entry",
                 target_id=str(entry_id), ip=ip)
    db.commit()
    return _found(db, entry_id)


def review(db: Session, staff: Staff, entry_id: uuid.UUID, approve: bool, note: str | None, ip: str) -> Entry:
    """FR-LIV-003: a second person publishes, or returns the entry with a reason."""
    _require(staff, rules.REVIEW)
    entry = repository.find(db, entry_id, lock=True)
    if entry is None:
        raise GuideNotFound()
    if entry.state != "in_review":
        raise GuideRefused(f"not_allowed_from:{entry.state}")
    if rules.check_reviewer(staff.member_id, entry.updated_by, entry.review_requested_by):
        refuse(db, staff, rules.REVIEW, "own_entry", ip, target=("guide_entry", str(entry_id)), area_path=None)
    note = (note or "").strip() or None
    if approve:
        # Checked again: the end date may have passed while it waited.
        problems = rules.check_publishable(_values(entry), today())
        if problems:
            raise GuideRefused(problems)
        repository.update(db, entry_id, {"state": "published", "reviewed_by": staff.member_id, "review_note": note,
                                         "published_at": datetime.now(UTC)})
    else:
        if note is None or len(note) < 3:
            raise GuideRefused("reason_required")
        repository.update(db, entry_id, {"state": "draft", "review_requested_by": None, "reviewed_by": None,
                                         "review_note": note})
    notifications.complete_action(db, "guide_review", entry_id)
    audit.record(db, actor_id=staff.member_id, action="guide.entry.published" if approve else "guide.entry.returned",
                 target_type="guide_entry", target_id=str(entry_id), ip=ip)
    db.commit()
    return _found(db, entry_id)


def mark_verified(db: Session, staff: Staff, entry_id: uuid.UUID, ip: str) -> Entry:
    """An editor checked the published entry against its source today; the wording is unchanged."""
    _require(staff, rules.EDIT)
    entry = repository.find(db, entry_id, lock=True)
    if entry is None:
        raise GuideNotFound()
    if entry.state != "published":
        raise GuideRefused(f"not_allowed_from:{entry.state}")
    repository.update(db, entry_id, {"verified_on": today(), "verified_by": staff.member_id})
    audit.record(db, actor_id=staff.member_id, action="guide.entry.verified", target_type="guide_entry",
                 target_id=str(entry_id), ip=ip)
    db.commit()
    return _found(db, entry_id)


def withdraw(db: Session, staff: Staff, entry_id: uuid.UUID, reason: str, ip: str) -> Entry:
    """Taken off the guide for good (the scheme ended early, or it was wrong); the record stays."""
    if not (_holds(staff, rules.EDIT) or _holds(staff, rules.REVIEW)):
        raise AccessRefused("forbidden")
    entry = repository.find(db, entry_id, lock=True)
    if entry is None:
        raise GuideNotFound()
    if entry.state == "withdrawn":
        raise GuideRefused("not_allowed_from:withdrawn")
    reason = reason.strip()
    if len(reason) < 3:
        raise GuideRefused("reason_required")
    repository.update(db, entry_id, {"state": "withdrawn", "withdrawn_reason": reason, "updated_by": staff.member_id})
    notifications.complete_action(db, "guide_review", entry_id)
    audit.record(db, actor_id=staff.member_id, action="guide.entry.withdrawn", target_type="guide_entry",
                 target_id=str(entry_id), ip=ip)
    db.commit()
    return _found(db, entry_id)


def report_queue(db: Session, staff: Staff, state: str | None) -> list[Report]:
    _require_any(staff)
    return repository.reports(db, state=state, entry_id=None)


def resolve_report(db: Session, staff: Staff, report_id: uuid.UUID, outcome: str, note: str | None, ip: str) -> Report:
    """The reporter is told it was checked; who reported is never shown to editors."""
    _require(staff, rules.EDIT)
    item = repository.find_report(db, report_id, lock=True)
    if item is None:
        raise GuideNotFound()
    if item.state != "open":
        raise GuideRefused("already_resolved")
    note = (note or "").strip() or None
    if outcome == "dismissed" and (note is None or len(note) < 3):
        raise GuideRefused("reason_required")
    repository.resolve_report(db, report_id, outcome, note, staff.member_id)
    notifications.notify(db, item.member_id, "guide_report_closed", item.entry_id)
    if not repository.reports(db, state="open", entry_id=item.entry_id):
        notifications.complete_action(db, "guide_entry", item.entry_id)
    audit.record(db, actor_id=staff.member_id, action="guide.report.resolved", target_type="guide_entry",
                 target_id=str(item.entry_id), details={"outcome": outcome}, ip=ip)
    db.commit()
    found = repository.find_report(db, report_id)
    assert found is not None
    return found
