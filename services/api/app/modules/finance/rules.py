"""Bank-transfer finance rules proposed by MP-DEC-001, enforced before writes."""

from datetime import date
from typing import Literal
from uuid import UUID

Status = Literal[
    "SUBMITTED", "PENDING_REVIEW", "RECONCILED", "APPROVAL_PENDING",
    "VERIFIED", "NEEDS_CORRECTION", "REJECTED", "ON_HOLD", "REFUNDED",
]

TRANSITIONS: dict[Status, frozenset[Status]] = {
    "SUBMITTED": frozenset({"PENDING_REVIEW", "NEEDS_CORRECTION", "REJECTED", "ON_HOLD"}),
    "PENDING_REVIEW": frozenset({"RECONCILED", "NEEDS_CORRECTION", "REJECTED", "ON_HOLD"}),
    "RECONCILED": frozenset({"APPROVAL_PENDING", "ON_HOLD"}),
    "APPROVAL_PENDING": frozenset({"VERIFIED", "REJECTED", "ON_HOLD"}),
    "VERIFIED": frozenset({"REFUNDED"}),
    "NEEDS_CORRECTION": frozenset({"SUBMITTED", "REJECTED"}),
    "REJECTED": frozenset(),
    "ON_HOLD": frozenset({"PENDING_REVIEW", "REJECTED"}),
    "REFUNDED": frozenset(),
}


def check_submission(amount_minor: int, transfer_date: date, today: date, bank_reference: str) -> list[str]:
    problems: list[str] = []
    if amount_minor <= 0:
        problems.append("amount_must_be_positive")
    if transfer_date > today:
        problems.append("transfer_date_in_future")
    if not 1 <= len(bank_reference.strip()) <= 120:
        problems.append("bank_reference_invalid")
    return problems


def check_transition(current: Status, target: Status) -> str | None:
    return None if target in TRANSITIONS[current] else "invalid_finance_transition"


def check_independent_approval(
    donor_id: UUID, reviewer_id: UUID, approver_id: UUID, related_party: bool,
) -> str | None:
    if approver_id == donor_id or approver_id == reviewer_id or related_party:
        return "independent_approval_required"
    return None


def receipt_code(number: int) -> str:
    if not 1 <= number <= 99999:
        raise ValueError("receipt_range_exhausted")
    return f"CN-{number:05d}"
