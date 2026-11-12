"""M1.4 finance controls are tested without enabling live intake."""

from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.modules.finance.rules import (
    check_independent_approval,
    check_submission,
    check_transition,
    evaluate_risk_flags,
    production_control_problem,
    receipt_code,
)
from app.modules.finance.scanner import ClamAVScanner, MalwareDetected, ScannerUnavailable


class FakeClamAVConnection:
    def __init__(self, response: bytes) -> None:
        self.response = response
        self.sent: list[bytes] = []

    def __enter__(self):
        return self

    def __exit__(self, *_args) -> None:
        return None

    def settimeout(self, _timeout: float) -> None:
        return None

    def sendall(self, data: bytes) -> None:
        self.sent.append(data)

    def recv(self, _size: int) -> bytes:
        response, self.response = self.response, b""
        return response


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


def test_production_controls_accept_only_bounded_machine_values() -> None:
    assert production_control_problem("enhanced_review_threshold_minor", 10_000_000, None) is None
    assert production_control_problem("slip_retention_days", 0, None) == "control_value_out_of_range"
    assert production_control_problem("pilot_currency", None, "USD") == "control_value_not_allowed"
    assert production_control_problem("third_party_payment_mode", None, "manual_review") is None
    assert production_control_problem("statutory_reporting_mode", 1, None) == "text_control_value_required"


def test_manual_reporting_control_creates_an_explicit_review_warning() -> None:
    assert evaluate_risk_flags(500, 1_000, False, True, "manual_review_required") == [
        "statutory_reporting_review"
    ]


def test_clamav_streams_the_upload_and_accepts_only_an_ok_response(monkeypatch) -> None:
    connection = FakeClamAVConnection(b"stream: OK\0")
    monkeypatch.setattr(
        "app.modules.finance.scanner.socket.create_connection",
        lambda *_args, **_kwargs: connection,
    )
    ClamAVScanner("127.0.0.1", 3310, 2).scan(b"safe-image")
    assert connection.sent[0] == b"zINSTREAM\0"
    assert connection.sent[-1] == b"\0\0\0\0"


def test_clamav_rejects_malware_and_fails_closed_when_unavailable(monkeypatch) -> None:
    infected = FakeClamAVConnection(b"stream: Win.Test.EICAR FOUND\0")
    monkeypatch.setattr(
        "app.modules.finance.scanner.socket.create_connection",
        lambda *_args, **_kwargs: infected,
    )
    with pytest.raises(MalwareDetected):
        ClamAVScanner("127.0.0.1", 3310, 2).scan(b"infected")

    def unavailable(*_args, **_kwargs):
        raise OSError("clamd unavailable")

    monkeypatch.setattr("app.modules.finance.scanner.socket.create_connection", unavailable)
    with pytest.raises(ScannerUnavailable):
        ClamAVScanner("127.0.0.1", 3310, 2).scan(b"unknown")
