"""The appeal rules as plain functions (FR-IDV-013, PRM-29). No database needed."""

import uuid

import pytest

from app.modules.identity.appeals import rules
from app.modules.identity.reviews import rules as review_rules

ME, ORIGINAL, OTHER = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


@pytest.mark.parametrize(
    ("review_state", "already_appealed", "expected"),
    [
        ("needs_update", False, []),
        ("unable_to_verify", False, []),
        ("needs_update", True, ["appeal_used"]),  # one appeal per decision
        ("unable_to_verify", True, ["appeal_used"]),
        ("verified", False, ["nothing_to_appeal"]),
        ("submitted", False, ["nothing_to_appeal"]),
        ("in_review", False, ["nothing_to_appeal"]),
        (None, False, ["nothing_to_appeal"]),
    ],
)
def test_only_an_adverse_decision_can_be_appealed_and_only_once(review_state, already_appealed, expected):
    assert rules.check_appeal(review_state, already_appealed) == expected


@pytest.mark.parametrize(
    ("state", "claimed_by", "actor", "claimant_ok", "expected"),
    [
        ("submitted", None, ME, False, None),
        ("in_review", ME, ME, True, None),
        ("submitted", None, ORIGINAL, False, "original_reviewer"),  # PRM-29: a different person decides
        ("in_review", OTHER, ME, True, "claimed_by_another"),
        ("in_review", OTHER, ME, False, None),  # the holder lost idv.appeal.decide: take over
        ("upheld", None, ME, False, "not_open"),
        ("overturned", None, ME, False, "not_open"),
    ],
)
def test_appeal_claims(state, claimed_by, actor, claimant_ok, expected):
    assert rules.check_claim(state, claimed_by, actor, ORIGINAL, claimant_ok) == expected


def test_a_reviewer_overturned_on_appeal_does_not_take_the_review_again():
    assert review_rules.check_claim("submitted", None, ME, False, overturned_on_appeal=True) == "overturned_on_appeal"
    assert review_rules.check_claim("submitted", None, ME, False, overturned_on_appeal=False) is None
