"""Notification and broadcast rules, without a database (BRD FR-PROF-012, FR-STF-009, FR-ADM-007,
FR-MSG-007, BR-145)."""

from datetime import UTC, datetime, time

import pytest

from app.modules.messaging.broadcasts import rules as broadcasts
from app.modules.messaging.notifications import rules
from app.modules.messaging.notifications.templates import TEMPLATES


def at_local(hour: int, minute: int = 0) -> datetime:
    """A UTC moment that is hour:minute in Sri Lanka (UTC+5:30)."""
    total = (hour * 60 + minute - 330) % (24 * 60)
    return datetime(2026, 10, 26, total // 60, total % 60, tzinfo=UTC)


def test_quiet_hours_are_local_and_may_cross_midnight():
    night = (time(22, 0), time(6, 0))
    assert rules.in_quiet_hours(at_local(23, 30), *night) is True
    assert rules.in_quiet_hours(at_local(5, 59), *night) is True
    assert rules.in_quiet_hours(at_local(6, 0), *night) is False
    assert rules.in_quiet_hours(at_local(13, 0), time(12, 0), time(14, 0)) is True
    assert rules.in_quiet_hours(at_local(13, 0), None, None) is False


@pytest.mark.parametrize(
    ("topic", "wanted", "urgent", "quiet", "expected"),
    [
        ("events", True, False, False, "send"),
        ("events", False, False, False, "skip"),
        ("review", False, False, False, "send"),  # locked: cannot be turned off
        ("events", True, False, True, "wait"),
        ("emergency", True, True, True, "send"),  # urgent: quiet hours do not hold it
    ],
)
def test_what_happens_to_a_push(topic, wanted, urgent, quiet, expected):
    assert rules.push_decision(topic=topic, push_wanted=wanted, urgent=urgent, quiet=quiet) == expected


def test_account_and_review_notices_cannot_be_turned_off():
    assert rules.check_preference("account", push=False) == "topic_locked"
    assert rules.check_preference("review", push=False) == "topic_locked"
    assert rules.check_preference("events", push=False) is None


def test_push_titles_name_no_person_or_number():
    for template in TEMPLATES.values():
        assert not any(ch.isdigit() for ch in template.title_en.replace("24-hour", "")), template.title_en
        assert template.title_ta and template.target_kind


@pytest.mark.parametrize(
    ("text", "blocked"),
    [
        ("Meeting at 10am, call 0771234567", False),
        ("Ask for 199012345678 at the desk", True),
        ("NIC 901234567V attended", True),
        ("Ref NB-000012 and 2026 dates", False),
    ],
)
def test_broadcasts_never_carry_an_id_number(text, blocked):
    assert broadcasts.check_content("Title", text) == (["contains_id_number"] if blocked else [])


def test_wider_than_a_district_needs_a_second_senior_person():
    assert broadcasts.needs_approval("district") is False
    assert broadcasts.needs_approval("province") is True
    assert broadcasts.check_approver("a", "a", "5") == "own_submission"
    assert broadcasts.check_approver("b", "a", "3A") == "approver_tier_too_low"
    assert broadcasts.check_approver("b", "a", "4") is None
