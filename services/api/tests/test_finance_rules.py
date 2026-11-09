"""M1.4 finance controls are tested without enabling live intake."""

from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.modules.finance.rules import check_independent_approval, check_submission, check_transition, receipt_code


def test_submission_refuses_future_or_empty_bank_evidence() -> None:
    today = date(2026, 11, 8)
    assert check_submission(100, today, today, "BANK-1") == []
    assert check_submission(0, today + timedelta(days=1), today, " ") == [
        "amount_must_be_positive", "transfer_date_in_future", "bank_reference_invalid",
    ]


def test_approval_requires_an_independent_person() -> None:
    donor, reviewer, approver = uuid4(), uuid4(), uuid4()
    assert check_independent_approval(donor, reviewer, approver, False) is None
    assert check_independent_approval(donor, reviewer, reviewer, False) == "independent_approval_required"
    assert check_independent_approval(donor, reviewer, donor, False) == "independent_approval_required"
    assert check_independent_approval(donor, reviewer, approver, True) == "independent_approval_required"


def test_receipts_follow_final_approval_only() -> None:
    assert check_transition("SUBMITTED", "VERIFIED") == "invalid_finance_transition"
    assert check_transition("APPROVAL_PENDING", "VERIFIED") is None
    assert receipt_code(1) == "CN-00001"
    with pytest.raises(ValueError, match="receipt_range_exhausted"):
        receipt_code(100000)
