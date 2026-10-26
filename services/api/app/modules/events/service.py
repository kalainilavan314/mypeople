"""Events, RSVPs, event passes, check-in and the attendance roster (BRD E01 to E06, GAP-03, S09;
FR-EVT-001 to 017, FR-ADM-004, FR-STF-006, BR-057 to BR-062).

Members see every published event; "My area" is the default filter, never a
hidden restriction (BR-057). A response changes the one RSVP record and its
history keeps every earlier one (BR-059). Going becomes waitlisted when the
event is full, and the longest-waiting member takes a place that frees up
(FR-EVT-011 [ASSUMPTION]).

A pass is shown only to a member who is going, while the event is on and,
by OD-12 [ASSUMPTION], only with an Active membership unless the event
admits pending members. Its QR is a 60-second code carrying an opaque pass
reference bound to one event and one member (BR-060). A scan records
attendance once (BR-061) and never reports a check-in it did not record
(BR-062).

Event managers (events.manage) create, edit, publish and cancel events in
their own areas; members going, maybe going or waitlisted are told by SMS
when an event is cancelled or its time or place changes (FR-ADM-004).

Not built yet: the 24-hour reminder (FR-EVT-018, needs scheduled tasks),
notifying a member promoted from the waitlist or after check-in (FR-EVT-015,
notifications batch), the "Volunteer for this event" link (FR-EVT-008,
volunteering batch), My Activity and progress (profile batch), and
event-scoped, time-bound scanning grants for volunteers (OD-12).
"""

import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.rotating_codes import CodeExpired, CodeInvalid, RotatingCode
from app.integrations.sms import SmsSender, SmsUnavailable
from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.events import repository, rules
from app.modules.events.repository import EDITABLE, EventListItem, RosterEntry, RsvpChange, StoredEvent
from app.modules.events.rules import MANAGE, SCAN, Response
from app.modules.identity.recovery import repository as contacts
from app.modules.messaging.notifications import service as notifications


class EventNotFound(Exception):
    pass


class EventRefused(Exception):
    """A member or staff action the event's state does not allow; code is the reason."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class EventInvalid(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


def _now() -> datetime:
    return datetime.now(UTC)


def _area_path(event: StoredEvent) -> AreaPath:
    return tuple(area_from_key(key) for key in event.area_path)


def _published(db: Session, event_id: uuid.UUID, *, for_update: bool = False) -> StoredEvent:
    """An event members may see: published or cancelled, never a draft."""
    event = repository.find_event(db, event_id, for_update=for_update)
    if event is None or event.state == "draft":
        raise EventNotFound()
    return event


# --- Members (E01 to E06) -----------------------------------------------------------------------------


@dataclass(frozen=True)
class EventFilters:
    mine: bool = True  # BR-057: the default, removable
    within_area: str | None = None  # an area key, e.g. "district:LK41" (FR-EVT-005)
    starts_before: datetime | None = None
    event_type: str | None = None
    participation: str | None = None
    search: str | None = None
    limit: int = 50


def list_events(db: Session, member_id: uuid.UUID, filters: EventFilters) -> list[EventListItem]:
    member_areas = [area.key for area in access_repository.member_area_path(db, member_id)]
    items = repository.published_events(
        db,
        member_id=member_id,
        area_keys=member_areas if filters.mine else None,
        starts_from=_now(),
        starts_before=filters.starts_before,
        event_type=filters.event_type,
        search=filters.search,
        participation=filters.participation,
        limit=filters.limit,
    )
    if filters.within_area is None:
        return items
    return [item for item in items if filters.within_area in item.event.area_path]


@dataclass(frozen=True)
class EventDetail:
    event: StoredEvent
    my_response: str | None
    my_history: list[RsvpChange]
    attended_at: datetime | None


def event_detail(db: Session, member_id: uuid.UUID, event_id: uuid.UUID) -> EventDetail:
    event = _published(db, event_id)
    rsvp = repository.find_rsvp(db, event_id, member_id)
    return EventDetail(
        event=event,
        my_response=rsvp.response if rsvp else None,
        my_history=repository.rsvp_history(db, event_id, member_id),
        attended_at=repository.attended_at(db, event_id, member_id),
    )


def respond(db: Session, member_id: uuid.UUID, event_id: uuid.UUID, response: Response) -> str:
    """Going, maybe or declined, with no reason asked for declining (FR-EVT-009). Returns the
    state recorded: going, maybe, declined or waitlisted."""
    event = _published(db, event_id, for_update=True)  # the lock keeps capacity exact
    problem = rules.check_rsvp(event.state, event.ends_at, _now())
    if problem:
        raise EventRefused(problem)
    current = repository.find_rsvp(db, event_id, member_id)
    previous = current.response if current else None
    state = rules.rsvp_state(response, previous, event.capacity, event.going)  # type: ignore[arg-type]
    if state != previous:
        repository.save_rsvp(db, event_id, member_id, state)
    if previous == "going" and state != "going" and event.capacity is not None:
        promoted = repository.first_waitlisted(db, event_id)
        if promoted is not None:
            repository.save_rsvp(db, event_id, promoted, "going")
    db.commit()
    return state


@dataclass(frozen=True)
class EventPass:
    event: StoredEvent
    attended_at: datetime | None


def _pass_problem(db: Session, member_id: uuid.UUID, event: StoredEvent) -> str | None:
    rsvp = repository.find_rsvp(db, event.id, member_id)
    status = access_repository.find_member_status(db, member_id)
    return rules.pass_problem(
        state=event.state,
        checkin_closes_at=event.checkin_closes_at,
        response=rsvp.response if rsvp else None,  # type: ignore[arg-type]
        membership_active=bool(status and status.membership_active),
        admits_pending=event.admits_pending,
        now=_now(),
    )


def my_pass(db: Session, member_id: uuid.UUID, event_id: uuid.UUID) -> EventPass:
    """E06: what the pass shows besides its QR (FR-EVT-014)."""
    event = _published(db, event_id)
    problem = _pass_problem(db, member_id, event)
    if problem:
        raise EventRefused(problem)
    return EventPass(event=event, attended_at=repository.attended_at(db, event_id, member_id))


def my_pass_code(db: Session, member_id: uuid.UUID, event_id: uuid.UUID, jwt_secret: str) -> RotatingCode:
    """A new 60-second code; ask again when it expires (FR-EVT-013, 017)."""
    event = _published(db, event_id)
    problem = _pass_problem(db, member_id, event)
    if problem:
        raise EventRefused(problem)
    ref = repository.pass_ref(db, event_id, member_id)
    db.commit()
    return rules.PASS.sign(ref, jwt_secret, int(time.time()))


# --- Event managers (GAP-03, FR-ADM-004) ------------------------------------------------------------------


def _check_scope(db: Session, staff: Staff, permission: str, area_path: AreaPath, target: tuple[str, str], ip: str) -> None:
    if not access.has_permission_over(staff, permission, area_path):
        access.refuse(db, staff, permission, "outside_your_area", ip, target=target, area_path=area_path)


def _managed(db: Session, staff: Staff, event_id: uuid.UUID, ip: str, *, permission: str = MANAGE) -> StoredEvent:
    event = repository.find_event(db, event_id, for_update=True)
    if event is None:
        raise EventNotFound()
    _check_scope(db, staff, permission, _area_path(event), ("event", str(event.id)), ip)
    return event


def _record(db: Session, staff: Staff, action: str, event: StoredEvent, ip: str, **details: object) -> None:
    audit.record(
        db,
        actor_id=staff.member_id,
        action=action,
        target_type="event",
        target_id=str(event.id),
        area_path=_area_path(event),
        details={"eventRef": event.event_ref, **details},
        ip=ip,
    )


def _validate(details: dict[str, Any]) -> None:
    problems = rules.check_event(
        event_type=details["event_type"],
        starts_at=details["starts_at"],
        ends_at=details["ends_at"],
        checkin_opens_at=details["checkin_opens_at"],
        checkin_closes_at=details["checkin_closes_at"],
    )
    if problems:
        raise EventInvalid(problems)


def create_event(db: Session, staff: Staff, details: dict[str, Any], area: Area, ip: str) -> StoredEvent:
    """A draft in an area where the person holds events.manage. The check-in window defaults to
    an hour before the start until the end."""
    path = access_repository.area_path(db, area)
    if path is None:
        raise EventInvalid(["unknown_area"])
    _check_scope(db, staff, MANAGE, path, ("event", "new"), ip)
    if details.get("checkin_opens_at") is None or details.get("checkin_closes_at") is None:
        opens, closes = rules.checkin_window(details["starts_at"], details["ends_at"])
        details = {**details, "checkin_opens_at": details.get("checkin_opens_at") or opens,
                   "checkin_closes_at": details.get("checkin_closes_at") or closes}
    _validate(details)
    event = repository.insert_event(
        db, details=details, area_key=area.key, area_path=[a.key for a in path], created_by=staff.member_id
    )
    _record(db, staff, "events.event.created", event, ip)
    db.commit()
    return event


# Changes members going to an event must hear about (FR-ADM-004).
NOTIFIED_CHANGES = frozenset({"starts_at", "ends_at", "venue", "meeting_point"})


@dataclass(frozen=True)
class Notice:
    phones: list[str]
    text: str


def _notice(db: Session, event: StoredEvent, text: str, key: str) -> Notice:
    """An inbox notice for everyone who responded, in this transaction, and the SMS to send after."""
    phones = []
    for member_id in repository.members_to_notify(db, event.id):
        notifications.notify(db, member_id, key, event.id, body_en=event.title_en, body_ta=event.title_ta)
        contact = contacts.find_contact(db, member_id)
        if contact is not None:
            phones.append(contact.phone)
    return Notice(phones=phones, text=text)


def update_event(
    db: Session, staff: Staff, event_id: uuid.UUID, changes: dict[str, Any], ip: str
) -> tuple[StoredEvent, Notice | None]:
    """Edit a draft or published event; the area stays as created. Members are told when a
    published event's time or place changes."""
    event = _managed(db, staff, event_id, ip)
    problem = rules.check_transition("edit", event.state)
    if problem:
        raise EventRefused(problem)
    changed = {name: value for name, value in changes.items() if getattr(event, name) != value}
    if not changed:
        return event, None
    merged = {name: getattr(event, name) for name in EDITABLE} | changed
    _validate(merged)
    repository.update_event(db, event_id, changed, staff.member_id)
    _record(db, staff, "events.event.updated", event, ip, changed=sorted(changed))
    notice = None
    if event.state == "published" and NOTIFIED_CHANGES & changed.keys():
        notice = _notice(db, event, rules.changed_message(merged["title_en"], merged["title_ta"]), "event_changed")
    db.commit()
    updated = repository.find_event(db, event_id)
    assert updated is not None
    return updated, notice


def publish_event(db: Session, staff: Staff, event_id: uuid.UUID, ip: str) -> StoredEvent:
    event = _managed(db, staff, event_id, ip)
    problem = rules.check_transition("publish", event.state)
    if problem:
        raise EventRefused(problem)
    repository.publish(db, event_id, staff.member_id)
    _record(db, staff, "events.event.published", event, ip)
    db.commit()
    published = repository.find_event(db, event_id)
    assert published is not None
    return published


def cancel_event(
    db: Session, staff: Staff, event_id: uuid.UUID, reason: str, ip: str
) -> tuple[StoredEvent, Notice | None]:
    """Cancel with a reason; every pass stops working, and members who responded are told."""
    event = _managed(db, staff, event_id, ip)
    problem = rules.check_transition("cancel", event.state)
    if problem:
        raise EventRefused(problem)
    notice = None
    if event.state == "published":
        notice = _notice(db, event, rules.cancelled_message(event.title_en, event.title_ta), "event_cancelled")
    repository.cancel(db, event_id, staff.member_id, reason)
    # The reason stays on the event; the audit entry holds ids only.
    _record(db, staff, "events.event.cancelled", event, ip)
    db.commit()
    cancelled = repository.find_event(db, event_id)
    assert cancelled is not None
    return cancelled, notice


def deliver(sms: SmsSender, notice: Notice) -> None:
    """Sent after the response. Best effort: a notice that cannot be sent does not undo the change."""
    for phone in notice.phones:
        try:
            sms.send(phone, notice.text)
        except SmsUnavailable:
            return


def managed_events(db: Session, staff: Staff, states: list[str], limit: int) -> list[StoredEvent]:
    return repository.managed_events(db, visible_areas=access.visible_areas(staff, MANAGE), states=states, limit=limit)


def managed_event(db: Session, staff: Staff, event_id: uuid.UUID, ip: str) -> StoredEvent:
    event = repository.find_event(db, event_id)
    if event is None:
        raise EventNotFound()
    _check_scope(db, staff, MANAGE, _area_path(event), ("event", str(event.id)), ip)
    return event


# --- Check-in and the roster (GAP-01 scanning, S09, FR-EVT-015 to 017, FR-STF-006) ---------------------------


@dataclass(frozen=True)
class CheckIn:
    result: rules.ScanResult
    full_name: str | None = None  # shown for checked_in and already_checked_in only
    member_code: str | None = None
    attended_at: datetime | None = None


def scan(db: Session, staff: Staff, event_id: uuid.UUID, code: str, jwt_secret: str, ip: str) -> CheckIn:
    event = _managed(db, staff, event_id, ip, permission=SCAN)
    reason = None
    member_id = None
    try:
        ref = rules.PASS.read(code, jwt_secret, int(time.time()))
        found = repository.rsvp_by_pass_ref(db, ref)
        if found is not None and found[1] == staff.member_id:
            reason = "own_pass"  # nobody checks themselves in (BR-085)
            found = None
        pass_event_id, member_id = found if found else (None, None)
        now = _now()
        result = rules.scan_result(
            pass_event_id=pass_event_id,
            scanned_event_id=event.id,
            within_window=event.state == "published" and event.checkin_opens_at <= now <= event.checkin_closes_at,
            already_attended=member_id is not None and repository.attended_at(db, event.id, member_id) is not None,
        )
        if result == "checked_in" and not repository.record_attendance(db, event.id, member_id, staff.member_id):  # type: ignore[arg-type]
            result = "already_checked_in"  # another scanner was a moment faster
    except CodeExpired:
        result = "expired"
    except CodeInvalid:
        result = "not_valid"
    _record(
        db, staff, "events.attendance.scanned", event, ip,
        result=result, reason=reason, memberId=str(member_id) if member_id else None,
    )
    db.commit()
    if result not in ("checked_in", "already_checked_in") or member_id is None:
        return CheckIn(result=result)
    full_name, member_code = repository.member_name(db, member_id)
    return CheckIn(
        result=result,
        full_name=full_name,
        member_code=member_code,
        attended_at=repository.attended_at(db, event.id, member_id),
    )


@dataclass(frozen=True)
class Roster:
    event: StoredEvent
    expected: int  # going now
    attended: int
    entries: list[RosterEntry]


def attendance_roster(db: Session, staff: Staff, event_id: uuid.UUID, ip: str) -> Roster:
    """For an event in the person's scope, as manager or as scanner (FR-STF-006)."""
    event = repository.find_event(db, event_id)
    if event is None:
        raise EventNotFound()
    path = _area_path(event)
    if not (access.has_permission_over(staff, MANAGE, path) or access.has_permission_over(staff, SCAN, path)):
        access.refuse(db, staff, SCAN, "outside_your_area", ip, target=("event", str(event.id)), area_path=path)
    entries = repository.roster(db, event_id)
    return Roster(
        event=event,
        expected=event.going,
        attended=sum(1 for entry in entries if entry.attended_at is not None),
        entries=entries,
    )
