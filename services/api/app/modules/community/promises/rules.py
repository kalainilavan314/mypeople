"""Promise Tracker rules (BRD FR-PRM-001 to 010, BR-111 to 114) as plain functions.

The Promise Office (promise.edit) drafts promises and updates; a second person with promise.publish
approves every publication and every status change (FR-PRM-003, OD-34 recommendation). Statuses
are only the six below; Completed needs evidence and Withdrawn a public reason; nothing is deleted.
A published promise past its due date becomes Delayed and needs an update within 10 working days.
"""

from datetime import date
from typing import Literal

EDIT = "promise.edit"  # PRM-40
PUBLISH = "promise.publish"  # PRM-41
UPDATE_WITHIN_WORKING_DAYS = 10

Status = Literal["not_started", "in_progress", "completed", "delayed", "blocked", "withdrawn"]
STATUSES: tuple[Status, ...] = ("not_started", "in_progress", "completed", "delayed", "blocked", "withdrawn")
Kind = Literal["party_commitment", "government_responsibility"]
Theme = Literal[
    "roads_transport", "drinking_water", "health", "education", "employment", "agriculture", "fisheries", "housing",
    "environment", "governance", "other",
]
FINAL = frozenset({"completed", "withdrawn"})


def check_publishable(*, milestones: int, planned_start: date, due_date: date) -> list[str]:
    """FR-PRM-001: every field is required by the schema; a promise also needs a milestone."""
    problems = []
    if milestones < 1:
        problems.append("milestones_required")
    if due_date < planned_start:
        problems.append("due_before_start")
    return problems


# Past the due date a promise stays Delayed until it is finished: the nightly check would only set
# it back, so an update may then change the status only to one of these (or add a note).
WHILE_OVERDUE = frozenset({"completed", "withdrawn"})


def check_update(*, current: str, new_status: str | None, evidence_refs: list[str], note: str,
                 note_ta: str | None = None, overdue: bool = False) -> list[str]:
    """FR-PRM-002: each status checked against its criteria. `overdue`: the due date has passed."""
    problems = []
    if current in FINAL and new_status is not None:
        problems.append(f"not_allowed_from:{current}")
    if new_status == "completed" and not [ref for ref in evidence_refs if ref.strip()]:
        problems.append("evidence_required")
    if new_status in ("withdrawn", "blocked") and (
        len(note.strip()) < 10 or (note_ta is not None and len(note_ta.strip()) < 10)
    ):
        problems.append("reason_required")
    if new_status == "delayed":
        problems.append("delayed_is_set_by_due_date")
    elif overdue and current not in FINAL and new_status is not None and new_status not in WHILE_OVERDUE:
        problems.append("overdue_stays_delayed")
    return problems


def check_second_person(drafter: object, approver: object, *others: object) -> str | None:
    """FR-PRM-003: neither the person who drafted nor the one who asked may approve."""
    return "own_draft" if approver in (drafter, *others) and approver is not None else None


def is_overdue(status: str, due_date: date, today: date) -> bool:
    return status not in FINAL and status != "delayed" and due_date < today


def past_due(due_date: date, today: date) -> bool:
    return due_date < today
