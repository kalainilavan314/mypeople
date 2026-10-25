"""Identity review rules (BRD W02, FR-WEB-003 to 013, FR-REG-019 to 023, BR-004, BR-005, BR-011 to 013)
as plain functions.

The service gathers the facts and these functions decide. Each problem is
a short code the apps can explain (BR-089).
"""

from typing import Literal

from app.modules.access import rules as access_rules
from app.core.permissions import Tier
from app.modules.access.rules import AreaPath, Assignment

Route = Literal["nic", "passport"]  # BR-003: one route per account, NIC or passport
ReviewState = Literal["submitted", "in_review", "needs_update", "verified", "unable_to_verify"]
Decision = Literal["approve", "request_update", "unable_to_verify"]  # FR-WEB-008: exactly three

VERIFY = "members.verify"  # PRM-04

# BR-004, BR-005, BR-010: the images each route needs before it can be submitted.
REQUIRED_DOCUMENTS: dict[Route, tuple[str, ...]] = {
    "nic": ("nic_front", "nic_back", "selfie"),
    "passport": ("passport_page", "selfie"),
}

# FR-WEB-007: every item must be confirmed before Approve.
CHECKLIST = ("pages_present", "readable", "details_match_profile", "selfie_reviewable", "area_checked")

# BR-013: a correction names the exact item, an image or the profile details.
PROFILE_ITEM = "profile_details"

# FR-WEB-009, FR-WEB-010 ask for a reason "from a list" without giving one.
# [ASSUMPTION] These categories are proposed and need sponsor confirmation.
REASONS: dict[Decision, tuple[str, ...]] = {
    "approve": (),
    "request_update": (
        "image_unreadable",
        "image_incomplete",
        "wrong_document",
        "details_do_not_match",
        "selfie_unclear",
        "other",
    ),
    "unable_to_verify": ("document_not_valid", "person_does_not_match", "details_do_not_match", "other"),
}

STATE_AFTER: dict[Decision, ReviewState] = {
    "approve": "verified",
    "request_update": "needs_update",
    "unable_to_verify": "unable_to_verify",
}


def check_new_submission(route: Route, current_kinds: set[str], already_verified: bool) -> list[str]:
    """A first submission (FR-REG-004, FR-REG-019): every image of the route received by the server."""
    problems = ["already_verified"] if already_verified else []
    problems += [f"missing:{kind}" for kind in REQUIRED_DOCUMENTS[route] if kind not in current_kinds]
    return problems


def check_correction(
    route: Route,
    review_route: Route,
    requested_items: list[str],
    decided_documents: dict[str, str],
    current_documents: dict[str, str],
) -> list[str]:
    """A correction (FR-REG-022, 023): each image the reviewer flagged has been replaced.

    The documents are {kind: document id}; a replaced image has a new id.
    Profile details are corrected through the profile, so they are not checked here.
    """
    if route != review_route:
        return ["route_cannot_change"]
    return [
        f"not_updated:{item}"
        for item in requested_items
        if item != PROFILE_ITEM and current_documents.get(item) in (None, decided_documents.get(item))
    ]


def check_claim(
    state: ReviewState,
    claimed_by: object | None,
    actor_id: object,
    claimant_still_authorised: bool,
    overturned_on_appeal: bool = False,
) -> str | None:
    """FR-WEB-003: one reviewer at a time. None means the actor may claim it.

    A claim held by someone who no longer holds members.verify over the area
    may be taken over, so a review never stays stuck with a former reviewer.
    A reviewer whose decision was overturned on appeal does not review it
    again (FR-IDV-013).
    """
    if state not in ("submitted", "in_review"):
        return "not_open"  # needs_update waits for the member; verified and unable_to_verify are closed
    if overturned_on_appeal:
        return "overturned_on_appeal"
    if claimed_by is None or claimed_by == actor_id or not claimant_still_authorised:
        return None
    return "claimed_by_another"


def check_decision(
    *,
    decision: Decision,
    route: Route,
    checklist: list[str],
    items: list[str],
    reason_category: str | None,
    unviewed_documents: list[str],
) -> list[str]:
    """Everything wrong with a decision (FR-WEB-007 to 010); an empty list means it may be saved."""
    problems = [f"unknown_checklist_item:{item}" for item in checklist if item not in CHECKLIST]
    if decision == "approve":
        problems += [f"checklist_incomplete:{item}" for item in CHECKLIST if item not in checklist]
        # The deciding reviewer must have opened every required image in its current version.
        problems += [f"evidence_not_viewed:{kind}" for kind in unviewed_documents]
        if items:
            problems.append("items_only_for_request_update")
        if reason_category is not None:
            problems.append("reason_only_for_refusals")
        return problems

    if reason_category not in REASONS[decision]:
        problems.append("reason_required")
    if decision == "request_update":
        allowed = (*REQUIRED_DOCUMENTS[route], PROFILE_ITEM)
        if not items:
            problems.append("items_required")
        problems += [f"item_not_for_route:{item}" for item in items if item not in allowed]
    elif items:
        problems.append("items_only_for_request_update")
    return problems


def reviewer_tier(assignments: list[Assignment], area_path: AreaPath) -> Tier | None:
    """The highest tier through which the reviewer holds members.verify over the area (shown to the member, FR-PROF-006)."""
    return access_rules.highest_tier(assignments, VERIFY, area_path)
