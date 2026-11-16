"""Pure P2 operational-control, assignment and disclosure rules."""

from datetime import datetime, timedelta

CONTROL_DECISIONS = {
    "offline_attendance_replay_hours": "STF-01",
    "aggregate_minimum_group_size": "GOV-01",
}

CONTROL_LIMITS = {
    "offline_attendance_replay_hours": (1, 168),
    "aggregate_minimum_group_size": (3, 1000),
}

DUTY_TYPES = (
    "registration", "scanning", "member_assistance", "accessibility_support",
    "logistics", "coordination", "administration",
)

ASSIGNMENT_TRANSITIONS = {
    "offered": frozenset({"accepted", "declined", "cancelled"}),
    "accepted": frozenset({"cancelled", "completed"}),
    "declined": frozenset(),
    "cancelled": frozenset(),
    "completed": frozenset(),
}


def control_problem(control_key: str, value: int) -> str | None:
    limits = CONTROL_LIMITS.get(control_key)
    if limits is None:
        return "unknown_control"
    if not limits[0] <= value <= limits[1]:
        return "control_value_out_of_range"
    return None


def transition_problem(current: str, target: str) -> str | None:
    if target not in ASSIGNMENT_TRANSITIONS.get(current, frozenset()):
        return "invalid_assignment_transition"
    return None


def queued_scan_problem(client_at: datetime, received_at: datetime, replay_hours: int) -> str | None:
    if client_at > received_at + timedelta(minutes=5):
        return "client_clock_ahead"
    if received_at - client_at > timedelta(hours=replay_hours):
        return "replay_window_expired"
    return None


def suppressed_cells(counts: dict[str, int], minimum: int) -> set[str]:
    """Primary plus secondary suppression, so one hidden cell cannot be derived from a total."""
    hidden = {key for key, value in counts.items() if value < minimum}
    if len(hidden) == 1 and len(counts) > 1:
        visible = [(value, key) for key, value in counts.items() if key not in hidden]
        if visible:
            hidden.add(min(visible)[1])
    return hidden
