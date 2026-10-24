"""SQL for authentication: member lookups, sign-in attempts and session revocation.

npm.member and npm.auth_attempt are still created and migrated by the Express
API, so they are queried with SQL instead of being declared as models on Base.
That keeps Alembic autogenerate away from them until this API owns them.
"""

import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class SessionMember:
    id: uuid.UUID
    session_version: int


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
