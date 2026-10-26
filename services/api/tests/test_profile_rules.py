"""Profile and data-subject request rules, without a database (BRD FR-PROF-003 to 005, 017 to 019)."""

from datetime import UTC, datetime

from app.modules.privacy import rules as privacy
from app.modules.profile import rules


def test_the_mobile_number_is_shown_masked():
    assert rules.mask_phone("+94771234567") == "+9477*****67"
    assert rules.mask_phone(None) is None
    assert rules.mask_phone("12345") == "*****"


def test_legal_details_are_locked():
    assert rules.LOCKED_FIELDS == ("legal_name", "date_of_birth", "id_number")


def test_an_area_change_needs_a_different_area_and_no_open_request():
    assert rules.check_area_request("GN1", "GN2", has_open_request=False) is None
    assert rules.check_area_request("GN1", "GN1", has_open_request=False) == "same_area"
    assert rules.check_area_request("GN1", "GN2", has_open_request=True) == "request_open"


def test_a_request_is_due_21_working_days_later_skipping_weekends():
    made = datetime(2026, 10, 26, 10, 30, tzinfo=UTC)  # a Monday
    due = privacy.due_date(made)
    assert due == datetime(2026, 11, 24, 10, 30, tzinfo=UTC)  # 21 weekdays on, a Tuesday
    friday = datetime(2026, 10, 30, 9, 0, tzinfo=UTC)
    assert privacy.due_date(friday).weekday() < 5


def test_a_closure_receipt_says_what_is_kept_and_promises_no_instant_deletion():
    kept = [item["kept_en"] for item in privacy.CLOSURE_RETENTION]
    assert any("30 days" in text for text in kept) and any("7 years" in text for text in kept)
    assert all(item["kept_ta"] for item in privacy.CLOSURE_RETENTION)
