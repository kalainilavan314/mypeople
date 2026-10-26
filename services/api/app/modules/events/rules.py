"""Event rules (BRD FR-EVT-001 to 017, FR-ADM-004, BR-057 to BR-062) as plain functions.

An RSVP records intent only; attendance is recorded only by a successful
scan of an event pass (BR-058). A pass exists only for a member who is going
(FR-EVT-012) and is bound to one event and one member (BR-060).
"""

from datetime import datetime, timedelta
from typing import Literal

from app.core.rotating_codes import CodeKind

MANAGE = "events.manage"  # PRM-16
SCAN = "events.checkin_scan"  # PRM-17

# [ASSUMPTION] The BRD names "event type" as a filter without a list.
EVENT_TYPES = ("community_meeting", "service_day", "training", "cultural", "town_hall", "other")

Response = Literal["going", "maybe", "declined"]
RsvpState = Literal["going", "maybe", "declined", "waitlisted"]
EventState = Literal["draft", "published", "cancelled"]
Action = Literal["edit", "publish", "cancel"]

# [ASSUMPTION] The check-in window when none is given: from an hour before the start to the end.
CHECKIN_OPENS_BEFORE = timedelta(hours=1)

PASS = CodeKind(version="E1", purpose=b"my-people event pass v1")

ScanResult = Literal["checked_in", "already_checked_in", "expired", "wrong_event", "outside_window", "not_valid"]
ManualResult = Literal["checked_in", "already_checked_in", "outside_window", "not_eligible", "not_valid"]


def checkin_window(starts_at: datetime, ends_at: datetime) -> tuple[datetime, datetime]:
    return starts_at - CHECKIN_OPENS_BEFORE, ends_at


def check_event(
    *,
    event_type: str,
    starts_at: datetime,
    ends_at: datetime,
    checkin_opens_at: datetime,
    checkin_closes_at: datetime,
) -> list[str]:
    """Everything wrong with an event's details; an empty list means it may be saved."""
    problems = []
    if event_type not in EVENT_TYPES:
        problems.append("unknown_event_type")
    if ends_at <= starts_at:
        problems.append("ends_before_start")  # the window cannot be judged against impossible times
    # The window must open before it closes and overlap the event itself.
    elif checkin_closes_at <= checkin_opens_at or checkin_opens_at > ends_at or checkin_closes_at < starts_at:
        problems.append("checkin_window_invalid")
    return problems


TRANSITIONS: dict[Action, frozenset[str]] = {
    "edit": frozenset({"draft", "published"}),
    "publish": frozenset({"draft"}),
    "cancel": frozenset({"draft", "published"}),
}


def check_transition(action: Action, state: str) -> str | None:
    return None if state in TRANSITIONS[action] else f"not_allowed_from:{state}"


def check_rsvp(state: str, ends_at: datetime, now: datetime) -> str | None:
    """Members respond only to a published event that has not ended."""
    if state == "cancelled":
        return "event_cancelled"
    if state != "published":
        return "not_found"  # a draft is invisible to members
    if now > ends_at:
        return "event_over"
    return None


def rsvp_state(response: Response, current: RsvpState | None, capacity: int | None, going: int) -> RsvpState:
    """Going becomes waitlisted when the event is full (FR-EVT-011 [ASSUMPTION]); a member
    already going keeps their place."""
    if response != "going" or current == "going":
        return response
    if capacity is not None and going >= capacity:
        return "waitlisted"
    return "going"


def pass_problem(
    *,
    state: str,
    checkin_closes_at: datetime,
    response: RsvpState | None,
    membership_active: bool,
    admits_pending: bool,
    now: datetime,
) -> str | None:
    """Why no pass can be shown, or None (FR-EVT-012; OD-12 [ASSUMPTION]: an Active membership,
    unless the event admits pending members)."""
    if state == "cancelled":
        return "event_cancelled"
    if state != "published":
        return "not_found"
    if now > checkin_closes_at:
        return "event_over"
    if response != "going":
        return "not_going"
    if not (membership_active or admits_pending):
        return "membership_not_active"
    return None


def scan_result(
    *,
    pass_event_id: object | None,
    scanned_event_id: object,
    within_window: bool,
    already_attended: bool,
) -> ScanResult:
    """What the scanner shows for a genuine, current pass (expired and forged codes are decided first)."""
    if pass_event_id is None:
        return "not_valid"  # no longer going, or never was
    if pass_event_id != scanned_event_id:
        return "wrong_event"
    if not within_window:
        return "outside_window"
    if already_attended:
        return "already_checked_in"
    return "checked_in"


def manual_result(
    *, member_found: bool, within_window: bool, already_attended: bool, pass_problem: str | None
) -> ManualResult:
    """FR-VOI-007: a member ID typed in when no pass can be scanned (camera refused or broken, no
    phone) is held to the same rules as the pass would be. The reason for not_eligible stays in the
    audit log, as with a scan."""
    if not member_found:
        return "not_valid"
    if not within_window:
        return "outside_window"
    if already_attended:
        return "already_checked_in"
    if pass_problem:
        return "not_eligible"
    return "checked_in"


def cancelled_message(title_en: str, title_ta: str) -> str:
    return (
        f"என் மக்கள்: \"{title_ta}\" நிகழ்வு ரத்து செய்யப்பட்டது.\n"
        f"My People: the event \"{title_en}\" has been cancelled."
    )


def changed_message(title_en: str, title_ta: str) -> str:
    return (
        f"என் மக்கள்: \"{title_ta}\" நிகழ்வின் நேரம் அல்லது இடம் மாறியுள்ளது. விவரங்களை செயலியில் பார்க்கவும்.\n"
        f"My People: the time or place of \"{title_en}\" has changed. See the app for details."
    )
