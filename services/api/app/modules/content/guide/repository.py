"""SQL for livelihood guide entries and the reports that an entry is outdated."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Entry:
    id: uuid.UUID
    entry_ref: str
    category: str
    title_en: str | None
    title_ta: str | None
    summary_en: str | None
    summary_ta: str | None
    body_en: str | None
    body_ta: str | None
    provider_en: str | None
    provider_ta: str | None
    contact: str | None
    source_url: str | None
    published_on: date | None
    verified_on: date | None
    expires_on: date | None
    state: str
    drafted_by: uuid.UUID
    updated_by: uuid.UUID
    review_requested_by: uuid.UUID | None
    reviewed_by: uuid.UUID | None
    review_note: str | None
    published_at: datetime | None
    withdrawn_reason: str | None
    open_reports: int
    created_at: datetime
    updated_at: datetime


FIELDS = (
    "category", "title_en", "title_ta", "summary_en", "summary_ta", "body_en", "body_ta", "provider_en", "provider_ta",
    "contact", "source_url", "published_on", "verified_on", "expires_on",
)

_ENTRY = """
    SELECT e.id, e.entry_ref, e.category, e.title_en, e.title_ta, e.summary_en, e.summary_ta, e.body_en, e.body_ta,
           e.provider_en, e.provider_ta, e.contact, e.source_url, e.published_on, e.verified_on, e.expires_on, e.state,
           e.drafted_by, e.updated_by, e.review_requested_by, e.reviewed_by, e.review_note, e.published_at,
           e.withdrawn_reason,
           (SELECT count(*) FROM content.guide_report r WHERE r.entry_id = e.id AND r.state = 'open') AS open_reports,
           e.created_at, e.updated_at
    FROM content.guide_entry e
"""

_SEARCHED = """(e.title_en ILIKE :q OR e.title_ta ILIKE :q OR e.summary_en ILIKE :q OR e.summary_ta ILIKE :q
                 OR e.body_en ILIKE :q OR e.body_ta ILIKE :q OR e.provider_en ILIKE :q OR e.provider_ta ILIKE :q
                 OR e.entry_ref ILIKE :q)"""


def find(db: Session, entry_id: uuid.UUID, *, lock: bool = False) -> Entry | None:
    row = db.execute(
        text(f"{_ENTRY} WHERE e.id = :id{' FOR UPDATE OF e' if lock else ''}"), {"id": entry_id}
    ).mappings().one_or_none()
    return Entry(**row) if row else None


def published(db: Session, *, today: date, category: str | None, pattern: str | None, limit: int = 200) -> list[Entry]:
    """M39: published entries that have not passed their end date, most recently checked first."""
    conditions = ["e.state = 'published'", "(e.expires_on IS NULL OR e.expires_on >= :today)"]
    params: dict[str, Any] = {"today": today, "limit": limit}
    if category:
        conditions.append("e.category = :category")
        params["category"] = category
    if pattern:
        conditions.append(_SEARCHED)
        params["q"] = pattern
    rows = db.execute(
        text(f"{_ENTRY} WHERE {' AND '.join(conditions)} ORDER BY e.verified_on DESC, e.entry_ref LIMIT :limit"), params
    ).mappings()
    return [Entry(**row) for row in rows]


def managed(db: Session, *, state: str | None, expired_only: bool, today: date, pattern: str | None,
            limit: int = 300) -> list[Entry]:
    conditions, params = ["TRUE"], {"today": today, "limit": limit}
    if state:
        conditions.append("e.state = :state")
        params["state"] = state
    if expired_only:
        conditions.append("e.state = 'published' AND e.expires_on < :today")
    if pattern:
        conditions.append(_SEARCHED)
        params["q"] = pattern
    rows = db.execute(
        text(f"{_ENTRY} WHERE {' AND '.join(conditions)} ORDER BY e.updated_at DESC LIMIT :limit"), params
    ).mappings()
    return [Entry(**row) for row in rows]


def insert(db: Session, values: dict[str, Any], editor: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(FIELDS)
    params = ", ".join(f":{name}" for name in FIELDS)
    return db.scalar(
        text(f"""INSERT INTO content.guide_entry ({columns}, drafted_by, updated_by)
                 VALUES ({params}, :editor, :editor) RETURNING id"""),
        {**{name: values.get(name) for name in FIELDS}, "editor": editor},
    )


def update(db: Session, entry_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE content.guide_entry SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": entry_id},
    )


@dataclass(frozen=True)
class Report:
    id: uuid.UUID
    entry_id: uuid.UUID
    entry_ref: str
    entry_title_en: str | None
    entry_title_ta: str | None
    member_id: uuid.UUID
    reason: str
    note: str | None
    state: str
    resolution_note: str | None
    resolved_at: datetime | None
    created_at: datetime


_REPORT = """
    SELECT r.id, r.entry_id, e.entry_ref, e.title_en AS entry_title_en, e.title_ta AS entry_title_ta, r.member_id,
           r.reason, r.note, r.state, r.resolution_note, r.resolved_at, r.created_at
    FROM content.guide_report r JOIN content.guide_entry e ON e.id = r.entry_id
"""


def insert_report(db: Session, entry_id: uuid.UUID, member_id: uuid.UUID, reason: str, note: str | None) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO content.guide_report (entry_id, member_id, reason, note)
                VALUES (:entry, :member, :reason, :note) RETURNING id"""),
        {"entry": entry_id, "member": member_id, "reason": reason, "note": note},
    )


def find_report(db: Session, report_id: uuid.UUID, *, lock: bool = False) -> Report | None:
    row = db.execute(
        text(f"{_REPORT} WHERE r.id = :id{' FOR UPDATE OF r' if lock else ''}"), {"id": report_id}
    ).mappings().one_or_none()
    return Report(**row) if row else None


def open_report_of(db: Session, entry_id: uuid.UUID, member_id: uuid.UUID) -> Report | None:
    row = db.execute(
        text(f"{_REPORT} WHERE r.entry_id = :entry AND r.member_id = :member AND r.state = 'open'"),
        {"entry": entry_id, "member": member_id},
    ).mappings().one_or_none()
    return Report(**row) if row else None


def reports(db: Session, *, state: str | None, entry_id: uuid.UUID | None, limit: int = 300) -> list[Report]:
    conditions, params = ["TRUE"], {"limit": limit}
    if state:
        conditions.append("r.state = :state")
        params["state"] = state
    if entry_id:
        conditions.append("r.entry_id = :entry")
        params["entry"] = entry_id
    rows = db.execute(
        text(f"{_REPORT} WHERE {' AND '.join(conditions)} ORDER BY r.created_at LIMIT :limit"), params
    ).mappings()
    return [Report(**row) for row in rows]


def resolve_report(db: Session, report_id: uuid.UUID, outcome: str, note: str | None, staff_id: uuid.UUID) -> None:
    db.execute(
        text("""UPDATE content.guide_report SET state = :outcome, resolution_note = :note, resolved_by = :staff,
                       resolved_at = clock_timestamp() WHERE id = :id"""),
        {"id": report_id, "outcome": outcome, "note": note, "staff": staff_id},
    )


def permission_holders(db: Session, permission: str) -> list[uuid.UUID]:
    """Everyone who holds the permission now, in any area: the guide is one list for the whole platform."""
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                """
            ),
            {"permission": permission},
        )
    )
