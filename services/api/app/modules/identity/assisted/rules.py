"""Assisted verification rules (BRD M05, S04, FR-IDV-014, FR-STF-004, BR-010, BR-144, OD-04) as plain functions.

A member who has no working camera, whose photos failed the automatic checks three times, or who
simply asks, can request help (M05). A trained coordinator or a reviewer then witnesses the capture
on the member's own phone, or on a district office's device, never on a coordinator's personal
phone (OD-04). Before the session can be submitted every item of the witness checklist is ticked
(FR-STF-004) and the server holds every image the member's route needs. Submitting sends the images
to the normal identity review, where a person holding members.verify decides (BR-091).

[ASSUMPTION] OD-04 is still open. Its recommendation is built: supervised capture by a trained
Tier 1 coordinator on the member's own device, or an in-person check at a district office. The
checklist items and every number below are proposals for the sponsor to confirm.
"""

from datetime import date, datetime, timedelta
from typing import Literal

ASSIST = "members.assisted_verification"  # [ASSUMPTION] the "assisted-session grant" of S04
VERIFY = "members.verify"  # PRM-04
STAFF_PERMISSIONS = (ASSIST, VERIFY)

# FR-IDV-014: after this many photos the checks flagged, the app offers help.
CHECK_FAILURES_BEFORE_HELP = 3
PREFERRED_WITHIN_DAYS = 30
SCHEDULE_WITHIN_DAYS = 60

Reason = Literal["no_camera", "checks_failed", "member_asked"]
Route = Literal["supervised_capture", "office_visit", "call_back"]
PreferredTime = Literal["morning", "afternoon", "evening"]
State = Literal["requested", "scheduled", "in_session", "completed", "cancelled", "closed"]
OPEN_STATES: tuple[State, ...] = ("requested", "scheduled", "in_session")
Device = Literal["member_device", "office_device"]
AbandonReason = Literal["member_absent", "camera_failure", "document_missing", "member_declined", "other"]
CloseReason = Literal["member_declined", "member_unreachable", "verified_another_way"]

# FR-STF-004: the witness confirms each of these before the session can be submitted.
CHECKLIST = (
    "member_present",  # the member was there in person
    "original_document_seen",  # the original NIC or passport, not a copy or a photo of one
    "face_matches_document",  # the person present matches the document's photo
    "captured_on_allowed_device",  # the member's own phone or an office device, never the witness's phone
    "no_copies_kept",  # no copy of an image or the document stays with the witness
    "declaration_by_member",  # the member read and accepted the declaration themselves
)


def check_request(
    *, identity_verified: bool, review_state: str | None, contact_on_record: bool, preferred_date: date | None,
    today: date,
) -> list[str]:
    """M05: help is for a member still to be verified, reachable on a confirmed number."""
    if identity_verified:
        return ["already_verified"]
    problems = []
    if review_state in ("submitted", "in_review"):
        problems.append("review_open")
    if not contact_on_record:
        problems.append("contact_not_confirmed")
    if preferred_date is not None and not today <= preferred_date <= today + timedelta(days=PREFERRED_WITHIN_DAYS):
        problems.append("preferred_date_out_of_range")
    return problems


def check_schedule(state: str, scheduled_for: datetime, now: datetime) -> list[str]:
    problems = [] if state in ("requested", "scheduled") else [f"not_allowed_from:{state}"]
    if not now <= scheduled_for <= now + timedelta(days=SCHEDULE_WITHIN_DAYS):
        problems.append("time_out_of_range")
    return problems


def check_start(state: str) -> list[str]:
    return [] if state in ("requested", "scheduled") else [f"not_allowed_from:{state}"]


def check_complete(checklist: list[str], required_documents: tuple[str, ...], received: set[str],
                   consent_given: bool) -> list[str]:
    """FR-STF-004: given the checklist incomplete, the session cannot be submitted; nor without the images."""
    problems = [f"unknown_checklist_item:{item}" for item in checklist if item not in CHECKLIST]
    problems += [f"checklist_incomplete:{item}" for item in CHECKLIST if item not in checklist]
    if not consent_given:
        problems.append("consent_required")
    problems += [f"missing:{kind}" for kind in required_documents if kind not in received]
    return problems


def after_abandon(reason: AbandonReason) -> tuple[State, Route | None, CloseReason | None]:
    """Where the request goes when a session cannot finish. A camera that fails moves the member to
    the office-visit route (S04); a member who declines closes it; anything else waits for a new time."""
    if reason == "member_declined":
        return "closed", None, "member_declined"
    if reason == "camera_failure":
        return "requested", "office_visit", None
    return "requested", None, None


def check_cancel(state: str) -> list[str]:
    """The member may withdraw before a session has started."""
    return [] if state in ("requested", "scheduled") else [f"not_allowed_from:{state}"]


def check_close(state: str) -> list[str]:
    return [] if state in ("requested", "scheduled") else [f"not_allowed_from:{state}"]
