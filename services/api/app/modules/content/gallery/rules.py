"""Gallery rules (BRD FR-GAL-001 to 007, FR-ADM-005, 006, BR-069 to BR-072) as plain functions.

Only gallery.publish holders put photos in the gallery; members never upload
(BR-069). An album goes from draft to submitted to published, and the person
who publishes it is never the one who submitted it [ASSUMPTION: FR-ADM-005
asks for approval before publishing without naming the approver]. Every
photo can be the subject of a removal request, decided within 24 hours as
remove, blur or keep, always with a reason (BR-070, FR-ADM-006).
"""

from datetime import datetime, timedelta
from typing import Literal

PUBLISH = "gallery.publish"  # PRM-18
TAKEDOWN = "gallery.takedown"  # PRM-19

Category = Literal["events", "community"]
RemovalReason = Literal["appears_in_photo", "safety", "inaccurate", "other"]
Decision = Literal["remove", "blur", "keep"]
AlbumAction = Literal["edit", "submit", "publish", "return"]

DECISION_STATE: dict[str, str] = {"remove": "removed", "blur": "blurred", "keep": "kept"}

RESPONSE_TIME = timedelta(hours=24)  # BR-070
# [ASSUMPTION] FR-ADM-006: a request still open after 18 hours goes to Tier 5.
ESCALATE_AFTER = timedelta(hours=18)
# [ASSUMPTION] The public form (FR-GAL-007) takes this many requests per address an hour.
MAX_PUBLIC_REQUESTS_PER_HOUR = 3

TRANSITIONS: dict[AlbumAction, frozenset[str]] = {
    "edit": frozenset({"draft"}),  # details, photos and captions change only in a draft
    "submit": frozenset({"draft"}),
    "publish": frozenset({"submitted"}),
    "return": frozenset({"submitted"}),
}


def check_transition(action: AlbumAction, state: str) -> str | None:
    return None if state in TRANSITIONS[action] else f"not_allowed_from:{state}"


def check_submission(
    *,
    summary_en: str,
    summary_ta: str,
    category: str,
    event_state: str | None,
    captions: list[tuple[str, str]],
) -> list[str]:
    """Everything stopping an album from going for approval: bilingual summary and captions on
    every photo (BR-072; "a missing Tamil caption blocks submission"), and a published event
    for an event album. captions holds (English, Tamil) for each photo still shown."""
    problems = []
    if not captions:
        problems.append("no_photos")
    if not summary_en.strip():
        problems.append("english_summary_missing")
    if not summary_ta.strip():
        problems.append("tamil_summary_missing")
    if any(not english.strip() for english, _ in captions):
        problems.append("english_caption_missing")
    if any(not tamil.strip() for _, tamil in captions):
        problems.append("tamil_caption_missing")
    if category == "events":
        if event_state is None:
            problems.append("event_required")
        elif event_state != "published":
            problems.append("event_not_published")
    return problems


def check_publisher(publisher_id: object, submitted_by: object) -> str | None:
    return "own_submission" if publisher_id == submitted_by else None


def escalated(created_at: datetime, now: datetime) -> bool:
    return now - created_at >= ESCALATE_AFTER


def outcome_message(request_ref: str, state: str) -> str:
    """The requester is told the outcome and the action taken (FR-GAL-005)."""
    actions = {
        "removed": ("படம் அகற்றப்பட்டது", "the photo has been removed"),
        "blurred": ("படம் மங்கலாக்கப்பட்டது", "the photo has been blurred"),
        "kept": ("படம் வைக்கப்பட்டுள்ளது; காரணத்தைச் செயலியில் பார்க்கவும்", "the photo has been kept; see the app for the reason"),
    }
    tamil, english = actions[state]
    return f"என் மக்கள்: உங்கள் கோரிக்கை {request_ref}: {tamil}.\nMy People: your request {request_ref}: {english}."
