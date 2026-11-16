from datetime import UTC, datetime, timedelta

from app.modules.operations import rules


def test_operational_controls_are_bounded() -> None:
    assert rules.control_problem("offline_attendance_replay_hours", 72) is None
    assert rules.control_problem("offline_attendance_replay_hours", 0) == "control_value_out_of_range"
    assert rules.control_problem("aggregate_minimum_group_size", 10) is None
    assert rules.control_problem("aggregate_minimum_group_size", 2) == "control_value_out_of_range"
    assert rules.control_problem("unknown", 10) == "unknown_control"


def test_assignment_state_machine_is_one_way() -> None:
    assert rules.transition_problem("offered", "accepted") is None
    assert rules.transition_problem("accepted", "completed") is None
    assert rules.transition_problem("completed", "accepted") == "invalid_assignment_transition"
    assert rules.transition_problem("declined", "accepted") == "invalid_assignment_transition"


def test_offline_queue_uses_server_receipt_time() -> None:
    received = datetime(2026, 11, 10, 10, tzinfo=UTC)
    assert rules.queued_scan_problem(received - timedelta(hours=71), received, 72) is None
    assert rules.queued_scan_problem(received - timedelta(hours=73), received, 72) == "replay_window_expired"
    assert rules.queued_scan_problem(received + timedelta(minutes=6), received, 72) == "client_clock_ahead"


def test_single_small_cell_triggers_secondary_suppression() -> None:
    counts = {"registration": 2, "scanning": 14, "logistics": 18}
    assert rules.suppressed_cells(counts, 10) == {"registration", "scanning"}


def test_multiple_small_cells_need_no_extra_suppression() -> None:
    counts = {"registration": 2, "scanning": 4, "logistics": 18}
    assert rules.suppressed_cells(counts, 10) == {"registration", "scanning"}
