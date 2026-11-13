"""SQL for moderation appeals and the two kinds of moderated item they are about (D12).

The idea and the added information are read and changed here with plain SQL: an appeal needs only
their author, state, moderator and area, and a changed decision publishes or approves them.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ModeratedItem:
    """What an appeal needs to know about the idea or the added information it is about."""

    kind: str
    id: uuid.UUID
    author_id: uuid.UUID
    state: str
    moderated_by: uuid.UUID | None
    moderated_at: datetime | None
    moderation_reason: str | None
    area_path: list[str]
    issue_id: uuid.UUID | None  # the case an addition belongs to


def find_idea(db: Session, idea_id: uuid.UUID, *, lock: bool = False) -> ModeratedItem | None:
    row = db.execute(
        text(
            f"""SELECT id, author_id, state, moderated_by, moderated_at, moderation_reason, area_path
                FROM community.idea WHERE id = :id{" FOR UPDATE" if lock else ""}"""
        ),
        {"id": idea_id},
    ).mappings().one_or_none()
    if row is None:
        return None
    return ModeratedItem(kind="idea", **{**row, "area_path": list(row["area_path"] or [])}, issue_id=None)


def find_addition(db: Session, addition_id: uuid.UUID, *, lock: bool = False) -> ModeratedItem | None:
    row = db.execute(
        text(
            f"""SELECT a.id, a.member_id AS author_id, a.state, a.moderated_by, a.moderated_at, a.moderation_reason,
                       i.area_path, a.issue_id
                FROM community.issue_addition a JOIN community.issue i ON i.id = a.issue_id
                WHERE a.id = :id{" FOR UPDATE OF a" if lock else ""}"""
        ),
        {"id": addition_id},
    ).mappings().one_or_none()
    if row is None:
        return None
    return ModeratedItem(kind="addition", **{**row, "area_path": list(row["area_path"] or [])})


def publish_idea(db: Session, idea_id: uuid.UUID, decided_by: uuid.UUID) -> None:
    """An appeal changed the decision: the idea is published and the rejection reason goes."""
    db.execute(
        text(
            """UPDATE community.idea SET state = 'published', moderation_reason = NULL, moderated_by = :by,
                      moderated_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = :id"""
        ),
        {"id": idea_id, "by": decided_by},
    )


def approve_addition(db: Session, addition_id: uuid.UUID, decided_by: uuid.UUID) -> None:
    db.execute(
        text(
            """UPDATE community.issue_addition SET state = 'approved', moderation_reason = NULL, moderated_by = :by,
                      moderated_at = clock_timestamp() WHERE id = :id"""
        ),
        {"id": addition_id, "by": decided_by},
    )


# --- Appeals ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredAppeal:
    id: uuid.UUID
    item_kind: str
    item_id: uuid.UUID
    member_id: uuid.UUID
    body: str
    original_moderator: uuid.UUID
    area_path: list[str]
    state: str
    reason: str | None
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    created_at: datetime


_APPEALS = """
    SELECT id, item_kind, item_id, member_id, body, original_moderator, area_path, state, reason, decided_by, decided_at,
           created_at
    FROM community.moderation_appeal
"""


def _appeal(row: Any) -> StoredAppeal:
    return StoredAppeal(**{**row, "area_path": list(row["area_path"] or [])})


def insert(
    db: Session, *, item_kind: str, item_id: uuid.UUID, member_id: uuid.UUID, body: str, original_moderator: uuid.UUID,
    area_path: list[str],
) -> uuid.UUID | None:
    """None when this decision was already appealed (one appeal per decision)."""
    return db.scalar(
        text(
            """
            INSERT INTO community.moderation_appeal (item_kind, item_id, member_id, body, original_moderator, area_path)
            VALUES (:kind, :item, :member, :body, :moderator, :path)
            ON CONFLICT (item_kind, item_id) DO NOTHING
            RETURNING id
            """
        ),
        {"kind": item_kind, "item": item_id, "member": member_id, "body": body, "moderator": original_moderator,
         "path": area_path},
    )


def find(db: Session, appeal_id: uuid.UUID, *, lock: bool = False) -> StoredAppeal | None:
    row = db.execute(
        text(f"{_APPEALS} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": appeal_id}
    ).mappings().one_or_none()
    return _appeal(row) if row else None


def for_item(db: Session, item_kind: str, item_id: uuid.UUID) -> StoredAppeal | None:
    row = db.execute(
        text(f"{_APPEALS} WHERE item_kind = :kind AND item_id = :item"), {"kind": item_kind, "item": item_id}
    ).mappings().one_or_none()
    return _appeal(row) if row else None


def for_items(db: Session, item_kind: str, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, StoredAppeal]:
    if not item_ids:
        return {}
    rows = db.execute(
        text(f"{_APPEALS} WHERE item_kind = :kind AND item_id = ANY(:items)"), {"kind": item_kind, "items": item_ids}
    ).mappings()
    return {row["item_id"]: _appeal(row) for row in rows}


@dataclass(frozen=True)
class ListedAppeal:
    """An appeal with what the deciding moderator reads: the item's words and the first decision."""

    appeal: StoredAppeal
    item_title: str | None
    item_text: str | None
    item_state: str | None
    original_reason: str | None
    original_decided_at: datetime | None
    issue_id: uuid.UUID | None
    case_number: str | None


def listed(
    db: Session, areas: list[str] | None, kinds: list[str], *, appeal_id: uuid.UUID | None = None, limit: int = 100
) -> list[ListedAppeal]:
    """Appeals in these areas (None: everywhere), open ones first, then the oldest first."""
    if not kinds:
        return []
    conditions = ["m.item_kind = ANY(:kinds)"]
    params: dict[str, Any] = {"kinds": kinds, "limit": limit}
    if appeal_id is not None:
        conditions.append("m.id = :appeal")
        params["appeal"] = appeal_id
    if areas is not None:
        conditions.append("m.area_path && CAST(:areas AS text[])")
        params["areas"] = areas
    rows = db.execute(
        text(
            f"""
            SELECT m.id, m.item_kind, m.item_id, m.member_id, m.body, m.original_moderator, m.area_path, m.state,
                   m.reason, m.decided_by, m.decided_at, m.created_at,
                   idea.title AS item_title,
                   COALESCE(idea.benefit, addition.body) AS item_text,
                   COALESCE(idea.state, addition.state) AS item_state,
                   COALESCE(idea.moderation_reason, addition.moderation_reason) AS original_reason,
                   COALESCE(idea.moderated_at, addition.moderated_at) AS original_decided_at,
                   issue.id AS issue_id, issue.case_number
            FROM community.moderation_appeal m
            LEFT JOIN community.idea idea ON m.item_kind = 'idea' AND idea.id = m.item_id
            LEFT JOIN community.issue_addition addition ON m.item_kind = 'addition' AND addition.id = m.item_id
            LEFT JOIN community.issue issue ON issue.id = addition.issue_id
            WHERE {" AND ".join(conditions)}
            ORDER BY (m.state = 'open') DESC, m.created_at
            LIMIT :limit
            """
        ),
        params,
    ).mappings()
    found = []
    for row in rows:
        appeal_fields = {name: row[name] for name in StoredAppeal.__dataclass_fields__}
        found.append(
            ListedAppeal(
                appeal=_appeal(appeal_fields),
                item_title=row["item_title"],
                item_text=row["item_text"],
                item_state=row["item_state"],
                original_reason=row["original_reason"],
                original_decided_at=row["original_decided_at"],
                issue_id=row["issue_id"],
                case_number=row["case_number"],
            )
        )
    return found


def decide(db: Session, appeal_id: uuid.UUID, *, state: str, reason: str, decided_by: uuid.UUID) -> None:
    db.execute(
        text(
            """UPDATE community.moderation_appeal SET state = :state, reason = :reason, decided_by = :by,
                      decided_at = clock_timestamp() WHERE id = :id"""
        ),
        {"id": appeal_id, "state": state, "reason": reason, "by": decided_by},
    )
