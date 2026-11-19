"""Meet Your Representative (BRD M41, M42, S17, D29; FR-APT-001 to 007, BR-143, BR-159).

Members book time with the person responsible for their area. Profiles show the official role,
the District, DS or GN covered and the office hours; contact routes appear only once the person
has approved them. Members book a free slot with their contact preference and any accessibility
or language needs, may link a case reference only by ticking consent, cancel or move the booking
before it starts, get reminders 24 hours and 1 hour before, and read the follow-up note the
representative records afterwards. Only the representative sees who booked and what they need;
profile managers see that a slot is taken, never by whom.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE, Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, load_staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.events.appointments import repository, rules
from app.modules.events.appointments.repository import Appointment, Representative, Slot
from app.modules.messaging.notifications import service as notifications


class AppointmentRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class AppointmentNotFound(Exception):
    pass


def _path(representative: Representative) -> AreaPath:
    return tuple(area_from_key(key) for key in representative.area_path)


def _now() -> datetime:
    return datetime.now(UTC)


def _reload(db: Session, appointment_id: uuid.UUID) -> Appointment:
    found = repository.find_appointment(db, appointment_id)
    assert found is not None
    return found


# --- Members (M41, M42) -------------------------------------------------------------------------


@dataclass(frozen=True)
class Listed:
    representative: Representative
    covers_my_area: bool


def directory(db: Session, member_id: uuid.UUID) -> list[Listed]:
    """M41: published profiles, those covering the member's own area first (GN, then DS, then district)."""
    mine = [area.key for area in access_repository.member_area_path(db, member_id)]
    listed = [Listed(r, r.area_key in mine) for r in repository.published(db)]
    depth = {"gn": 0, "ds": 1, "district": 2}
    return sorted(listed, key=lambda item: (not item.covers_my_area, depth.get(item.representative.area_key.split(":")[0], 3),
                                            item.representative.display_name_en))


@dataclass(frozen=True)
class RepresentativeView:
    representative: Representative
    covers_my_area: bool
    free_slots: list[Slot]


def representative_view(db: Session, member_id: uuid.UUID, representative_id: uuid.UUID) -> RepresentativeView:
    representative = repository.find(db, representative_id)
    if representative is None or representative.state != "published":
        raise AppointmentNotFound()
    mine = [area.key for area in access_repository.member_area_path(db, member_id)]
    free = repository.slots(db, representative_id, since=_now(), until=None, free_only=True)
    return RepresentativeView(representative, representative.area_key in mine, free)


def _bookable(db: Session, representative: Representative | None) -> Representative:
    """A published profile whose person still holds PRM-56, so the booking reaches someone."""
    if representative is None or representative.state != "published":
        raise AppointmentRefused("representative_unavailable")
    if not access_rules.holds(load_staff(db, representative.member_id).rule_assignments(), rules.MANAGE_OWN):
        raise AppointmentRefused("representative_unavailable")
    return representative


def book(db: Session, member_id: uuid.UUID, values: dict[str, Any], ip: str) -> Appointment:
    slot = repository.find_slot(db, values["slot_id"], lock=True)
    if slot is None:
        raise AppointmentNotFound()
    representative = _bookable(db, repository.find(db, slot.representative_id))
    status = access_repository.find_member_status(db, member_id)
    everyone, this_one = repository.upcoming_counts(db, member_id, representative.id)
    phone = rules.normalise_phone(values.get("contact_phone"))
    case_ref = rules.normalise_case_ref(values.get("case_ref"))
    consent = bool(values.get("case_link_consent"))
    problems = rules.check_booking(
        identity_verified=bool(status and status.identity_verified),
        membership_active=bool(status and status.membership_active),
        own_calendar=representative.member_id == member_id, slot_open=slot.state == "open",
        slot_starts_at=slot.starts_at, now=_now(), slot_taken=slot.booking_id is not None, upcoming=everyone,
        upcoming_with_representative=this_one, contact_preference=values["contact_preference"], contact_phone=phone,
        case_ref=case_ref, case_consent=consent,
    )
    if problems:
        raise AppointmentRefused(problems)
    stored_case = rules.stored_case_ref(case_ref, consent)
    try:
        appointment_id = repository.insert_appointment(db, {
            "slot_id": slot.id, "representative_id": representative.id, "member_id": member_id,
            "topic": values["topic"].strip(), "contact_preference": values["contact_preference"],
            "contact_phone": rules.stored_phone(values["contact_preference"], phone),
            "needs": sorted(set(values.get("needs") or [])), "needs_note": (values.get("needs_note") or "").strip() or None,
            "case_ref": stored_case, "case_consent_at": _now() if stored_case else None,
        })
    except IntegrityError:
        db.rollback()  # someone else took the slot a moment earlier
        raise AppointmentRefused("slot_taken") from None
    notifications.notify(db, representative.member_id, "appointment_booked", appointment_id)
    audit.record(db, actor_id=member_id, action="appointment.booked", target_type="appointment",
                 target_id=str(appointment_id), area_path=_path(representative),
                 details={"caseLinked": stored_case is not None}, ip=ip)
    db.commit()
    return _reload(db, appointment_id)


def mine(db: Session, member_id: uuid.UUID) -> list[Appointment]:
    return repository.member_appointments(db, member_id)


def my_appointment(db: Session, member_id: uuid.UUID, appointment_id: uuid.UUID, *, lock: bool = False) -> Appointment:
    appointment = repository.find_appointment(db, appointment_id, lock=lock)
    if appointment is None or appointment.member_id != member_id:
        raise AppointmentNotFound()
    return appointment


def cancel_mine(db: Session, member_id: uuid.UUID, appointment_id: uuid.UUID, reason: str | None, ip: str) -> Appointment:
    appointment = my_appointment(db, member_id, appointment_id, lock=True)
    problem = rules.can_change(appointment.state, appointment.starts_at, _now())
    if problem:
        raise AppointmentRefused(problem)
    repository.update_appointment(db, appointment_id, {
        "state": "cancelled", "cancelled_by": "member", "cancelled_at": _now(),
        "cancel_reason": (reason or "").strip() or None,
    })
    notifications.notify(db, appointment.representative_member_id, "appointment_cancelled_by_member", appointment_id)
    audit.record(db, actor_id=member_id, action="appointment.cancelled", target_type="appointment",
                 target_id=str(appointment_id), details={"by": "member"}, ip=ip)
    db.commit()
    return _reload(db, appointment_id)


def reschedule(db: Session, member_id: uuid.UUID, appointment_id: uuid.UUID, slot_id: uuid.UUID, ip: str) -> Appointment:
    """M42: move to another free slot of the same representative; reminders start again."""
    appointment = my_appointment(db, member_id, appointment_id, lock=True)
    problem = rules.can_change(appointment.state, appointment.starts_at, _now())
    if problem:
        raise AppointmentRefused(problem)
    slot = repository.find_slot(db, slot_id, lock=True)
    if slot is None or slot.representative_id != appointment.representative_id:
        raise AppointmentRefused("slot_unavailable")
    _bookable(db, repository.find(db, appointment.representative_id))
    if slot.id == appointment.slot_id:
        raise AppointmentRefused("same_slot")
    if slot.state != "open" or slot.starts_at <= _now():
        raise AppointmentRefused("slot_unavailable")
    if slot.booking_id is not None:
        raise AppointmentRefused("slot_taken")
    try:
        repository.update_appointment(db, appointment_id, {"slot_id": slot.id, "booked_at": _now(),
                                                           "reminded_day_at": None, "reminded_hour_at": None})
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppointmentRefused("slot_taken") from None
    notifications.notify(db, appointment.representative_member_id, "appointment_moved", appointment_id)
    audit.record(db, actor_id=member_id, action="appointment.moved", target_type="appointment",
                 target_id=str(appointment_id), ip=ip)
    db.commit()
    return _reload(db, appointment_id)


# --- The representative's own calendar (S17; PRM-56) --------------------------------------------


def _own_profile(db: Session, staff: Staff) -> Representative:
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE_OWN):
        raise AccessRefused("forbidden")
    representative = repository.find_by_member(db, staff.member_id)
    if representative is None:
        raise AppointmentRefused("no_profile")
    return representative


@dataclass(frozen=True)
class CalendarView:
    representative: Representative | None
    slots: list[Slot]
    bookings: dict[uuid.UUID, Appointment]  # by slot, the live booking or the latest cancelled one
    names: dict[uuid.UUID, tuple[str, str]]


def calendar(db: Session, staff: Staff, since: date | None, days: int) -> CalendarView:
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE_OWN):
        raise AccessRefused("forbidden")
    representative = repository.find_by_member(db, staff.member_id)
    if representative is None:
        return CalendarView(None, [], {}, {})
    start_day = since or (_now().astimezone(LOCAL_ZONE).date() - timedelta(days=7))
    start = datetime.combine(start_day, time(0, 0), tzinfo=LOCAL_ZONE)
    slots = repository.slots(db, representative.id, since=start, until=start + timedelta(days=days), free_only=False)
    bookings: dict[uuid.UUID, Appointment] = {}
    for appointment in repository.representative_appointments(db, representative.id, [s.id for s in slots]):
        current = bookings.get(appointment.slot_id)
        if current is None or current.state == "cancelled":
            bookings[appointment.slot_id] = appointment
    names = repository.member_names(db, sorted({a.member_id for a in bookings.values()}))
    return CalendarView(representative, slots, bookings, names)


def own_booking(db: Session, staff: Staff, appointment_id: uuid.UUID, *, lock: bool = False) -> tuple[Appointment, tuple[str, str]]:
    representative = _own_profile(db, staff)
    appointment = repository.find_appointment(db, appointment_id, lock=lock)
    if appointment is None or appointment.representative_id != representative.id:
        raise AppointmentNotFound()
    return appointment, repository.member_names(db, [appointment.member_id]).get(appointment.member_id, ("", ""))


def update_own_profile(db: Session, staff: Staff, values: dict[str, Any], publish_contacts: bool, ip: str) -> Representative:
    """The person edits their own office hours and contact routes; ticking "show" is their approval (BR-143)."""
    representative = _own_profile(db, staff)
    if representative.state == "withdrawn":
        raise AppointmentRefused("not_allowed_from:withdrawn")
    contacts = {name: _clean(values.get(name)) for name in repository.CONTACT_FIELDS}
    contacts["public_phone"] = rules.normalise_phone(contacts["public_phone"])
    problems = rules.check_contacts(contacts)
    if problems:
        raise AppointmentRefused(problems)
    if publish_contacts and not any(contacts.values()):
        raise AppointmentRefused("no_contacts")
    repository.update(db, representative.id, {
        "office_hours_en": values["office_hours_en"].strip(), "office_hours_ta": values["office_hours_ta"].strip(),
        **contacts, "contacts_approved_at": _now() if publish_contacts else None, "updated_by": staff.member_id,
    })
    notifications.complete_action(db, "appointment_calendar", representative.id)
    audit.record(db, actor_id=staff.member_id, action="representative.profile.own_updated", target_type="representative",
                 target_id=str(representative.id), area_path=_path(representative),
                 details={"contactsShown": publish_contacts}, ip=ip)
    db.commit()
    found = repository.find(db, representative.id)
    assert found is not None
    return found


def approve_contacts(db: Session, staff: Staff, approve: bool, ip: str) -> Representative:
    representative = _own_profile(db, staff)
    if approve and not any(getattr(representative, name) for name in repository.CONTACT_FIELDS):
        raise AppointmentRefused("no_contacts")
    repository.update(db, representative.id, {"contacts_approved_at": _now() if approve else None})
    notifications.complete_action(db, "appointment_calendar", representative.id)
    audit.record(db, actor_id=staff.member_id,
                 action="representative.contacts.approved" if approve else "representative.contacts.withdrawn",
                 target_type="representative", target_id=str(representative.id), area_path=_path(representative), ip=ip)
    db.commit()
    found = repository.find(db, representative.id)
    assert found is not None
    return found


def add_own_slots(db: Session, staff: Staff, series: dict[str, Any], ip: str) -> list[Slot]:
    return _add_slots(db, staff.member_id, _own_profile(db, staff), series, ip)


def withdraw_own_slot(db: Session, staff: Staff, slot_id: uuid.UUID, reason: str, ip: str) -> Slot:
    return _withdraw_slot(db, staff.member_id, _own_profile(db, staff), slot_id, reason, ip)


def cancel_booking(db: Session, staff: Staff, appointment_id: uuid.UUID, reason: str, ip: str) -> Appointment:
    appointment, _ = own_booking(db, staff, appointment_id, lock=True)
    problem = rules.can_change(appointment.state, appointment.starts_at, _now())
    if problem:
        raise AppointmentRefused(problem)
    repository.update_appointment(db, appointment_id, {"state": "cancelled", "cancelled_by": "representative",
                                                       "cancelled_at": _now(), "cancel_reason": reason.strip()})
    notifications.notify(db, appointment.member_id, "appointment_cancelled", appointment_id)
    audit.record(db, actor_id=staff.member_id, action="appointment.cancelled", target_type="appointment",
                 target_id=str(appointment_id), details={"by": "representative"}, ip=ip)
    db.commit()
    return _reload(db, appointment_id)


def follow_up(db: Session, staff: Staff, appointment_id: uuid.UUID, outcome: str, note: str | None, ip: str) -> Appointment:
    """FR-APT-006: the note is shown to the member on the appointment and in My Activity."""
    appointment, _ = own_booking(db, staff, appointment_id, lock=True)
    note = (note or "").strip() or None
    problems = rules.check_follow_up(state=appointment.state, starts_at=appointment.starts_at, now=_now(),
                                     outcome=outcome, note=note)
    if problems:
        raise AppointmentRefused(problems)
    if note is not None and len(note) < 5:
        raise AppointmentRefused("note_too_short")
    repository.update_appointment(db, appointment_id, {"state": outcome, "follow_up_note": note,
                                                       "follow_up_by": staff.member_id, "follow_up_at": _now()})
    if note is not None:
        notifications.notify(db, appointment.member_id, "appointment_follow_up", appointment_id)
    audit.record(db, actor_id=staff.member_id, action="appointment.followed_up", target_type="appointment",
                 target_id=str(appointment_id), details={"outcome": outcome}, ip=ip)
    db.commit()
    return _reload(db, appointment_id)


# --- Profiles and slots for the areas (D29) -----------------------------------------------------


def _clean(value: object) -> str | None:
    return (value.strip() or None) if isinstance(value, str) else None


def _require_area(db: Session, staff: Staff, path: AreaPath, ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE_PROFILES, path):
        refuse(db, staff, rules.MANAGE_PROFILES, "outside_your_area", ip, target=("representative", target), area_path=path)


def profiles(db: Session, staff: Staff, state: str | None) -> list[Representative]:
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE_PROFILES):
        raise AccessRefused("forbidden")
    return repository.managed(db, visible_areas(staff, rules.MANAGE_PROFILES), state)


@dataclass(frozen=True)
class ProfileView:
    representative: Representative
    slots: list[Slot]
    holds_calendar_permission: bool


def profile_view(db: Session, staff: Staff, representative_id: uuid.UUID) -> ProfileView:
    representative = repository.find(db, representative_id)
    if representative is None or not access_rules.holds(staff.rule_assignments(), rules.MANAGE_PROFILES,
                                                        _path(representative)):
        raise AppointmentNotFound()
    since = _now() - timedelta(days=7)
    return ProfileView(representative, repository.slots(db, representative_id, since=since, until=None, free_only=False),
                       access_rules.holds(load_staff(db, representative.member_id).rule_assignments(), rules.MANAGE_OWN))


def create_profile(db: Session, staff: Staff, member_code: str, values: dict[str, Any], area: Area, ip: str) -> Representative:
    path = access_repository.area_path(db, area)
    if path is None:
        raise AppointmentRefused("unknown_area")
    _require_area(db, staff, path, ip, "new")
    member_id = repository.member_by_code(db, member_code)
    if member_id is None:
        raise AppointmentRefused("unknown_member_code")
    if repository.find_by_member(db, member_id) is not None:
        raise AppointmentRefused("profile_exists")
    clean = {name: _clean(values.get(name)) for name in (*repository.PROFILE_FIELDS, *repository.CONTACT_FIELDS)}
    clean["public_phone"] = rules.normalise_phone(clean["public_phone"])
    problems = rules.check_contacts(clean)
    if problems:
        raise AppointmentRefused(problems)
    representative_id = repository.insert(db, member_id, clean, area.key, [a.key for a in path], staff.member_id)
    if any(clean[name] for name in repository.CONTACT_FIELDS):
        notifications.notify(db, member_id, "representative_contacts_approval", representative_id)
    audit.record(db, actor_id=staff.member_id, action="representative.profile.drafted", target_type="representative",
                 target_id=str(representative_id), area_path=path, ip=ip)
    db.commit()
    found = repository.find(db, representative_id)
    assert found is not None
    return found


def update_profile(db: Session, staff: Staff, representative_id: uuid.UUID, values: dict[str, Any], ip: str) -> Representative:
    """A change to the contact routes clears the person's approval and asks them again (BR-143)."""
    representative = repository.find(db, representative_id, lock=True)
    if representative is None:
        raise AppointmentNotFound()
    _require_area(db, staff, _path(representative), ip, str(representative_id))
    if representative.state == "withdrawn":
        raise AppointmentRefused("not_allowed_from:withdrawn")
    clean = {name: _clean(values.get(name)) for name in (*repository.PROFILE_FIELDS, *repository.CONTACT_FIELDS)}
    clean["public_phone"] = rules.normalise_phone(clean["public_phone"])
    problems = rules.check_contacts(clean)
    if problems:
        raise AppointmentRefused(problems)
    before = {name: getattr(representative, name) for name in repository.CONTACT_FIELDS}
    after = {name: clean[name] for name in repository.CONTACT_FIELDS}
    changed = rules.contacts_changed(before, after)
    update: dict[str, Any] = {**clean, "updated_by": staff.member_id}
    if changed:
        update["contacts_approved_at"] = None
        if any(after.values()):
            notifications.notify(db, representative.member_id, "representative_contacts_approval", representative_id)
    repository.update(db, representative_id, update)
    audit.record(db, actor_id=staff.member_id, action="representative.profile.updated", target_type="representative",
                 target_id=str(representative_id), area_path=_path(representative),
                 details={"contactsChanged": changed}, ip=ip)
    db.commit()
    found = repository.find(db, representative_id)
    assert found is not None
    return found


def publish_profile(db: Session, staff: Staff, representative_id: uuid.UUID, ip: str) -> Representative:
    representative = repository.find(db, representative_id, lock=True)
    if representative is None:
        raise AppointmentNotFound()
    _require_area(db, staff, _path(representative), ip, str(representative_id))
    if representative.state == "published":
        raise AppointmentRefused("not_allowed_from:published")
    if not access_rules.holds(load_staff(db, representative.member_id).rule_assignments(), rules.MANAGE_OWN):
        raise AppointmentRefused("representative_lacks_calendar_permission")
    repository.update(db, representative_id, {"state": "published", "withdrawn_reason": None,
                                              "published_by": staff.member_id, "published_at": _now(),
                                              "updated_by": staff.member_id})
    audit.record(db, actor_id=staff.member_id, action="representative.profile.published", target_type="representative",
                 target_id=str(representative_id), area_path=_path(representative), ip=ip)
    db.commit()
    found = repository.find(db, representative_id)
    assert found is not None
    return found


def withdraw_profile(db: Session, staff: Staff, representative_id: uuid.UUID, reason: str, ip: str) -> Representative:
    """The profile leaves the directory; bookings still ahead are cancelled and their members told."""
    representative = repository.find(db, representative_id, lock=True)
    if representative is None:
        raise AppointmentNotFound()
    _require_area(db, staff, _path(representative), ip, str(representative_id))
    if representative.state == "withdrawn":
        raise AppointmentRefused("not_allowed_from:withdrawn")
    reason = reason.strip()
    for slot in repository.slots(db, representative_id, since=_now(), until=None, free_only=False):
        if slot.state == "open" and slot.starts_at > _now():
            _close_slot(db, slot, reason)
    repository.update(db, representative_id, {"state": "withdrawn", "withdrawn_reason": reason,
                                              "updated_by": staff.member_id})
    audit.record(db, actor_id=staff.member_id, action="representative.profile.withdrawn", target_type="representative",
                 target_id=str(representative_id), area_path=_path(representative), ip=ip)
    db.commit()
    found = repository.find(db, representative_id)
    assert found is not None
    return found


def add_slots_for(db: Session, staff: Staff, representative_id: uuid.UUID, series: dict[str, Any], ip: str) -> list[Slot]:
    representative = repository.find(db, representative_id)
    if representative is None:
        raise AppointmentNotFound()
    _require_area(db, staff, _path(representative), ip, str(representative_id))
    return _add_slots(db, staff.member_id, representative, series, ip)


def withdraw_slot_for(db: Session, staff: Staff, representative_id: uuid.UUID, slot_id: uuid.UUID, reason: str,
                      ip: str) -> Slot:
    representative = repository.find(db, representative_id)
    if representative is None:
        raise AppointmentNotFound()
    _require_area(db, staff, _path(representative), ip, str(representative_id))
    return _withdraw_slot(db, staff.member_id, representative, slot_id, reason, ip)


# --- Shared by S17 and D29 ----------------------------------------------------------------------


def _add_slots(db: Session, actor_id: uuid.UUID, representative: Representative, series: dict[str, Any], ip: str) -> list[Slot]:
    """No overlapping slots (S17): checked here for a clear answer, and by the database trigger."""
    if representative.state == "withdrawn":
        raise AppointmentRefused("not_allowed_from:withdrawn")
    starts_at: datetime = series["starts_at"]
    place_en, place_ta = _clean(series.get("place_en")), _clean(series.get("place_ta"))
    problems = rules.check_series(starts_at=starts_at, minutes=series["minutes"], count=series["count"], now=_now(),
                                  mode=series["mode"], place_en=place_en, place_ta=place_ta)
    if problems:
        raise AppointmentRefused(problems)
    wanted = rules.series(starts_at, series["minutes"], series["count"])
    existing = repository.open_slot_times(db, representative.id)
    if any(rules.overlaps(new, old) for new in wanted for old in existing):
        raise AppointmentRefused("overlaps_existing_slot")
    keep_place = series["mode"] == "in_person"
    ids = [
        repository.insert_slot(db, representative.id, start, end, series["mode"], place_en if keep_place else None,
                               place_ta if keep_place else None, actor_id)
        for start, end in wanted
    ]
    audit.record(db, actor_id=actor_id, action="appointment.slots_published", target_type="representative",
                 target_id=str(representative.id), area_path=_path(representative), details={"count": len(ids)}, ip=ip)
    db.commit()
    return [s for s in (repository.find_slot(db, slot_id) for slot_id in ids) if s is not None]


def _close_slot(db: Session, slot: Slot, reason: str) -> None:
    """Withdraw the slot; a booking on it is cancelled and its member told (the caller audits)."""
    if slot.booking_id is not None:
        booking = repository.find_appointment(db, slot.booking_id, lock=True)
        if booking is not None and booking.state == "booked":
            repository.update_appointment(db, booking.id, {"state": "cancelled", "cancelled_by": "representative",
                                                           "cancelled_at": _now(), "cancel_reason": reason})
            notifications.notify(db, booking.member_id, "appointment_cancelled", booking.id)
    repository.withdraw_slot(db, slot.id, reason)


def _withdraw_slot(db: Session, actor_id: uuid.UUID, representative: Representative, slot_id: uuid.UUID, reason: str,
                   ip: str) -> Slot:
    slot = repository.find_slot(db, slot_id, lock=True)
    if slot is None or slot.representative_id != representative.id:
        raise AppointmentNotFound()
    if slot.state != "open":
        raise AppointmentRefused("not_allowed_from:withdrawn")
    if slot.starts_at <= _now():
        raise AppointmentRefused("already_started")
    reason = reason.strip()
    if len(reason) < 3:
        raise AppointmentRefused("reason_required")
    _close_slot(db, slot, reason)
    audit.record(db, actor_id=actor_id, action="appointment.slot_withdrawn", target_type="representative",
                 target_id=str(representative.id), area_path=_path(representative),
                 details={"slotId": str(slot_id), "hadBooking": slot.booking_id is not None}, ip=ip)
    db.commit()
    found = repository.find_slot(db, slot_id)
    assert found is not None
    return found


# --- Run by the notifications task --------------------------------------------------------------


def remind(db: Session, now: datetime) -> int:
    """FR-APT-003: reminders 24 hours and 1 hour before the appointment."""
    sent = 0
    windows = (
        ("reminded_hour_at", now, now + rules.REMIND_HOUR, "1 hour", "appointment_soon"),
        ("reminded_day_at", now + rules.REMIND_HOUR, now + rules.REMIND_DAY, "24 hours", "appointment_tomorrow"),
    )
    for column, start, end, lead, key in windows:
        for appointment_id, member_id in repository.due_reminders(db, column, start, end, lead):
            notifications.notify(db, member_id, key, appointment_id)
            repository.update_appointment(db, appointment_id, {column: now})
            sent += 1
    db.commit()
    return sent


def purge(db: Session, now: datetime) -> int:
    """ENT-58: appointments are kept for two years after the meeting [ASSUMPTION pending OD-03]."""
    removed = repository.purge_older_than(db, now - timedelta(days=730))
    db.commit()
    return removed
