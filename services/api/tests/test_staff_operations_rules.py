from datetime import UTC, datetime, timedelta

from app.modules.engagement.staff_operations_rules import check_member_response, check_shift, provisional_scan_state


def test_volunteer_controls() -> None:
    start = datetime(2026, 11, 8, 9, tzinfo=UTC)
    end = start + timedelta(hours=3)
    assert check_shift(start, end, start, end) is None
    assert check_shift(end, start, start, end) == "shift_end_before_start"
    assert check_member_response("offered", True, "accept") is None
    assert check_member_response("offered", False, "accept") == "not_assignee"
    assert check_member_response("declined", True, "accept") == "assignment_not_open"


def test_offline_scan_never_becomes_final_without_server_validation() -> None:
    received = datetime(2026, 11, 8, 9, tzinfo=UTC)
    assert provisional_scan_state(received, received, True, True) == "NEEDS_REVIEW"
    assert provisional_scan_state(received - timedelta(hours=73), received, True, True) == "EXPIRED_QUEUE"
    assert provisional_scan_state(received, received, False, True) == "REJECTED"
    assert provisional_scan_state(received, received, True, False) == "REJECTED"
