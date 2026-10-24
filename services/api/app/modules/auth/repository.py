"""Reads the member fields that authentication needs.

npm.member is still created and migrated by the Express API, so it is queried
with SQL instead of being declared as a model on Base. That keeps Alembic
autogenerate away from it until this API owns the table.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class SessionMember:
    id: uuid.UUID
    session_version: int


def find_session_member(db: Session, member_id: uuid.UUID) -> SessionMember | None:
    """The active (not deleted) member with this id, or None."""
    row = db.execute(
        text("SELECT id, session_version FROM npm.member WHERE id = :id AND deleted_at IS NULL"),
        {"id": member_id},
    ).one_or_none()
    if row is None:
        return None
    return SessionMember(id=row.id, session_version=row.session_version)
