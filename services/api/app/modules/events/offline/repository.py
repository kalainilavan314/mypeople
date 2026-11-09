"""SQL for offline check-in: staff_ops.registered_device, scan_event and scan_event_decision
(Alembic 0023). Codes are stored only as the opaque, already-expired pass codes they were."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Device:
    staff_member_id: uuid.UUID
    device_key_hash: str
    revoked: bool


@dataclass(frozen=True)
class StoredScan:
    id: uuid.UUID
    event_id: uuid.UUID
    scanner_staff_id: uuid.UUID
    pass_code: str
    client_scan_at: datetime
    server_received_at: datetime
    status: str
    reason: str | None
    attendance_member_id: uuid.UUID | None


_SELECT_SCAN = """
    SELECT id, event_id, scanner_staff_id, pass_code, client_scan_at, server_received_at, status, reason,
           attendance_member_id
    FROM staff_ops.scan_event
"""


def _scan(row) -> StoredScan:  # type: ignore[no-untyped-def]
    return StoredScan(**row._mapping)


def insert_device(db: Session, *, device_id: uuid.UUID, staff_member_id: uuid.UUID, key_hash: str, label: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO staff_ops.registered_device (id, staff_member_id, device_key_hash, label)
            VALUES (:id, :staff, :hash, :label)
            ON CONFLICT DO NOTHING
            """
        ),
        {"id": device_id, "staff": staff_member_id, "hash": key_hash, "label": label},
    )


def device(db: Session, device_id: uuid.UUID) -> Device | None:
    row = db.execute(
        text(
            "SELECT staff_member_id, device_key_hash, revoked_at IS NOT NULL AS revoked "
            "FROM staff_ops.registered_device WHERE id = :id"
        ),
        {"id": device_id},
    ).one_or_none()
    return Device(row.staff_member_id, row.device_key_hash, row.revoked) if row else None


def scan_by_key(db: Session, idempotency_key: uuid.UUID) -> StoredScan | None:
    row = db.execute(text(f"{_SELECT_SCAN} WHERE idempotency_key = :key"), {"key": idempotency_key}).one_or_none()
    return _scan(row) if row else None


def scan_for_update(db: Session, scan_id: uuid.UUID) -> StoredScan | None:
    row = db.execute(text(f"{_SELECT_SCAN} WHERE id = :id FOR UPDATE"), {"id": scan_id}).one_or_none()
    return _scan(row) if row else None


def insert_scan(
    db: Session,
    *,
    scan_id: uuid.UUID,
    idempotency_key: uuid.UUID,
    event_id: uuid.UUID,
    device_id: uuid.UUID,
    scanner_staff_id: uuid.UUID,
    pass_code: str,
    client_scan_at: datetime,
    local_outcome: str,
    status: str,
    attendance_member_id: uuid.UUID | None,
    reason: str | None,
) -> bool:
    """False when a scan with this id was already recorded under another key (a client bug); nothing changes."""
    created = db.scalar(
        text(
            """
            INSERT INTO staff_ops.scan_event (id, idempotency_key, event_id, device_id, scanner_staff_id, pass_code,
                                              client_scan_at, local_outcome, status, attendance_member_id, reason)
            VALUES (:id, :key, :event, :device, :scanner, :code, :client_at, :local, :status, :member, :reason)
            ON CONFLICT DO NOTHING RETURNING 1
            """
        ),
        {
            "id": scan_id,
            "key": idempotency_key,
            "event": event_id,
            "device": device_id,
            "scanner": scanner_staff_id,
            "code": pass_code,
            "client_at": client_scan_at,
            "local": local_outcome,
            "status": status,
            "member": attendance_member_id,
            "reason": reason,
        },
    )
    return created is not None


def open_exceptions(db: Session, event_id: uuid.UUID) -> list[StoredScan]:
    rows = db.execute(
        text(f"{_SELECT_SCAN} WHERE event_id = :event AND status IN ('NEEDS_REVIEW', 'EXPIRED_QUEUE') ORDER BY client_scan_at, id"),
        {"event": event_id},
    ).all()
    return [_scan(row) for row in rows]


def settle_scan(db: Session, scan_id: uuid.UUID, *, status: str, member_id: uuid.UUID | None, reason: str) -> None:
    db.execute(
        text("UPDATE staff_ops.scan_event SET status = :status, attendance_member_id = :member, reason = :reason WHERE id = :id"),
        {"id": scan_id, "status": status, "member": member_id, "reason": reason},
    )


def insert_decision(db: Session, *, scan_id: uuid.UUID, decision: str, reason: str, decided_by: uuid.UUID) -> None:
    db.execute(
        text(
            "INSERT INTO staff_ops.scan_event_decision (scan_event_id, decision, reason, decided_by) "
            "VALUES (:scan, :decision, :reason, :by)"
        ),
        {"scan": scan_id, "decision": decision, "reason": reason, "by": decided_by},
    )
