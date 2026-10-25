"""SQL for one-time codes (npm.otp, shared with Express), recovery contacts and assisted
recovery requests (Alembic revision 0009)."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.identity.recovery.rules import MAX_CODE_ATTEMPTS, CodeRequests

# --- One-time codes, as server/src/throttle.js issues and consumes them ------------------------------


def code_requests(db: Session, phone: str, ip: str) -> CodeRequests:
    row = db.execute(
        text(
            """
            SELECT count(*) FILTER (WHERE phone = :phone AND created_at > now() - interval '1 minute') AS minute,
                   count(*) FILTER (WHERE phone = :phone AND created_at > now() - interval '1 hour') AS hour,
                   count(*) FILTER (WHERE phone = :phone AND created_at > now() - interval '1 day') AS day,
                   count(*) FILTER (WHERE ip = :ip AND created_at > now() - interval '10 minutes') AS ip_window
            FROM npm.otp WHERE created_at > now() - interval '1 day'
            """
        ),
        {"phone": phone, "ip": ip},
    ).one()
    return CodeRequests(row.minute, row.hour, row.day, row.ip_window)


def issue_code(db: Session, *, phone: str, purpose: str, code_hash: str, ip: str, lifetime: timedelta) -> None:
    """Issuing a code burns any still outstanding for the same phone and purpose, so asking ten
    times never gives ten live codes to guess at."""
    db.execute(
        text("UPDATE npm.otp SET consumed = true WHERE phone = :phone AND purpose = :purpose AND consumed = false"),
        {"phone": phone, "purpose": purpose},
    )
    db.execute(
        text(
            """
            INSERT INTO npm.otp (phone, code, purpose, ip, expires_at)
            VALUES (:phone, :code, :purpose, :ip, now() + make_interval(secs => :seconds))
            """
        ),
        {"phone": phone, "code": code_hash, "purpose": purpose, "ip": ip, "seconds": lifetime.total_seconds()},
    )


CodeResult = Literal["ok", "invalid", "too_many_attempts"]


def consume_code(db: Session, *, phone: str, purpose: str, code_hash: str) -> CodeResult:
    """Wrong guesses count against the code, which is burnt after five (throttle.js consumeOtp)."""
    row = db.execute(
        text(
            """
            SELECT id, code, attempts FROM npm.otp
            WHERE phone = :phone AND purpose = :purpose AND consumed = false AND expires_at > now()
            ORDER BY created_at DESC LIMIT 1 FOR UPDATE
            """
        ),
        {"phone": phone, "purpose": purpose},
    ).one_or_none()
    if row is None:
        return "invalid"
    if row.attempts >= MAX_CODE_ATTEMPTS:
        db.execute(text("UPDATE npm.otp SET consumed = true WHERE id = :id"), {"id": row.id})
        return "too_many_attempts"
    if row.code != code_hash:
        attempts = db.scalar(
            text("UPDATE npm.otp SET attempts = attempts + 1 WHERE id = :id RETURNING attempts"), {"id": row.id}
        )
        if attempts >= MAX_CODE_ATTEMPTS:
            db.execute(text("UPDATE npm.otp SET consumed = true WHERE id = :id"), {"id": row.id})
        return "invalid"
    db.execute(text("UPDATE npm.otp SET consumed = true WHERE id = :id"), {"id": row.id})
    return "ok"


# --- Recovery contacts ------------------------------------------------------------------------------


@dataclass(frozen=True)
class RecoveryContact:
    phone: str
    confirmed_at: datetime
    confirmed_by: uuid.UUID | None
    changed_at: datetime


def find_contact(db: Session, member_id: uuid.UUID) -> RecoveryContact | None:
    row = db.execute(
        text("SELECT phone, confirmed_at, confirmed_by, changed_at FROM identity.recovery_contact WHERE member_id = :id"),
        {"id": member_id},
    ).mappings().one_or_none()
    return RecoveryContact(**row) if row else None


def phone_in_use(db: Session, phone: str, member_id: uuid.UUID) -> bool:
    """Another account already has this number (npm.member.phone is unique, as is the contact)."""
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM npm.member WHERE phone = :phone AND id <> :id AND deleted_at IS NULL)
                    OR EXISTS (SELECT 1 FROM identity.recovery_contact WHERE phone = :phone AND member_id <> :id)
                """
            ),
            {"phone": phone, "id": member_id},
        )
    )


def set_contact(db: Session, member_id: uuid.UUID, phone: str, confirmed_by: uuid.UUID | None) -> None:
    """Save the confirmed number, and copy it to npm.member.phone, which the live app shows."""
    db.execute(
        text(
            """
            INSERT INTO identity.recovery_contact (member_id, phone, confirmed_by)
            VALUES (:id, :phone, :confirmed_by)
            ON CONFLICT (member_id) DO UPDATE
            SET phone = EXCLUDED.phone, confirmed_by = EXCLUDED.confirmed_by,
                confirmed_at = clock_timestamp(), changed_at = clock_timestamp()
            """
        ),
        {"id": member_id, "phone": phone, "confirmed_by": confirmed_by},
    )
    db.execute(text("UPDATE npm.member SET phone = :phone WHERE id = :id"), {"phone": phone, "id": member_id})


def member_by_id_hash(db: Session, id_hash: str) -> uuid.UUID | None:
    return db.scalar(
        text("SELECT id FROM npm.member WHERE nic_hash = :hash AND deleted_at IS NULL"), {"hash": id_hash}
    )


def session_version(db: Session, member_id: uuid.UUID) -> int | None:
    return db.scalar(
        text("SELECT session_version FROM npm.member WHERE id = :id AND deleted_at IS NULL"), {"id": member_id}
    )


def set_password(db: Session, member_id: uuid.UUID, password_hash: str) -> None:
    """A new password ends every session of the member, in both APIs (FR-AUTH-016)."""
    db.execute(
        text(
            """
            UPDATE npm.member SET password_hash = :hash, session_version = session_version + 1
            WHERE id = :id AND deleted_at IS NULL
            """
        ),
        {"hash": password_hash, "id": member_id},
    )


def registrations_from(db: Session, ip: str) -> int:
    """Accounts registered from one address in the last hour, read from the audit log."""
    return db.scalar(
        text(
            """
            SELECT count(*) FROM ops.audit_log
            WHERE action = 'identity.account.registered' AND ip = :ip AND occurred_at > now() - interval '1 hour'
            """
        ),
        {"ip": ip},
    )


# --- Assisted recovery (FR-AUTH-017) ------------------------------------------------------------------


@dataclass(frozen=True)
class AssistedRequest:
    id: uuid.UUID
    reference: str
    member_id: uuid.UUID | None
    contact_method: str
    contact_value: str | None
    message: str | None
    area_path: list[str]
    state: str
    requested_at: datetime
    resolved_by: uuid.UUID | None
    resolved_at: datetime | None
    outcome_note: str | None


_SELECT_ASSISTED = """
    SELECT id, reference, member_id, contact_method, contact_value, message, area_path, state, requested_at,
           resolved_by, resolved_at, outcome_note
    FROM identity.assisted_recovery
"""


def assisted_requests_from(db: Session, ip: str) -> int:
    return db.scalar(
        text(
            "SELECT count(*) FROM identity.assisted_recovery WHERE ip = :ip AND requested_at > now() - interval '1 hour'"
        ),
        {"ip": ip},
    )


def insert_assisted(
    db: Session,
    *,
    member_id: uuid.UUID | None,
    contact_method: str,
    contact_value: str | None,
    message: str | None,
    area_path: list[str],
    ip: str,
) -> AssistedRequest:
    request_id = db.scalar(
        text(
            """
            INSERT INTO identity.assisted_recovery (member_id, contact_method, contact_value, message, area_path, ip)
            VALUES (:member_id, :method, :value, :message, :area_path, :ip)
            RETURNING id
            """
        ),
        {
            "member_id": member_id,
            "method": contact_method,
            "value": contact_value,
            "message": message,
            "area_path": area_path,
            "ip": ip,
        },
    )
    found = find_assisted(db, request_id)
    assert found is not None
    return found


def find_assisted(db: Session, request_id: uuid.UUID, *, for_update: bool = False) -> AssistedRequest | None:
    lock = " FOR UPDATE" if for_update else ""
    row = db.execute(text(f"{_SELECT_ASSISTED} WHERE id = :id{lock}"), {"id": request_id}).mappings().one_or_none()
    return AssistedRequest(**row) if row else None


def assisted_queue(db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int) -> list[AssistedRequest]:
    conditions = ["state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit}
    if visible_areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_SELECT_ASSISTED} WHERE {' AND '.join(conditions)} ORDER BY requested_at LIMIT :limit"), params
    ).mappings()
    return [AssistedRequest(**row) for row in rows]


def resolve_assisted(db: Session, request_id: uuid.UUID, *, state: str, resolved_by: uuid.UUID, note: str) -> None:
    db.execute(
        text(
            """
            UPDATE identity.assisted_recovery
            SET state = :state, resolved_by = :resolved_by, resolved_at = clock_timestamp(), outcome_note = :note
            WHERE id = :id AND state = 'open'
            """
        ),
        {"id": request_id, "state": state, "resolved_by": resolved_by, "note": note},
    )
