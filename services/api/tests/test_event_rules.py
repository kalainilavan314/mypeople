"""The event rules, without a database (BRD FR-EVT-009 to 017, BR-058 to BR-062)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.rotating_codes import CodeExpired, CodeInvalid
from app.modules.events import rules
from app.modules.membership.card import tokens as card_tokens

START = datetime(2026, 11, 1, 9, 0, tzinfo=UTC)
END = START + timedelta(hours=3)
SECRET = "test-only-jwt-secret-for-unit-tests"


def check(**overrides):
    values = {
        "event_type": "community_meeting",
        "starts_at": START,
        "ends_at": END,
        "checkin_opens_at": START - timedelta(hours=1),
        "checkin_closes_at": END,
    }
    return rules.check_event(**(values | overrides))


def test_an_event_needs_a_known_type_an_end_after_its_start_and_a_window_over_the_event():
    assert check() == []
    assert check(event_type="rally") == ["unknown_event_type"]
    assert check(ends_at=START) == ["ends_before_start"]
    assert check(checkin_opens_at=END + timedelta(minutes=1), checkin_closes_at=END + timedelta(hours=1)) == [
        "checkin_window_invalid"
    ]
    assert check(checkin_closes_at=START - timedelta(hours=2)) == ["checkin_window_invalid"]


def test_the_default_check_in_window_opens_an_hour_before_and_closes_at_the_end():
    assert rules.checkin_window(START, END) == (START - timedelta(hours=1), END)


@pytest.mark.parametrize(
    ("action", "state", "expected"),
    [
        ("publish", "draft", None),
        ("publish", "published", "not_allowed_from:published"),
        ("edit", "published", None),
        ("edit", "cancelled", "not_allowed_from:cancelled"),
        ("cancel", "draft", None),
        ("cancel", "cancelled", "not_allowed_from:cancelled"),
    ],
)
def test_events_move_from_draft_to_published_to_cancelled(action, state, expected):
    assert rules.check_transition(action, state) == expected


def test_members_respond_only_to_a_published_event_that_has_not_ended():
    assert rules.check_rsvp("published", END, START) is None
    assert rules.check_rsvp("draft", END, START) == "not_found"
    assert rules.check_rsvp("cancelled", END, START) == "event_cancelled"
    assert rules.check_rsvp("published", END, END + timedelta(seconds=1)) == "event_over"


def test_going_joins_the_waitlist_when_the_event_is_full():
    assert rules.rsvp_state("going", None, capacity=None, going=500) == "going"
    assert rules.rsvp_state("going", None, capacity=2, going=1) == "going"
    assert rules.rsvp_state("going", "maybe", capacity=2, going=2) == "waitlisted"
    assert rules.rsvp_state("going", "going", capacity=2, going=2) == "going"  # keeps their place
    assert rules.rsvp_state("declined", "going", capacity=2, going=2) == "declined"  # no reason asked


def pass_problem(**overrides):
    values = {
        "state": "published",
        "checkin_closes_at": END,
        "response": "going",
        "membership_active": True,
        "admits_pending": False,
        "now": START,
    }
    return rules.pass_problem(**(values | overrides))


def test_a_pass_needs_going_an_open_event_and_an_active_membership_unless_pending_are_admitted():
    assert pass_problem() is None
    assert pass_problem(response="maybe") == "not_going"
    assert pass_problem(response="waitlisted") == "not_going"
    assert pass_problem(membership_active=False) == "membership_not_active"
    assert pass_problem(membership_active=False, admits_pending=True) is None
    assert pass_problem(state="cancelled") == "event_cancelled"
    assert pass_problem(now=END + timedelta(seconds=1)) == "event_over"


@pytest.mark.parametrize(
    ("pass_event", "window", "attended", "expected"),
    [
        ("A", True, False, "checked_in"),
        ("A", True, True, "already_checked_in"),
        ("B", True, False, "wrong_event"),
        ("A", False, False, "outside_window"),
        (None, True, False, "not_valid"),
    ],
)
def test_what_a_scanner_is_told(pass_event, window, attended, expected):
    result = rules.scan_result(
        pass_event_id=pass_event, scanned_event_id="A", within_window=window, already_attended=attended
    )
    assert result == expected


def test_pass_codes_are_short_lived_and_never_read_as_card_codes():
    now = 1_800_000_000
    code = rules.PASS.sign("pass-ref", SECRET, now).code

    assert code.startswith("E1.") and rules.PASS.read(code, SECRET, now + 60) == "pass-ref"
    with pytest.raises(CodeExpired):
        rules.PASS.read(code, SECRET, now + 60 + 16)
    with pytest.raises(CodeInvalid):
        card_tokens.read(code, SECRET, now)  # a pass is not a membership card
    with pytest.raises(CodeInvalid):
        rules.PASS.read(card_tokens.sign("card-ref", SECRET, now).code, SECRET, now)


def test_notices_name_the_event_in_both_languages():
    message = rules.cancelled_message("Town meeting", "ஊர்க் கூட்டம்")
    assert "Town meeting" in message and "ஊர்க் கூட்டம்" in message and "cancelled" in message
