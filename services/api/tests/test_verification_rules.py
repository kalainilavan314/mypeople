"""The identity review rules as plain functions. No database needed."""

import uuid

import pytest

from app.modules.access.rules import PLATFORM, Area, Assignment
from app.modules.identity.reviews import rules

FULL_CHECKLIST = list(rules.CHECKLIST)
JAFFNA = Area("district", "LK41")
PATH = (PLATFORM, Area("province", "LK4"), JAFFNA, Area("ds", "LK4103"), Area("gn", "LK4103005"))


# --- Submitting (FR-REG-004, 019; BR-004, BR-005, BR-010) --------------------------------------


@pytest.mark.parametrize(
    ("route", "kinds", "expected"),
    [
        ("nic", {"nic_front", "nic_back", "selfie"}, []),
        ("nic", {"nic_front", "selfie"}, ["missing:nic_back"]),
        ("nic", {"passport_page", "selfie"}, ["missing:nic_front", "missing:nic_back"]),
        ("passport", {"passport_page", "selfie"}, []),
        ("passport", {"nic_front", "nic_back"}, ["missing:passport_page", "missing:selfie"]),
    ],
)
def test_each_route_needs_its_own_images(route, kinds, expected):
    assert rules.check_new_submission(route, kinds, already_verified=False) == expected


def test_a_verified_member_does_not_submit_again():
    assert rules.check_new_submission("nic", {"nic_front", "nic_back", "selfie"}, already_verified=True) == [
        "already_verified"
    ]


# --- Corrections (FR-REG-022, 023; BR-013) -------------------------------------------------------


DECIDED = {"nic_front": "a", "nic_back": "b", "selfie": "c"}


def test_a_correction_needs_each_flagged_image_replaced():
    assert rules.check_correction("nic", "nic", ["nic_back"], DECIDED, DECIDED) == ["not_updated:nic_back"]
    assert rules.check_correction("nic", "nic", ["nic_back"], DECIDED, {**DECIDED, "nic_back": "b2"}) == []


def test_profile_details_are_corrected_through_the_profile():
    assert rules.check_correction("nic", "nic", ["profile_details"], DECIDED, DECIDED) == []


def test_a_correction_keeps_the_route():
    assert rules.check_correction("passport", "nic", ["nic_back"], DECIDED, DECIDED) == ["route_cannot_change"]


# --- Claiming (FR-WEB-003) ---------------------------------------------------------------------------


ME, OTHER = uuid.uuid4(), uuid.uuid4()


@pytest.mark.parametrize(
    ("state", "claimed_by", "claimant_ok", "expected"),
    [
        ("submitted", None, False, None),
        ("in_review", ME, True, None),  # already mine
        ("in_review", OTHER, True, "claimed_by_another"),
        ("in_review", OTHER, False, None),  # the claimant lost members.verify: take over
        ("needs_update", None, False, "not_open"),
        ("verified", None, False, "not_open"),
        ("unable_to_verify", None, False, "not_open"),
    ],
)
def test_one_reviewer_at_a_time(state, claimed_by, claimant_ok, expected):
    assert rules.check_claim(state, claimed_by, ME, claimant_ok) == expected


# --- Deciding (FR-WEB-007 to 010) ------------------------------------------------------------------


def decide(decision, *, route="nic", checklist=(), items=(), reason=None, unviewed=()):
    return rules.check_decision(
        decision=decision,
        route=route,
        checklist=list(checklist),
        items=list(items),
        reason_category=reason,
        unviewed_documents=list(unviewed),
    )


def test_approve_needs_the_whole_checklist_and_every_image_opened():
    assert decide("approve", checklist=FULL_CHECKLIST) == []
    assert decide("approve", checklist=FULL_CHECKLIST[1:]) == ["checklist_incomplete:pages_present"]
    assert decide("approve", checklist=FULL_CHECKLIST, unviewed=["selfie"]) == ["evidence_not_viewed:selfie"]


def test_approve_takes_no_items_or_reason():
    assert decide("approve", checklist=FULL_CHECKLIST, items=["selfie"], reason="other") == [
        "items_only_for_request_update",
        "reason_only_for_refusals",
    ]


def test_request_update_names_items_of_the_route_and_a_reason():
    assert decide("request_update", items=["nic_back"], reason="image_unreadable") == []
    assert decide("request_update", items=["profile_details"], reason="details_do_not_match") == []
    assert decide("request_update", reason="image_unreadable") == ["items_required"]
    assert decide("request_update", items=["nic_back"]) == ["reason_required"]
    assert decide("request_update", items=["passport_page"], reason="other") == ["item_not_for_route:passport_page"]
    assert decide("request_update", route="passport", items=["passport_page"], reason="other") == []


def test_unable_to_verify_needs_a_reason_from_its_own_list():
    assert decide("unable_to_verify", reason="document_not_valid") == []
    assert decide("unable_to_verify") == ["reason_required"]
    assert decide("unable_to_verify", reason="image_unreadable") == ["reason_required"]
    assert decide("unable_to_verify", reason="other", items=["selfie"]) == ["items_only_for_request_update"]


def test_unknown_checklist_items_are_refused():
    assert decide("unable_to_verify", reason="other", checklist=["looks_fine"]) == [
        "unknown_checklist_item:looks_fine"
    ]


# --- The reviewer's tier, shown to the member (FR-PROF-006) ------------------------------------------


def test_the_reviewer_tier_is_the_highest_that_covers_the_area():
    assignments = [
        Assignment(tier="3A", area=JAFFNA, permissions=frozenset({rules.VERIFY})),
        Assignment(tier="5", area=PLATFORM, permissions=frozenset({"audit.view"})),
        Assignment(tier="4", area=Area("province", "LK4"), permissions=frozenset({rules.VERIFY})),
        Assignment(tier="4", area=Area("province", "LK5"), permissions=frozenset({rules.VERIFY})),
    ]
    assert rules.reviewer_tier(assignments, PATH) == "4"
    assert rules.reviewer_tier(assignments[:2], PATH) == "3A"
    assert rules.reviewer_tier(assignments[1:2], PATH) is None
