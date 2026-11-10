"""Offline check-in (MP-DEC-001 4.3 to 4.5, FR-STF-005): scans a staff phone queued without a
connection are judged by the server when it reconnects. Nothing the phone decided is final.

Each scan is checked as at the moment the phone recorded it: the pass code's own signature and
expiry, the member's Going answer, this event and its check-in window. The 60-second HMAC codes
stay verifiable only here, since the signing secret never reaches a device (MP-DEC-001 4.4).
A scan the server cannot judge safely (the phone's clock ahead of the server's, or older than the
replay window) waits for a person, and nothing is ever dropped.

Offline check-in is off until the replay window is approved under STF-01 and recorded as an
operational control; a newer STF-01 revision under review switches it off again. Phones are
registered, listed and revoked through /v1/operations/devices.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.core.rotating_codes import CodeExpired, CodeInvalid
from app.modules.access.rules import AreaPath, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.events import repository as events_repository
from app.modules.events import rules
from app.modules.events import service as events
from app.modules.events.offline import repository
from app.modules.events.repository import StoredEvent
from app.modules.events.rules import MANAGE, SCAN
from app.modules.operations import repository as operations
from app.modules.operations.rules import queued_scan_problem

Status = Literal["ACCEPTED", "DUPLICATE", "REJECTED", "NEEDS_REVIEW", "EXPIRED_QUEUE"]
MAX_BATCH = 200
REPLAY_CONTROL = "offline_attendance_replay_hours"


class OfflineNotApproved(Exception):
    """No current, approved STF-01 replay window: queued scans stay on the phone."""


class DeviceRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ScanNotFound(Exception):
    pass


class DecisionRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class QueuedScan:
    scan_id: uuid.UUID
    idempotency_key: uuid.UUID
    code: str
    client_scan_at: datetime
    local_outcome: str


@dataclass(frozen=True)
class Outcome:
    scan_id: uuid.UUID
    status: Status
    reason: str | None
    member_code: str | None = None


def _area_path(event: StoredEvent) -> AreaPath:
    return tuple(area_from_key(key) for key in event.area_path)


def _key_hash(device_key: str) -> str:
    return hashlib.sha256(device_key.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _check_device(db: Session, staff: Staff, device_id: uuid.UUID, device_key: str) -> None:
    stored = repository.device(db, device_id)
    if (
        stored is None
        or stored.revoked
        or stored.staff_member_id != staff.member_id
        or not hmac.compare_digest(stored.device_key_hash, _key_hash(device_key))
    ):
        raise DeviceRefused("device_not_registered")


def _judge(db: Session, staff_id: uuid.UUID, event: StoredEvent, code: str, at: datetime, secret: str) -> tuple[Status, str | None, uuid.UUID | None]:
    """The pass as it stood at `at`, and the attendance it records when genuine."""
    try:
        ref = rules.PASS.read(code, secret, int(at.timestamp()))
    except CodeExpired:
        return "REJECTED", "expired", None
    except CodeInvalid:
        return "REJECTED", "not_valid", None
    found = events_repository.rsvp_by_pass_ref(db, ref)
    if found is not None and found[1] == staff_id:
        return "REJECTED", "own_pass", None  # nobody checks themselves in (BR-085)
    pass_event_id, member_id = found if found else (None, None)
    result = rules.scan_result(
        pass_event_id=pass_event_id,
        scanned_event_id=event.id,
        within_window=event.state == "published" and event.checkin_opens_at <= at <= event.checkin_closes_at,
        already_attended=member_id is not None and events_repository.attended_at(db, event.id, member_id) is not None,
    )
    if result == "checked_in":
        created = events_repository.record_attendance(db, event.id, member_id, staff_id, scanned_at=at)  # type: ignore[arg-type]
        return ("ACCEPTED", None, member_id) if created else ("DUPLICATE", "already_checked_in", member_id)
    if result == "already_checked_in":
        return "DUPLICATE", "already_checked_in", member_id
    return "REJECTED", result, None


def sync(
    db: Session, staff: Staff, event_id: uuid.UUID, device_id: uuid.UUID, device_key: str, scans: list[QueuedScan], secret: str, ip: str
) -> list[Outcome]:
    """Judges a batch of queued scans for one event. A scan sent again returns its first outcome."""
    event = events.event_for_staff(db, staff, event_id, ip, permission=SCAN)
    window = operations.current_control(db, REPLAY_CONTROL)
    if window is None:
        raise OfflineNotApproved()
    _check_device(db, staff, device_id, device_key)
    operations.touch_device(db, device_id)
    received = _now()
    outcomes: list[Outcome] = []
    counts: dict[str, int] = {}
    for scan in scans:
        earlier = repository.scan_by_key(db, scan.idempotency_key)
        if earlier is not None:
            outcomes.append(Outcome(earlier.id, earlier.status, earlier.reason))  # type: ignore[arg-type]
            continue
        at = scan.client_scan_at.astimezone(UTC)
        member_id = None
        problem = queued_scan_problem(at, received, window.integer_value)
        if problem == "client_clock_ahead":
            status, reason = "NEEDS_REVIEW", "clock_ahead"  # a phone's clock is not proof of a future check-in
        elif problem == "replay_window_expired":
            status, reason = "EXPIRED_QUEUE", "too_old"
        else:
            status, reason, member_id = _judge(db, staff.member_id, event, scan.code, at, secret)
        if not repository.insert_scan(
            db, scan_id=scan.scan_id, idempotency_key=scan.idempotency_key, event_id=event.id, device_id=device_id,
            scanner_staff_id=staff.member_id, pass_code=scan.code, client_scan_at=at, local_outcome=scan.local_outcome,
            status=status, attendance_member_id=member_id, reason=reason,
        ):
            status, reason, member_id = "REJECTED", "duplicate_scan_id", None
        counts[status] = counts.get(status, 0) + 1
        member_code = events_repository.member_name(db, member_id)[1] if member_id and status != "REJECTED" else None
        outcomes.append(Outcome(scan.scan_id, status, reason, member_code))  # type: ignore[arg-type]
    audit.record(
        db, actor_id=staff.member_id, action="events.attendance.offline_synced", target_type="event",
        target_id=str(event.id), area_path=_area_path(event), details={"eventRef": event.event_ref, "deviceId": str(device_id), **counts}, ip=ip,
    )
    db.commit()
    return outcomes


def exceptions(db: Session, staff: Staff, event_id: uuid.UUID, ip: str) -> list[repository.StoredScan]:
    """Queued scans that wait for a person (clock ahead, or past the replay window), for the managers who settle them."""
    event = events.event_for_staff(db, staff, event_id, ip, permission=MANAGE)
    found = repository.open_exceptions(db, event.id)
    db.commit()
    return found


def decide(
    db: Session, staff: Staff, scan_id: uuid.UUID, decision: Literal["accepted", "rejected"], reason: str, secret: str, ip: str
) -> Outcome:
    """A person settles a waiting scan with a reason; never the one who scanned it (MP-DEC-001 4.5).
    Accepting still needs a genuine pass for this event as at the recorded time."""
    scan = repository.scan_for_update(db, scan_id)
    if scan is None:
        raise ScanNotFound()
    event = events.event_for_staff(db, staff, scan.event_id, ip, permission=MANAGE)
    if scan.status not in ("NEEDS_REVIEW", "EXPIRED_QUEUE"):
        raise DecisionRefused("already_settled")
    if scan.scanner_staff_id == staff.member_id:
        raise DecisionRefused("own_scan")
    status: Status = "REJECTED"
    member_id = None
    if decision == "accepted":
        status, judged_reason, member_id = _judge(db, scan.scanner_staff_id, event, scan.pass_code, scan.client_scan_at, secret)
        if status == "REJECTED":
            db.rollback()
            raise DecisionRefused(f"pass_{judged_reason}")
    repository.settle_scan(db, scan.id, status=status, member_id=member_id, reason=reason)
    repository.insert_decision(db, scan_id=scan.id, decision=decision, reason=reason, decided_by=staff.member_id)
    audit.record(
        db, actor_id=staff.member_id, action="events.attendance.offline_decided", target_type="scan_event",
        target_id=str(scan.id), area_path=_area_path(event), details={"eventRef": event.event_ref, "decision": decision, "status": status}, ip=ip,
    )
    db.commit()
    return Outcome(scan.id, status, reason)
