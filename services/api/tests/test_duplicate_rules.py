"""Duplicate investigation rules as plain functions (FR-IDV-010, BR-094). No database needed."""

import uuid

import pytest

from app.modules.identity.duplicates import rules

ME, ORIGINAL, OTHER = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


def test_names_are_compared_without_case_or_extra_spaces():
    assert rules.comparable_name("  Kumar   Selvaraj ") == rules.comparable_name("kumar selvaraj")
    assert rules.comparable_name("Kumar Selvaraj") != rules.comparable_name("Kumar Selvarajah")


def test_a_pair_has_one_order():
    first, second = sorted([uuid.uuid4(), uuid.uuid4()])
    assert rules.ordered_pair(second, first) == rules.ordered_pair(first, second) == (first, second)


def test_reports_name_two_other_people():
    assert rules.check_report(ME, ORIGINAL, OTHER) == []
    assert rules.check_report(ME, ORIGINAL, ORIGINAL) == ["same_member"]
    assert rules.check_report(ME, ORIGINAL, ME) == ["own_record"]


@pytest.mark.parametrize(
    ("state", "claimed_by", "claimant_ok", "expected"),
    [
        ("open", None, False, None),
        ("in_review", ME, True, None),
        ("in_review", OTHER, True, "claimed_by_another"),
        ("in_review", OTHER, False, None),
        ("not_duplicate", None, False, "not_open"),
        ("duplicate_confirmed", None, False, "not_open"),
    ],
)
def test_one_investigator_at_a_time(state, claimed_by, claimant_ok, expected):
    assert rules.check_claim(state, claimed_by, ME, claimant_ok) == expected
