"""SQL for community ideas and their supports."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Idea:
    id: uuid.UUID
    idea_ref: str
    author_id: uuid.UUID
    title: str
    benefit: str
    area_key: str
    area_path: list[str]
    state: str
    moderation_reason: str | None
    created_at: datetime
    updated_at: datetime
    supports: int
    supported: bool


_SELECT = """
    SELECT i.id, i.idea_ref, i.author_id, i.title, i.benefit, i.area_key, i.area_path, i.state, i.moderation_reason,
           i.created_at, i.updated_at,
           (SELECT count(*) FROM community.idea_support s WHERE s.idea_id = i.id) AS supports,
           EXISTS (SELECT 1 FROM community.idea_support s WHERE s.idea_id = i.id AND s.member_id = :viewer) AS supported
    FROM community.idea i
"""


def _rows(db: Session, where: str, params: dict[str, Any]) -> list[Idea]:
    rows = db.execute(text(f"{_SELECT} WHERE {where}"), params).mappings()
    return [Idea(**{**row, "area_path": list(row["area_path"])}) for row in rows]


def find(db: Session, idea_id: uuid.UUID, viewer: uuid.UUID) -> Idea | None:
    found = _rows(db, "i.id = :id", {"id": idea_id, "viewer": viewer})
    return found[0] if found else None


def published_in(db: Session, area_keys: list[str], viewer: uuid.UUID) -> list[Idea]:
    return _rows(
        db, "i.state = 'published' AND i.area_path && CAST(:areas AS text[]) ORDER BY i.updated_at DESC LIMIT 100",
        {"areas": area_keys or ["none"], "viewer": viewer},
    )


def by_author(db: Session, author_id: uuid.UUID) -> list[Idea]:
    return _rows(db, "i.author_id = :viewer ORDER BY i.created_at DESC LIMIT 100", {"viewer": author_id})


def pending(db: Session, areas: list[str] | None, viewer: uuid.UUID, limit: int) -> list[Idea]:
    if areas is None:
        return _rows(db, "i.state = 'pending' ORDER BY i.created_at LIMIT :limit", {"limit": limit, "viewer": viewer})
    return _rows(
        db, "i.state = 'pending' AND i.area_path && CAST(:areas AS text[]) ORDER BY i.created_at LIMIT :limit",
        {"areas": areas, "limit": limit, "viewer": viewer},
    )


def count_recent(db: Session, author_id: uuid.UUID) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.idea WHERE author_id = :m AND created_at > now() - interval '1 day'"),
        {"m": author_id},
    ) or 0


def insert(db: Session, author_id: uuid.UUID, title: str, benefit: str, area_key: str, area_path: list[str]) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO community.idea (author_id, title, benefit, area_key, area_path)
               VALUES (:author, :title, :benefit, :area_key, :area_path) RETURNING id"""
        ),
        {"author": author_id, "title": title, "benefit": benefit, "area_key": area_key, "area_path": area_path},
    )


def set_state(db: Session, idea_id: uuid.UUID, state: str, *, moderator: uuid.UUID | None = None, reason: str | None = None) -> None:
    if moderator is None:
        db.execute(text("UPDATE community.idea SET state = :state, updated_at = clock_timestamp() WHERE id = :id"),
                   {"state": state, "id": idea_id})
        return
    db.execute(
        text(
            """UPDATE community.idea SET state = :state, moderation_reason = :reason, moderated_by = :by,
                      moderated_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = :id"""
        ),
        {"state": state, "reason": reason, "by": moderator, "id": idea_id},
    )


def set_support(db: Session, idea_id: uuid.UUID, member_id: uuid.UUID, support: bool) -> None:
    if support:
        db.execute(
            text("INSERT INTO community.idea_support (idea_id, member_id) VALUES (:i, :m) ON CONFLICT DO NOTHING"),
            {"i": idea_id, "m": member_id},
        )
    else:
        db.execute(text("DELETE FROM community.idea_support WHERE idea_id = :i AND member_id = :m"), {"i": idea_id, "m": member_id})
