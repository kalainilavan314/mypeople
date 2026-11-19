"""Renewal, certificate and assisted-verification rules, without a database
(BRD FR-RNW-001 to 009, BR-136, BR-137, OD-43; FR-IDV-014, FR-STF-004, OD-04)."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest

from app.modules.identity.assisted import rules as assisted
from app.modules.membership.certificates import rules as certificates
from app.modules.membership.certificates import tokens
from app.modules.membership.renewal import rules

DUE = date(2027, 3, 1)


@pytest.mark.parametrize(
    ("today", "expected"),
    [
        (DUE - timedelta(days=31), "upcoming"),
        (DUE - timedelta(days=30), "due"),
        (DUE, "due"),
        (DUE + timedelta(days=1), "grace"),
        (DUE + timedelta(days=rules.GRACE_DAYS), "grace"),
        (DUE + timedelta(days=rules.GRACE_DAYS + 1), "lapsed"),
    ],
)
def test_a_cycle_moves_from_upcoming_to_due_to_a_sixty_day_grace(today, expected):
    assert rules.GRACE_DAYS == 60  # OD-43's recommendation
    assert rules.phase(DUE, today) == expected


def test_the_first_cycle_always_leaves_room_for_the_thirty_day_notice():
    today = date(2026, 11, 19)
    # Active for years before renewal was switched on: due in 30 days, not already overdue.
    assert rules.first_due_on(date(2023, 5, 1), today) == today + timedelta(days=30)
    # Active since last month: due on the anniversary.
    assert rules.first_due_on(date(2026, 10, 1), today) == date(2027, 10, 1)
    assert rules.next_due_on(date(2027, 10, 1)) == date(2028, 10, 1)
    assert rules.add_years(date(2028, 2, 29)) == date(2029, 2, 28)


@pytest.mark.parametrize(
    ("days_left", "sent_30", "sent_7", "expected"),
    [
        (31, False, False, None),
        (30, False, False, "renewal_due_30"),
        (12, True, False, None),
        (7, True, False, "renewal_due_7"),
        (5, False, False, "renewal_due_7"),  # late: the 30-day notice is skipped
        (3, True, True, None),
        (-1, False, False, None),  # past the due date: no "due" notice
    ],
)
def test_notices_go_thirty_and_seven_days_before_the_due_date(days_left, sent_30, sent_7, expected):
    assert rules.notice_to_send(DUE, DUE - timedelta(days=days_left), sent_30, sent_7) == expected


def test_confirmation_asks_only_for_contact_and_area():
    ok = {"contact_on_record": True, "contact_confirmed": True, "area_confirmed": True, "area_change_open": False}
    assert rules.check_confirmation(current_phase="due", **ok) == []
    assert rules.check_confirmation(current_phase="grace", **ok) == []
    assert rules.check_confirmation(current_phase="upcoming", **ok) == ["not_due_yet"]
    assert rules.check_confirmation(current_phase="confirmed", **ok) == ["already_confirmed"]
    # FR-RNW-003: a number counts only once a code confirmed it.
    assert rules.check_confirmation(current_phase="due", **{**ok, "contact_on_record": False}) == ["contact_not_confirmed"]
    assert rules.check_confirmation(current_phase="due", **{**ok, "contact_confirmed": False}) == [
        "contact_confirmation_required"
    ]
    assert rules.check_confirmation(current_phase="due", **{**ok, "area_confirmed": False}) == [
        "area_confirmation_required"
    ]
    # An area change waiting for review is the member's answer about their area.
    assert rules.check_confirmation(current_phase="due", **{**ok, "area_confirmed": False, "area_change_open": True}) == []


def test_only_a_lapse_made_by_renewal_is_undone_by_confirming():
    assert rules.may_reactivate("inactive", "renewal_lapsed", True)
    assert not rules.may_reactivate("inactive", "member_request", True)  # a staff decision stays one (BR-015)
    assert not rules.may_reactivate("suspended", "renewal_lapsed", True)
    assert not rules.may_reactivate("inactive", "renewal_lapsed", False)


def test_each_certificate_kind_needs_its_own_record():
    base = {"identity_verified": True, "membership_active": True, "attended_event": False, "completed_assignments": 0}
    assert certificates.check_issue("membership", **base) == []
    assert certificates.check_issue("membership", **{**base, "membership_active": False}) == ["membership_not_active"]
    assert certificates.check_issue("event_participation", **base) == ["no_attendance_recorded"]
    assert certificates.check_issue("event_participation", **{**base, "attended_event": True}) == []
    assert certificates.check_issue("volunteer_service", **base) == ["no_completed_assignments"]
    assert certificates.check_issue("volunteer_service", **{**base, "completed_assignments": 3}) == []


def test_only_a_valid_certificate_is_revoked_or_reissued_and_always_with_a_reason():
    assert certificates.check_status_change("valid", "Issued to the wrong person") == []
    assert certificates.check_status_change("valid", "  ") == ["reason_required"]
    assert certificates.check_status_change("revoked", "again") == ["not_allowed_from:revoked"]


def test_a_token_is_signed_stable_and_stored_only_as_a_hash():
    certificate_id = uuid.uuid4()
    token = tokens.token_for(certificate_id, "secret-one")
    assert token == tokens.token_for(certificate_id, "secret-one")
    assert token != tokens.token_for(certificate_id, "secret-two")
    assert token != tokens.token_for(uuid.uuid4(), "secret-one")
    assert len(tokens.token_hash(token)) == 64 and token not in tokens.token_hash(token)
    assert "1.2.3.4" not in tokens.caller_hash("1.2.3.4", "secret-one")
    assert certificates.check_rate(certificates.CHECKS_PER_HOUR) == "too_many_requests"
    assert certificates.check_rate(certificates.CHECKS_PER_HOUR - 1) is None


def test_help_is_for_a_member_still_to_be_verified_and_reachable():
    today = date(2026, 11, 19)
    ok = {"identity_verified": False, "review_state": None, "contact_on_record": True, "preferred_date": None, "today": today}
    assert assisted.check_request(**ok) == []
    assert assisted.check_request(**{**ok, "identity_verified": True}) == ["already_verified"]
    assert assisted.check_request(**{**ok, "review_state": "in_review"}) == ["review_open"]
    assert assisted.check_request(**{**ok, "review_state": "needs_update"}) == []
    assert assisted.check_request(**{**ok, "contact_on_record": False}) == ["contact_not_confirmed"]
    assert assisted.check_request(**{**ok, "preferred_date": today - timedelta(days=1)}) == ["preferred_date_out_of_range"]


def test_the_session_cannot_be_submitted_until_the_checklist_is_complete():
    required = ("nic_front", "nic_back", "selfie")
    everything = list(assisted.CHECKLIST)
    assert assisted.check_complete(everything, required, set(required), True) == []
    missing_one = assisted.check_complete(everything[:-1], required, set(required), True)
    assert missing_one == ["checklist_incomplete:declaration_by_member"]
    assert assisted.check_complete(everything, required, {"nic_front", "nic_back"}, True) == ["missing:selfie"]
    assert assisted.check_complete(everything, required, set(required), False) == ["consent_required"]


def test_a_camera_failure_moves_the_member_to_an_office_visit():
    assert assisted.after_abandon("camera_failure") == ("requested", "office_visit", None)
    assert assisted.after_abandon("member_declined") == ("closed", None, "member_declined")
    assert assisted.after_abandon("member_absent") == ("requested", None, None)


def test_a_session_is_scheduled_only_ahead_and_within_sixty_days():
    now = datetime(2026, 11, 19, 9, tzinfo=UTC)
    assert assisted.check_schedule("requested", now + timedelta(days=2), now) == []
    assert assisted.check_schedule("requested", now - timedelta(hours=1), now) == ["time_out_of_range"]
    assert assisted.check_schedule("completed", now + timedelta(days=2), now) == ["not_allowed_from:completed"]
