import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.events.offline.repository import StoredScan
from app.modules.events.offline.service import MAX_BATCH, Outcome, QueuedScan

Status = Literal["ACCEPTED", "DUPLICATE", "REJECTED", "NEEDS_REVIEW", "EXPIRED_QUEUE"]


class ScannerDeviceIn(CamelModel):
    """A staff phone's own id and a random secret it keeps; the server stores only the secret's hash."""

    device_id: uuid.UUID
    device_key: str = Field(min_length=32, max_length=200)
    label: str = Field(min_length=1, max_length=80)


class QueuedScanIn(CamelModel):
    scan_event_id: uuid.UUID
    idempotency_key: uuid.UUID
    code: str = Field(min_length=1, max_length=1024)
    client_scan_at: datetime = Field(description="When the phone recorded the scan, with its time zone")
    local_outcome: str = Field(min_length=1, max_length=40)

    def queued(self) -> QueuedScan:
        return QueuedScan(self.scan_event_id, self.idempotency_key, self.code, self.client_scan_at, self.local_outcome)


class OfflineSyncIn(CamelModel):
    device_id: uuid.UUID
    device_key: str = Field(min_length=32, max_length=200)
    scans: list[QueuedScanIn] = Field(min_length=1, max_length=MAX_BATCH)


class ScanOutcomeOut(CamelModel):
    """ACCEPTED (attendance recorded), DUPLICATE (already checked in), REJECTED with the reason
    (expired, not_valid, own_pass, wrong_event, outside_window), or waiting for a person:
    NEEDS_REVIEW (clock_ahead) and EXPIRED_QUEUE (too_old, past the 72-hour window)."""

    scan_event_id: uuid.UUID
    status: Status
    reason: str | None
    member_code: str | None = None

    @classmethod
    def build(cls, outcome: Outcome) -> Self:
        return cls(scan_event_id=outcome.scan_id, status=outcome.status, reason=outcome.reason, member_code=outcome.member_code)


class OfflineSyncOut(CamelModel):
    outcomes: list[ScanOutcomeOut]


class ScanExceptionOut(CamelModel):
    """A queued scan waiting for a person. No member is named: the pass is checked when it is accepted."""

    scan_event_id: uuid.UUID
    status: Status
    reason: str | None
    client_scan_at: datetime
    server_received_at: datetime

    @classmethod
    def build(cls, scan: StoredScan) -> Self:
        return cls(
            scan_event_id=scan.id,
            status=scan.status,  # type: ignore[arg-type]
            reason=scan.reason,
            client_scan_at=scan.client_scan_at,
            server_received_at=scan.server_received_at,
        )


class ScanDecisionIn(CamelModel):
    decision: Literal["accepted", "rejected"]
    reason: str = Field(min_length=3, max_length=1000)
