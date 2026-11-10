"""Bank-transfer finance rules proposed by MP-DEC-001 and M1.4, enforced before writes."""

from datetime import date
from typing import Literal
from uuid import UUID

Status = Literal[
    "DRAFT",
    "SUBMITTED",
    "PENDING_REVIEW",
    "RECONCILED",
    "APPROVAL_PENDING",
    "VERIFIED",
    "NEEDS_CORRECTION",
    "REJECTED",
    "ON_HOLD",
    "REFUNDED",
]

TRANSITIONS: dict[Status, frozenset[Status]] = {
    "DRAFT": frozenset({"SUBMITTED"}),
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

RiskFlag = Literal["duplicate_bank_reference", "enhanced_review_threshold", "third_party_payment"]


def check_submission(amount_minor: int, transfer_date: date, today: date, bank_reference: str) -> list[str]:
    problems: list[str] = []
    if amount_minor <= 0:
        problems.append("amount_must_be_positive")
    if transfer_date > today:
        problems.append("transfer_date_in_future")
    if not 1 <= len(bank_reference.strip()) <= 120:
        problems.append("bank_reference_invalid")
    return problems


def check_declarations(
    no_privilege_acknowledged: bool,
    information_accurate_acknowledged: bool,
) -> list[str]:
    problems: list[str] = []
    if not no_privilege_acknowledged:
        problems.append("no_privilege_declaration_required")
    if not information_accurate_acknowledged:
        problems.append("accuracy_declaration_required")
    return problems


def check_transition(current: Status, target: Status) -> str | None:
    return None if target in TRANSITIONS[current] else "invalid_finance_transition"


def check_independent_approval(
    donor_id: UUID,
    reviewer_id: UUID,
    approver_id: UUID,
    related_party: bool,
) -> str | None:
    if approver_id == donor_id or approver_id == reviewer_id or related_party:
        return "independent_approval_required"
    return None


def check_claim(donor_id: UUID, reviewer_id: UUID) -> str | None:
    if reviewer_id == donor_id:
        return "donor_cannot_review_own_contribution"
    return None


def evaluate_risk_flags(
    amount_minor: int,
    threshold_minor: int,
    has_duplicate_reference: bool,
    paying_for_self: bool,
) -> list[str]:
    flags: list[str] = []
    if has_duplicate_reference:
        flags.append("duplicate_bank_reference")
    if amount_minor >= threshold_minor:
        flags.append("enhanced_review_threshold")
    if not paying_for_self:
        flags.append("third_party_payment")
    return flags


def receipt_code(number: int) -> str:
    if not 1 <= number <= 99999:
        raise ValueError("receipt_range_exhausted")
    return f"CN-{number:05d}"
