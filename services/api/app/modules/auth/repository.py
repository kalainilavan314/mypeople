"""SQL for authentication: member lookups, sign-in attempts and session revocation.

npm.member and npm.auth_attempt are still created and migrated by the Express
API, so they are queried with SQL instead of being declared as models on Base.
That keeps Alembic autogenerate away from them until this API owns them.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class SessionMember:
    id: uuid.UUID
    session_version: int
    # This API's session row; None for a token issued by the Express API.
    session_id: uuid.UUID | None = None
    # The staff second factor was given in this session (NFR-SEC-04).
    mfa_verified: bool = False


@dataclass(frozen=True)
class SignInMember:
    id: uuid.UUID
    session_version: int
    password_hash: str


def find_session_member(db: Session, member_id: uuid.UUID) -> SessionMember | None:
    """The active (not deleted) member with this id, or None."""
    row = db.execute(
        text("SELECT id, session_version FROM npm.member WHERE id = :id AND deleted_at IS NULL"),
        {"id": member_id},
    ).one_or_none()
    if row is None:
        return None
    return SessionMember(id=row.id, session_version=row.session_version)


def find_sign_in_member(db: Session, nic_hash: str) -> SignInMember | None:
    """The active member registered with this NIC hash, or None."""
    row = db.execute(
        text(
            "SELECT id, session_version, password_hash FROM npm.member "
            "WHERE nic_hash = :nic_hash AND deleted_at IS NULL"
        ),
        {"nic_hash": nic_hash},
    ).one_or_none()
    if row is None:
        return None
    return SignInMember(id=row.id, session_version=row.session_version, password_hash=row.password_hash)


# Shared with server/src/throttle.js (LOGIN_LOCK_SPACE): both APIs take the same
# lock, so their sign-in attempts for one number and address queue behind each other.
LOGIN_LOCK_SPACE = 30_002


def lock_attempts(db: Session, identifier: str, ip: str) -> None:
    """Hold sign-in checks for this number and address one at a time until the caller commits."""
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:identifier AS text) || '|' || CAST(:ip AS text)))"),
        {"space": LOGIN_LOCK_SPACE, "identifier": identifier, "ip": ip},
    )


def count_recent_failures(db: Session, identifier: str, ip: str, window: timedelta) -> int:
    return db.execute(
        text(
            "SELECT count(*) FROM npm.auth_attempt "
            "WHERE identifier = :identifier AND ip = :ip AND succeeded = false "
            "AND created_at > now() - :window"
        ),
        {"identifier": identifier, "ip": ip, "window": window},
    ).scalar_one()


def record_attempt(db: Session, identifier: str, ip: str, succeeded: bool) -> None:
    db.execute(
        text("INSERT INTO npm.auth_attempt (identifier, ip, succeeded) VALUES (:identifier, :ip, :succeeded)"),
        {"identifier": identifier, "ip": ip, "succeeded": succeeded},
    )


def clear_failures(db: Session, identifier: str, ip: str) -> None:
    db.execute(
        text("DELETE FROM npm.auth_attempt WHERE identifier = :identifier AND ip = :ip AND succeeded = false"),
        {"identifier": identifier, "ip": ip},
    )


def revoke_sessions(db: Session, member_id: uuid.UUID) -> None:
    """Invalidate every session token issued to this member so far."""
    db.execute(
        text("UPDATE npm.member SET session_version = session_version + 1 WHERE id = :id"),
        {"id": member_id},
    )


# --- Sessions (identity.session, Alembic 0010) -------------------------------------------------------


@dataclass(frozen=True)
class StoredSession:
    id: uuid.UUID
    member_id: uuid.UUID
    device_label: str
    created_at: datetime
    last_seen_at: datetime
    mfa_verified: bool
    revoked: bool
    idle: bool  # unused for longer than IDLE_LIMIT
    stale: bool  # last seen long enough ago to record this request


_SESSION_COLUMNS = """
    id, member_id, device_label, created_at, last_seen_at, mfa_verified_at IS NOT NULL AS mfa_verified,
    revoked_at IS NOT NULL AS revoked,
    last_seen_at < now() - CAST(:idle AS interval) AS idle,
    last_seen_at < now() - CAST(:touch AS interval) AS stale
"""


def start_session(db: Session, member_id: uuid.UUID, device_label: str, device_key: str) -> tuple[uuid.UUID, bool]:
    """Record a new session; also says whether this member signed in from this device before."""
    seen_before = bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM identity.session WHERE member_id = :member AND device_key = :key)"),
            {"member": member_id, "key": device_key},
        )
    )
    had_sessions = bool(
        db.scalar(text("SELECT EXISTS (SELECT 1 FROM identity.session WHERE member_id = :member)"), {"member": member_id})
    )
    session_id = db.scalar(
        text(
            """
            INSERT INTO identity.session (member_id, device_label, device_key)
            VALUES (:member, :label, :key) RETURNING id
            """
        ),
        {"member": member_id, "label": device_label, "key": device_key},
    )
    return session_id, had_sessions and not seen_before


def find_session(db: Session, session_id: uuid.UUID, idle: str, touch: str) -> StoredSession | None:
    row = db.execute(
        text(f"SELECT {_SESSION_COLUMNS} FROM identity.session WHERE id = :id"),
        {"id": session_id, "idle": idle, "touch": touch},
    ).mappings().one_or_none()
    return StoredSession(**row) if row else None


def active_sessions(db: Session, member_id: uuid.UUID, idle: str) -> list[StoredSession]:
    rows = db.execute(
        text(
            f"""
            SELECT {_SESSION_COLUMNS} FROM identity.session
            WHERE member_id = :member AND revoked_at IS NULL AND last_seen_at >= now() - CAST(:idle AS interval)
            ORDER BY last_seen_at DESC
            """
        ),
        {"member": member_id, "idle": idle, "touch": "0 seconds"},
    ).mappings()
    return [StoredSession(**row) for row in rows]


def touch_session(db: Session, session_id: uuid.UUID) -> None:
    db.execute(text("UPDATE identity.session SET last_seen_at = clock_timestamp() WHERE id = :id"), {"id": session_id})


def revoke_session(db: Session, session_id: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """
            UPDATE identity.session SET revoked_at = clock_timestamp(), revoked_reason = :reason
            WHERE id = :id AND revoked_at IS NULL
            """
        ),
        {"id": session_id, "reason": reason},
    )


def revoke_member_sessions(db: Session, member_id: uuid.UUID, reason: str, keep: uuid.UUID | None = None) -> None:
    db.execute(
        text(
            """
            UPDATE identity.session SET revoked_at = clock_timestamp(), revoked_reason = :reason
            WHERE member_id = :member AND revoked_at IS NULL AND (CAST(:keep AS uuid) IS NULL OR id <> :keep)
            """
        ),
        {"member": member_id, "reason": reason, "keep": keep},
    )


def mark_session_mfa_verified(db: Session, session_id: uuid.UUID) -> None:
    db.execute(
        text("UPDATE identity.session SET mfa_verified_at = clock_timestamp(), mfa_failures = 0 WHERE id = :id"),
        {"id": session_id},
    )


def add_mfa_failure(db: Session, session_id: uuid.UUID) -> int:
    return db.scalar(
        text("UPDATE identity.session SET mfa_failures = mfa_failures + 1 WHERE id = :id RETURNING mfa_failures"),
        {"id": session_id},
    )


# --- Authenticator factors (identity.mfa_factor) --------------------------------------------------------


@dataclass(frozen=True)
class StoredFactor:
    secret_sealed: bytes
    enabled: bool
    last_used_step: int | None
    failed_attempts: int
    lockouts: int
    locked_for: int  # seconds until the lockout ends; 0 when not locked


def find_factor(db: Session, member_id: uuid.UUID, *, for_update: bool = False) -> StoredFactor | None:
    """for_update holds the row until the caller commits, so two codes checked at the same
    moment are counted and used one after the other."""
    row = db.execute(
        text(
            f"""
            SELECT secret_sealed, enabled_at IS NOT NULL AS enabled, last_used_step, failed_attempts, lockouts,
                   GREATEST(0, CEIL(EXTRACT(EPOCH FROM locked_until - clock_timestamp())))::int AS locked_for
            FROM identity.mfa_factor WHERE member_id = :id {"FOR UPDATE" if for_update else ""}
            """
        ),
        {"id": member_id},
    ).one_or_none()
    if row is None:
        return None
    return StoredFactor(
        bytes(row.secret_sealed), row.enabled, row.last_used_step, row.failed_attempts, row.lockouts, row.locked_for
    )


def add_factor_failure(db: Session, member_id: uuid.UUID) -> int:
    return db.scalar(
        text(
            """
            UPDATE identity.mfa_factor SET failed_attempts = failed_attempts + 1
            WHERE member_id = :id RETURNING failed_attempts
            """
        ),
        {"id": member_id},
    )


def lock_factor(db: Session, member_id: uuid.UUID, seconds: int) -> None:
    db.execute(
        text(
            """
            UPDATE identity.mfa_factor
            SET locked_until = clock_timestamp() + make_interval(secs => :seconds), lockouts = lockouts + 1,
                failed_attempts = 0
            WHERE member_id = :id
            """
        ),
        {"id": member_id, "seconds": seconds},
    )


def save_pending_factor(db: Session, member_id: uuid.UUID, secret_sealed: bytes) -> None:
    db.execute(
        text(
            """
            INSERT INTO identity.mfa_factor (member_id, kind, secret_sealed) VALUES (:id, 'totp', :secret)
            ON CONFLICT (member_id) DO UPDATE
            SET secret_sealed = EXCLUDED.secret_sealed, created_at = clock_timestamp(), enabled_at = NULL,
                last_used_step = NULL
            WHERE identity.mfa_factor.enabled_at IS NULL
            """
        ),
        {"id": member_id, "secret": secret_sealed},
    )


def use_factor(db: Session, member_id: uuid.UUID, step: int) -> None:
    """Record the step just used (so it cannot be used again), clear the failure counts and
    enable a pending factor."""
    db.execute(
        text(
            """
            UPDATE identity.mfa_factor
            SET last_used_step = :step, enabled_at = COALESCE(enabled_at, clock_timestamp()),
                failed_attempts = 0, lockouts = 0, locked_until = NULL
            WHERE member_id = :id
            """
        ),
        {"id": member_id, "step": step},
    )


def member_code(db: Session, member_id: uuid.UUID) -> str:
    return db.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member_id})
