"""Membership renewal rules (BRD M33, D25, FR-RNW-001 to 003, 009, BR-136, OD-43) as plain functions.

Renewal is a light yearly check that the member's contact and area are still right; it never asks
for ID images or a selfie again (BR-136). Notices go 30 and 7 days before the due date
(FR-RNW-002). After the due date a grace period runs; when it ends without a confirmation the
membership lapses to Inactive, and confirming afterwards reactivates it (OD-43's recommendation).

[ASSUMPTION] OD-43 is still open. Its recommendation is built: an annual light reconfirmation with a
60-day grace period, a lapse to Inactive, and simple reactivation. Every number is one constant here.
"""

from datetime import date, timedelta
from typing import Literal

# D25 is PRM-52's screen (T3B, Tier 5): the due list sits with the certificates.
MANAGE = "certificate.issue_revoke"

GRACE_DAYS = 60  # [ASSUMPTION] OD-43
NOTICE_DAYS = (30, 7)  # FR-RNW-002
OPENS_DAYS_BEFORE = 30  # the member can confirm from the first notice on
# A member who was active long before renewal was switched on is never caught out: the first cycle
# falls due no sooner than 30 days after it opens, so the 30-day notice always comes first.
FIRST_CYCLE_MIN_DAYS = 30
# OD-43 "simple reactivation": confirming after a lapse makes the membership Active again, but only
# for a lapse the renewal itself made. Any other inactivation stays a members.activate decision (BR-015).
SELF_REACTIVATION = True
LAPSED_REASON = "renewal_lapsed"
REACTIVATED_REASON = "renewal_confirmed"

Phase = Literal["upcoming", "due", "grace", "lapsed", "confirmed"]
PHASES: tuple[Phase, ...] = ("upcoming", "due", "grace", "lapsed", "confirmed")
Notice = Literal["renewal_due_30", "renewal_due_7"]


def add_years(day: date, years: int = 1) -> date:
    """The same day a number of years later; 29 February becomes 28 February."""
    try:
        return day.replace(year=day.year + years)
    except ValueError:
        return day.replace(year=day.year + years, day=28)


def first_due_on(active_since: date, today: date) -> date:
    """A year after the membership became Active, but never sooner than 30 days from today."""
    return max(add_years(active_since), today + timedelta(days=FIRST_CYCLE_MIN_DAYS))


def next_due_on(previous_due: date) -> date:
    """Renewal keeps its yearly date, even when the member confirmed during the grace period."""
    return add_years(previous_due)


def grace_ends_on(due_on: date) -> date:
    return due_on + timedelta(days=GRACE_DAYS)


def phase(due_on: date, today: date) -> Phase:
    """Where an open cycle stands today. "lapsed" here means the grace period is over and the
    nightly task has yet to record it."""
    if today < due_on - timedelta(days=OPENS_DAYS_BEFORE):
        return "upcoming"
    if today <= due_on:
        return "due"
    if today <= grace_ends_on(due_on):
        return "grace"
    return "lapsed"


def notice_to_send(due_on: date, today: date, sent_30: bool, sent_7: bool) -> Notice | None:
    """The one notice to send today, if any. A notice that is late is still sent before the due date,
    but the 30-day notice is skipped once the 7-day one is due."""
    days_left = (due_on - today).days
    if days_left < 0:
        return None
    if days_left <= NOTICE_DAYS[1]:
        return None if sent_7 else "renewal_due_7"
    if days_left <= NOTICE_DAYS[0]:
        return None if sent_30 else "renewal_due_30"
    return None


def check_confirmation(
    *,
    current_phase: Phase,
    contact_on_record: bool,
    contact_confirmed: bool,
    area_confirmed: bool,
    area_change_open: bool,
) -> list[str]:
    """FR-RNW-001, 003: everything wrong with a confirmation; an empty list means it may be saved.

    The contact on record changes only through a code sent to the new number (FR-PROF-004), so a
    changed number counts only once its code is confirmed. An area change waiting for review counts
    as the member's answer about their area.
    """
    if current_phase == "confirmed":
        return ["already_confirmed"]
    if current_phase == "upcoming":
        return ["not_due_yet"]
    problems = []
    if not contact_on_record:
        problems.append("contact_not_confirmed")
    elif not contact_confirmed:
        problems.append("contact_confirmation_required")
    if not area_confirmed and not area_change_open:
        problems.append("area_confirmation_required")
    return problems


def may_reactivate(membership_state: str, reason_code: str | None, identity_verified: bool) -> bool:
    """OD-43: only a lapse the renewal made is undone by confirming."""
    return (
        SELF_REACTIVATION
        and identity_verified
        and membership_state == "inactive"
        and reason_code == LAPSED_REASON
    )
