"""M1.5 provisional attendance and volunteer assignment decisions.

The replay duration is a sandbox proposal until STF-01 is signed. No client
result may be shown as final attendance without a server check.
"""

from datetime import datetime, timedelta
from typing import Literal

DutyState = Literal["offered", "accepted", "declined", "cancelled", "completed"]
ScanState = Literal["NEEDS_REVIEW", "EXPIRED_QUEUE", "REJECTED"]

PROPOSED_REPLAY_WINDOW = timedelta(hours=72)


def check_shift(start: datetime, end: datetime, event_start: datetime, event_end: datetime) -> str | None:
    if end <= start:
        return "shift_end_before_start"
    if start < event_start or end > event_end:
        return "shift_outside_event"
    return None


def check_member_response(state: DutyState, member_is_assignee: bool, response: Literal["accept", "decline"]) -> str | None:
    if not member_is_assignee:
        return "not_assignee"
    if state != "offered":
        return "assignment_not_open"
    if response not in ("accept", "decline"):
        return "invalid_response"
    return None


def provisional_scan_state(
    client_scan_at: datetime, received_at: datetime, device_active: bool, staff_authorised: bool,
) -> ScanState:
    if not device_active or not staff_authorised:
        return "REJECTED"
    if client_scan_at > received_at + timedelta(minutes=5):
        return "NEEDS_REVIEW"  # A client clock is not proof of a future check-in.
    if received_at - client_scan_at > PROPOSED_REPLAY_WINDOW:
        return "EXPIRED_QUEUE"
    return "NEEDS_REVIEW"  # QR and membership must still be checked online.
