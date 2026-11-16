"""Issue reporting and case escalation rules (BRD v1.1 §4.3, §10.2(b), FR-RPT-001 to 017,
FR-WEB-014 to 029, BR-026 to 040) as plain functions.

A member's report becomes a case that climbs the decision line only as far as its required
authority: GN collection (Tier 1), divisional research (Tier 2A), district decision (Tier 3A),
regional plan (Tier 4) and executive approval (Tier 5), then implementation and closure by a
named owner. A district may act within its delegated authority without escalating. Tiers 2B and
3B assist at their level with facts and notes but never send a decision (FR-WEB-020, BR-083).
Nothing here touches the database; each refusal is a short code the screens explain.
"""

from datetime import UTC, datetime, timedelta, timezone
from typing import Literal

from app.core.permissions import Tier

Category = Literal["road", "water", "waste", "electricity", "agriculture", "environment", "public_facility", "other"]
CATEGORIES: tuple[Category, ...] = (
    "road", "water", "waste", "electricity", "agriculture", "environment", "public_facility", "other",
)

Stage = Literal["gn", "returned", "ds", "district", "regional", "executive", "implementation", "resolved", "declined", "linked"]
OPEN_STAGES: frozenset[str] = frozenset({"gn", "returned", "ds", "district", "regional", "executive", "implementation"})
CLOSED_STAGES: frozenset[str] = frozenset({"resolved", "declined", "linked"})

LocationKind = Literal["my_gn", "landmark", "text"]
Visibility = Literal["team", "public"]

DESCRIPTION_MIN = 20  # FR-RPT-008 [ASSUMPTION]
MAX_REPORT_PHOTOS = 3
CHALLENGE_WINDOW = timedelta(days=30)  # FR-RPT-016 [ASSUMPTION]
UNATTACHED_PHOTO_LIFETIME = timedelta(hours=24)

# BRD §4.3 proposed stage limits in working days [ASSUMPTION; OD-10]. Implementation runs to the due
# date of the approved plan; a case returned for details waits for the reporter and has no limit.
STAGE_LIMIT_DAYS: dict[str, int] = {"gn": 3, "ds": 7, "district": 10, "regional": 15, "executive": 10}

# The permission that does each stage's work, and who is alerted when its limit passes (§4.3).
STAGE_PERMISSION: dict[str, str] = {
    "gn": "cases.collect",
    "returned": "cases.collect",
    "ds": "cases.research",
    "district": "cases.decide_district",
    "regional": "cases.plan_regional",
    "executive": "cases.approve_executive",
    "implementation": "cases.implement_and_close",
}
BREACH_ALERTS: dict[str, str] = {
    "gn": "cases.research",
    "ds": "cases.decide_district",
    "district": "cases.plan_regional",
    "regional": "cases.approve_executive",
    "executive": "cases.approve_executive",  # logged on the executive's own dashboard
}
CASE_PERMISSIONS: frozenset[str] = frozenset(
    {
        "cases.collect",
        "cases.research",
        "cases.decide_district",
        "cases.plan_regional",
        "cases.approve_executive",
        "cases.implement_and_close",
    }
)
# Tiers that assist without deciding (FR-WEB-020).
ASSISTING_TIERS: frozenset[Tier] = frozenset({"2B", "3B"})

# History entries that hand a case to its next stage or owner: each carries the previous owner, the
# new owner, a note and the time (FR-WEB-029), so the note is never empty.
HANDOVER_KINDS: frozenset[str] = frozenset(
    {
        "returned", "forwarded", "ds_report", "district_action", "escalated", "regional_plan", "executive_approved",
        "executive_returned", "executive_declined", "assigned", "closed", "reopened",
    }
)

# The stages in which each staff action makes sense; outside them the answer is wrong_stage.
ACTION_STAGES: dict[str, frozenset[str]] = {
    "note": OPEN_STAGES,
    "fact": frozenset({"gn", "returned"}),
    "finding": frozenset({"ds"}),
    "return": frozenset({"gn"}),
    "link": frozenset({"gn", "returned"}),
    "forward": frozenset({"gn"}),
    "ds_report": frozenset({"ds"}),
    "district_decision": frozenset({"district"}),
    "regional_plan": frozenset({"regional"}),
    "executive_decision": frozenset({"executive"}),
    "progress": frozenset({"implementation"}),
    "close": frozenset({"implementation"}),
    "assign": OPEN_STAGES - {"returned"},
    "decide_challenge": frozenset({"resolved"}),
}

# The member's four-stage stepper (BRD §10.2(b); OD-13 recommends the same four on H06 and H09).
MemberStage = Literal[1, 2, 3, 4]
MEMBER_STAGE: dict[str, int] = {
    "gn": 1,
    "returned": 1,
    "ds": 2,
    "district": 3,
    "regional": 3,
    "executive": 3,
    "implementation": 4,
    "resolved": 4,
    "declined": 3,
}
# The first internal stage that reaches each member stage, for the stepper's dates.
STAGE_ENTRIES: dict[int, tuple[str, ...]] = {
    2: ("ds",),
    3: ("district", "regional", "executive"),
    4: ("implementation",),
}

MemberStatus = Literal["received", "needs_details", "under_review", "in_progress", "resolved", "declined"]
MEMBER_STATUS: dict[str, MemberStatus] = {
    "gn": "received",
    "returned": "needs_details",
    "ds": "under_review",
    "district": "under_review",
    "regional": "under_review",
    "executive": "under_review",
    "implementation": "in_progress",
    "resolved": "resolved",
    "declined": "declined",
}

ResponsibleTier = Literal[
    "gn_coordinator", "divisional_coordinator", "district_coordinator", "regional_administrator", "executive",
    "execution_owner",
]
RESPONSIBLE: dict[str, ResponsibleTier] = {
    "gn": "gn_coordinator",
    "returned": "gn_coordinator",
    "ds": "divisional_coordinator",
    "district": "district_coordinator",
    "regional": "regional_administrator",
    "executive": "executive",
    "implementation": "execution_owner",
}

# Sri Lanka keeps one offset all year. Public holidays are not counted yet [ASSUMPTION; OD-10].
LOCAL_ZONE = timezone(timedelta(hours=5, minutes=30))


def add_working_days(start: datetime, days: int) -> datetime:
    """The same local time `days` working days (Monday to Friday) later."""
    local = start.astimezone(LOCAL_ZONE)
    added = 0
    while added < days:
        local += timedelta(days=1)
        if local.weekday() < 5:
            added += 1
    return local.astimezone(UTC)


def stage_due(stage: str, entered_at: datetime, implementation_due: datetime | None = None) -> datetime | None:
    if stage == "implementation":
        return implementation_due
    limit = STAGE_LIMIT_DAYS.get(stage)
    return add_working_days(entered_at, limit) if limit is not None else None


def is_overdue(stage: str, due: datetime | None, now: datetime) -> bool:
    return stage in OPEN_STAGES and due is not None and now > due


def member_view_stage(stage: str, parent_stage: str | None) -> str:
    """A report linked to a parent case follows the parent (FR-WEB-018)."""
    return parent_stage if stage == "linked" and parent_stage else stage


# --- Member checks --------------------------------------------------------------------------------------


def check_may_report(*, identity_verified: bool, membership_active: bool) -> str | None:
    """FR-RPT-017, BR-026: only Verified and Active members report."""
    if not identity_verified:
        return "identity_not_verified"
    if not membership_active:
        return "membership_not_active"
    return None


def check_report(*, description: str, location_kind: str, location_text: str | None, has_gn: bool, photos: int) -> list[str]:
    """A case starts with the GN collector of the reporter's division, so every report needs a GN
    division on the reporter's profile, whatever place the report describes (W03)."""
    problems = []
    if len(description.strip()) < DESCRIPTION_MIN:
        problems.append("description_too_short")
    if not has_gn:
        problems.append("no_gn_on_profile")
    if location_kind != "my_gn" and not (location_text and location_text.strip()):
        problems.append("location_required")
    if photos > MAX_REPORT_PHOTOS:
        problems.append("too_many_photos")
    return problems


def check_closure_response(
    *, stage: str, closed_at: datetime | None, now: datetime, already_responded: bool, resolved: bool, note: str | None
) -> str | None:
    """FR-RPT-016: the reporter rates a closure, or challenges it with a note, within 30 days."""
    if stage != "resolved" or closed_at is None:
        return "not_closed"
    if already_responded:
        return "already_responded"
    if now - closed_at > CHALLENGE_WINDOW:
        return "challenge_window_closed"
    if not resolved and not (note and note.strip()):
        return "note_required"
    return None


# --- Staff checks ---------------------------------------------------------------------------------------


def check_stage(stage: str, allowed: tuple[str, ...]) -> str | None:
    return None if stage in allowed else "wrong_stage"


def check_forward(*, facts: int, location_confirmed: bool, description_clear: bool, evidence_reviewed: bool) -> list[str]:
    """FR-WEB-017: forward only after the completeness check and with a named DS owner."""
    problems = []
    if facts < 1:
        problems.append("facts_required")
    if not (location_confirmed and description_clear and evidence_reviewed):
        problems.append("completeness_check_incomplete")
    return problems


def check_link(*, child_id: object, parent_id: object, parent_stage: str, parent_has_parent: bool) -> str | None:
    if child_id == parent_id:
        return "cannot_link_to_itself"
    if parent_stage not in OPEN_STAGES or parent_has_parent:
        return "parent_not_open"
    return None


def check_closing(*, evidence_refs: list[str], evidence_photos: int, summary_en: str, summary_ta: str) -> list[str]:
    """FR-WEB-026: a closing report needs evidence and a member summary in Tamil and English."""
    problems = []
    if not [ref for ref in evidence_refs if ref.strip()] and evidence_photos == 0:
        problems.append("evidence_required")
    if not summary_en.strip() or not summary_ta.strip():
        problems.append("bilingual_summary_required")
    return problems


def closed_level(approved_by_kind: str | None) -> str:
    """Where the decision behind an implementation was taken, for FR-WEB-022."""
    return "district" if approved_by_kind == "district_action" else "executive"


def next_step(stage: str, *, closed_at: datetime | None, responded: bool, now: datetime) -> str | None:
    """What happens next, in the member's words (FR-RPT-014)."""
    if stage == "resolved":
        if closed_at is not None and not responded and now - closed_at <= CHALLENGE_WINDOW:
            return "rate_closure"
        return None
    if stage == "declined":
        return None
    return {
        "gn": "gn_review",
        "returned": "add_details",
        "ds": "ds_research",
        "district": "district_decision",
        "regional": "regional_plan",
        "executive": "executive_approval",
        "implementation": "implementation",
    }.get(stage)
