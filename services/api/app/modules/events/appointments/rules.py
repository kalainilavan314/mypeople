"""Meet Your Representative rules (BRD FR-APT-001 to 007, BR-143, BR-159) as plain functions.

A representative is a staff member holding a public role and PRM-56 (appointment.manage_own),
which reaches only their own calendar. Profiles are published by someone holding
appointment.profile.manage over the area the profile covers (D29). A profile's contact routes are
shown to members only after the person approves them (BR-143). Members book a published slot and
may cancel or move it before it starts; reminders go 24 hours and 1 hour before (FR-APT-003). A
case reference is kept only when the member ticks consent (FR-APT-005). After the meeting the
representative records a follow-up note that the member sees (FR-APT-006).
"""

import re
from datetime import datetime, timedelta
from typing import Literal

MANAGE_OWN = "appointment.manage_own"  # PRM-56, own calendar only
MANAGE_PROFILES = "appointment.profile.manage"  # [ASSUMPTION] D29: Tier 5 (Tier 4 by explicit grant)

ProfileState = Literal["draft", "published", "withdrawn"]
AreaLevel = Literal["district", "ds", "gn"]
SlotMode = Literal["in_person", "phone_call"]
AppointmentState = Literal["booked", "cancelled", "completed", "no_show"]
CancelledBy = Literal["member", "representative"]
ContactPreference = Literal["in_app", "phone_call", "sms"]
Need = Literal[
    "step_free_access", "sign_language", "tamil_interpreter", "sinhala_interpreter", "english_interpreter",
    "large_print", "someone_with_me",
]
Outcome = Literal["completed", "no_show"]

MIN_SLOT_MINUTES = 10
MAX_SLOT_MINUTES = 120
MAX_SLOTS_PER_SERIES = 16
MAX_DAYS_AHEAD = 90  # [ASSUMPTION] slots are published at most three months ahead
MAX_UPCOMING_PER_MEMBER = 3  # [ASSUMPTION] keeps the calendars manageable (SH-26)
MAX_UPCOMING_WITH_ONE_REPRESENTATIVE = 1  # [ASSUMPTION]
REMIND_DAY = timedelta(hours=24)  # FR-APT-003
REMIND_HOUR = timedelta(hours=1)  # FR-APT-003

PHONE = re.compile(r"^(\+94|0)[0-9]{9}$")
# [ASSUMPTION] A case reference as the member sees it on a receipt, such as CI-00128 or AS-2026-0001.
# It is stored as text and never joined to the case it names (BR-159): the representative still needs
# their own permission to open that case.
CASE_REF = re.compile(r"^[A-Z]{2,4}-[0-9A-Z-]{3,20}$")


def normalise_phone(value: str | None) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"[\s-]", "", value)
    return digits or None


def normalise_case_ref(value: str | None) -> str | None:
    cleaned = (value or "").strip().upper()
    return cleaned or None


def check_series(*, starts_at: datetime, minutes: int, count: int, now: datetime, mode: str,
                 place_en: str | None, place_ta: str | None) -> list[str]:
    problems = []
    if starts_at <= now:
        problems.append("starts_in_past")
    if starts_at > now + timedelta(days=MAX_DAYS_AHEAD):
        problems.append("too_far_ahead")
    if not MIN_SLOT_MINUTES <= minutes <= MAX_SLOT_MINUTES:
        problems.append("slot_length")
    if not 1 <= count <= MAX_SLOTS_PER_SERIES:
        problems.append("too_many_slots")
    if mode == "in_person" and not ((place_en or "").strip() and (place_ta or "").strip()):
        problems.append("place_required")
    return problems


def series(starts_at: datetime, minutes: int, count: int) -> list[tuple[datetime, datetime]]:
    """Consecutive slots of the same length, one after another."""
    length = timedelta(minutes=minutes)
    return [(starts_at + i * length, starts_at + (i + 1) * length) for i in range(count)]


def overlaps(first: tuple[datetime, datetime], second: tuple[datetime, datetime]) -> bool:
    return first[0] < second[1] and second[0] < first[1]


def check_booking(*, identity_verified: bool, membership_active: bool, own_calendar: bool, slot_open: bool,
                  slot_starts_at: datetime, now: datetime, slot_taken: bool, upcoming: int,
                  upcoming_with_representative: int, contact_preference: str, contact_phone: str | None,
                  case_ref: str | None, case_consent: bool) -> list[str]:
    """Everything that stops a booking; an empty list means it may be made."""
    if not identity_verified:
        return ["identity_not_verified"]
    if not membership_active:
        return ["membership_not_active"]
    problems = []
    if own_calendar:
        problems.append("own_calendar")
    if not slot_open or slot_starts_at <= now:
        problems.append("slot_unavailable")
    elif slot_taken:
        problems.append("slot_taken")
    if upcoming >= MAX_UPCOMING_PER_MEMBER:
        problems.append("too_many_upcoming")
    if upcoming_with_representative >= MAX_UPCOMING_WITH_ONE_REPRESENTATIVE:
        problems.append("already_booked_with_representative")
    problems += check_contact(contact_preference, contact_phone)
    if case_consent and case_ref is not None and not CASE_REF.match(case_ref):
        problems.append("case_ref_format")
    return problems


def check_contact(contact_preference: str, contact_phone: str | None) -> list[str]:
    """A number only when the member asked to be called or texted (FR-APT-004)."""
    if contact_preference == "in_app":
        return []
    return [] if contact_phone and PHONE.match(contact_phone) else ["contact_phone_required"]


def stored_phone(contact_preference: str, contact_phone: str | None) -> str | None:
    return None if contact_preference == "in_app" else contact_phone


def stored_case_ref(case_ref: str | None, case_consent: bool) -> str | None:
    """FR-APT-005: with consent unticked, no case link is stored, whatever was typed."""
    return case_ref if case_consent else None


def can_change(state: str, starts_at: datetime, now: datetime) -> str | None:
    """A booking is cancelled or moved only while it is booked and has not started."""
    if state != "booked":
        return f"not_allowed_from:{state}"
    if starts_at <= now:
        return "already_started"
    return None


def check_follow_up(*, state: str, starts_at: datetime, now: datetime, outcome: str, note: str | None) -> list[str]:
    """FR-APT-006: after the meeting time, the representative records what happened."""
    problems = []
    if state == "cancelled":
        problems.append("not_allowed_from:cancelled")
    if starts_at > now:
        problems.append("not_started_yet")
    if outcome == "completed" and len((note or "").strip()) < 5:
        problems.append("note_required")
    return problems


EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def check_contacts(contacts: dict[str, str | None]) -> list[str]:
    """The public routes as typed: a Sri Lankan number and a plain e-mail address."""
    problems = []
    if contacts.get("public_phone") and not PHONE.match(contacts["public_phone"] or ""):
        problems.append("phone_format")
    if contacts.get("public_email") and not EMAIL.match(contacts["public_email"] or ""):
        problems.append("email_format")
    for name in ("office_address_en", "office_address_ta"):
        value = contacts.get(name)
        if value and len(value) < 5:
            problems.append(f"{name}_too_short")
    return problems


def contacts_changed(before: dict[str, str | None], after: dict[str, str | None]) -> bool:
    return any((before.get(key) or None) != (after.get(key) or None) for key in after)
