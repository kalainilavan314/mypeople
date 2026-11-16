"""SQL for promises, milestones, updates with their decisions, and feedback."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Promise:
    id: uuid.UUID
    promise_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    source_reference: str
    source_published_on: date
    office_en: str
    office_ta: str
    kind: str
    theme: str
    area_key: str
    area_path: list[str]
    planned_start: date
    due_date: date
    target_en: str
    target_ta: str
    blockers_en: str | None
    blockers_ta: str | None
    status: str
    status_reason: str | None
    status_reason_ta: str | None
    publication: str
    drafted_by: uuid.UUID
    publication_requested_by: uuid.UUID | None
    published_at: datetime | None
    last_verified_at: datetime | None
    update_due_at: datetime | None
    created_at: datetime
    updated_at: datetime


_PROMISE = """
    SELECT id, promise_ref, title_en, title_ta, description_en, description_ta, source_reference, source_published_on,
           office_en, office_ta, kind, theme, area_key, area_path, planned_start, due_date, target_en, target_ta,
           blockers_en, blockers_ta, status, status_reason, status_reason_ta, publication, drafted_by, publication_requested_by,
           published_at, last_verified_at, update_due_at, created_at, updated_at
    FROM community.promise
"""
FIELDS = (
    "title_en", "title_ta", "description_en", "description_ta", "source_reference", "source_published_on",
    "office_en", "office_ta", "kind", "theme", "planned_start", "due_date", "target_en", "target_ta", "blockers_en",
    "blockers_ta",
)


def _promise(row: Any) -> Promise:
    return Promise(**{**row, "area_path": list(row["area_path"])})


def find(db: Session, promise_id: uuid.UUID, *, lock: bool = False) -> Promise | None:
    row = db.execute(text(f"{_PROMISE} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": promise_id}).mappings().one_or_none()
    return _promise(row) if row else None


def search(db: Session, *, published_only: bool, areas: list[str] | None, status: str | None, theme: str | None,
           area_key: str | None, limit: int = 300) -> list[Promise]:
    conditions, params = ["TRUE"], {"limit": limit}
    if published_only:
        conditions.append("publication = 'published'")
    if areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if status:
        conditions.append("status = :status")
        params["status"] = status
    if theme:
        conditions.append("theme = :theme")
        params["theme"] = theme
    if area_key:
        conditions.append(":area_key = ANY(area_path)")
        params["area_key"] = area_key
    rows = db.execute(
        text(f"{_PROMISE} WHERE {' AND '.join(conditions)} ORDER BY due_date, promise_ref LIMIT :limit"), params
    ).mappings()
    return [_promise(row) for row in rows]


def insert(db: Session, values: dict[str, Any], area_key: str, area_path: list[str], drafted_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(FIELDS)
    params = ", ".join(f":{name}" for name in FIELDS)
    return db.scalar(
        text(
            f"""INSERT INTO community.promise ({columns}, area_key, area_path, drafted_by)
                VALUES ({params}, :area_key, :area_path, :drafted_by) RETURNING id"""
        ),
        {**{name: values.get(name) for name in FIELDS}, "area_key": area_key, "area_path": area_path, "drafted_by": drafted_by},
    )


def update(db: Session, promise_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE community.promise SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": promise_id},
    )


@dataclass(frozen=True)
class Milestone:
    position: int
    title_en: str
    title_ta: str
    due_date: date | None


def milestones(db: Session, promise_id: uuid.UUID) -> list[Milestone]:
    rows = db.execute(
        text("""SELECT position, title_en, title_ta, due_date FROM community.promise_milestone
                WHERE promise_id = :id ORDER BY position"""),
        {"id": promise_id},
    ).mappings()
    return [Milestone(**row) for row in rows]


def replace_milestones(db: Session, promise_id: uuid.UUID, items: list[dict[str, Any]]) -> None:
    db.execute(text("DELETE FROM community.promise_milestone WHERE promise_id = :id"), {"id": promise_id})
    for position, item in enumerate(items, start=1):
        db.execute(
            text("""INSERT INTO community.promise_milestone (promise_id, position, title_en, title_ta, due_date)
                    VALUES (:p, :position, :title_en, :title_ta, :due_date)"""),
            {"p": promise_id, "position": position, "title_en": item["title_en"], "title_ta": item["title_ta"],
             "due_date": item.get("due_date")},
        )


@dataclass(frozen=True)
class Update:
    id: uuid.UUID
    promise_id: uuid.UUID
    new_status: str | None
    note_en: str
    note_ta: str
    evidence_refs: list[str]
    corrects_id: uuid.UUID | None
    drafted_by: uuid.UUID | None
    created_at: datetime
    decision: str  # pending, approved, rejected, or system
    decision_reason: str | None
    decided_at: datetime | None


_UPDATE = """
    SELECT u.id, u.promise_id, u.new_status, u.note_en, u.note_ta, u.evidence_refs, u.corrects_id, u.drafted_by,
           u.created_at,
           CASE WHEN u.drafted_by IS NULL THEN 'system' WHEN d.update_id IS NULL THEN 'pending'
                WHEN d.approved THEN 'approved' ELSE 'rejected' END AS decision,
           d.reason AS decision_reason, d.decided_at
    FROM community.promise_update u LEFT JOIN community.promise_update_decision d ON d.update_id = u.id
"""


def _update(row: Any) -> Update:
    return Update(**{**row, "evidence_refs": list(row["evidence_refs"])})


def updates(db: Session, promise_id: uuid.UUID) -> list[Update]:
    rows = db.execute(text(f"{_UPDATE} WHERE u.promise_id = :id ORDER BY u.created_at"), {"id": promise_id}).mappings()
    return [_update(row) for row in rows]


def find_update(db: Session, update_id: uuid.UUID) -> Update | None:
    row = db.execute(text(f"{_UPDATE} WHERE u.id = :id"), {"id": update_id}).mappings().one_or_none()
    return _update(row) if row else None


def insert_update(db: Session, promise_id: uuid.UUID, *, new_status: str | None, note_en: str, note_ta: str,
                  evidence_refs: list[str], corrects_id: uuid.UUID | None, drafted_by: uuid.UUID | None) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO community.promise_update (promise_id, new_status, note_en, note_ta, evidence_refs, corrects_id,
                                                     drafted_by)
               VALUES (:p, :s, :en, :ta, :refs, :corrects, :by) RETURNING id"""
        ),
        {"p": promise_id, "s": new_status, "en": note_en, "ta": note_ta, "refs": evidence_refs, "corrects": corrects_id,
         "by": drafted_by},
    )


def decide_update(db: Session, update_id: uuid.UUID, approved: bool, decided_by: uuid.UUID, reason: str | None) -> None:
    db.execute(
        text("""INSERT INTO community.promise_update_decision (update_id, approved, decided_by, reason)
                VALUES (:u, :a, :by, :reason)"""),
        {"u": update_id, "a": approved, "by": decided_by, "reason": reason},
    )


def pending_updates(db: Session, areas: list[str] | None) -> list[Update]:
    condition = "u.drafted_by IS NOT NULL AND d.update_id IS NULL"
    params: dict[str, Any] = {}
    if areas is not None:
        condition += " AND u.promise_id IN (SELECT id FROM community.promise WHERE area_path && CAST(:areas AS text[]))"
        params["areas"] = areas or ["none"]
    rows = db.execute(text(f"{_UPDATE} WHERE {condition} ORDER BY u.created_at"), params).mappings()
    return [_update(row) for row in rows]


@dataclass(frozen=True)
class Feedback:
    id: uuid.UUID
    promise_id: uuid.UUID
    member_id: uuid.UUID
    body: str
    state: str
    moderation_reason: str | None
    reply_en: str | None
    reply_ta: str | None
    replied_at: datetime | None
    created_at: datetime


_FEEDBACK = """SELECT id, promise_id, member_id, body, state, moderation_reason, reply_en, reply_ta, replied_at, created_at
               FROM community.promise_feedback"""


def feedback(db: Session, promise_id: uuid.UUID, *, published_only: bool) -> list[Feedback]:
    condition = " AND state = 'published'" if published_only else ""
    rows = db.execute(text(f"{_FEEDBACK} WHERE promise_id = :id{condition} ORDER BY created_at"), {"id": promise_id}).mappings()
    return [Feedback(**row) for row in rows]


def find_feedback(db: Session, feedback_id: uuid.UUID) -> Feedback | None:
    row = db.execute(text(f"{_FEEDBACK} WHERE id = :id"), {"id": feedback_id}).mappings().one_or_none()
    return Feedback(**row) if row else None


def insert_feedback(db: Session, promise_id: uuid.UUID, member_id: uuid.UUID, body: str) -> uuid.UUID:
    return db.scalar(
        text("INSERT INTO community.promise_feedback (promise_id, member_id, body) VALUES (:p, :m, :b) RETURNING id"),
        {"p": promise_id, "m": member_id, "b": body},
    )


def set_feedback(db: Session, feedback_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE community.promise_feedback SET {assignments} WHERE id = :id"), {**values, "id": feedback_id})


def pending_feedback(db: Session, areas: list[str] | None) -> list[Feedback]:
    condition, params = "state = 'pending'", {}
    if areas is not None:
        condition += " AND promise_id IN (SELECT id FROM community.promise WHERE area_path && CAST(:areas AS text[]))"
        params["areas"] = areas or ["none"]
    rows = db.execute(text(f"{_FEEDBACK} WHERE {condition} ORDER BY created_at"), params).mappings()
    return [Feedback(**row) for row in rows]


def overdue(db: Session, today: date) -> list[Promise]:
    rows = db.execute(
        text(f"""{_PROMISE} WHERE publication = 'published' AND due_date < :today
                 AND status NOT IN ('completed', 'withdrawn', 'delayed') FOR UPDATE SKIP LOCKED"""),
        {"today": today},
    ).mappings()
    return [_promise(row) for row in rows]


def missed_updates(db: Session, now: datetime) -> list[Promise]:
    """Published promises whose 10 working days for an update have passed and nobody was told yet."""
    rows = db.execute(
        text(f"""{_PROMISE} WHERE publication = 'published' AND update_due_at < :now
                 AND update_missed_alerted_at IS NULL FOR UPDATE SKIP LOCKED"""),
        {"now": now},
    ).mappings()
    return [_promise(row) for row in rows]


def awaiting_publication(db: Session, areas: list[str] | None) -> list[Promise]:
    condition, params = "publication = 'awaiting_approval'", {}
    if areas is not None:
        condition += " AND area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(text(f"{_PROMISE} WHERE {condition} ORDER BY updated_at"), params).mappings()
    return [_promise(row) for row in rows]


def status_counts(db: Session, area_keys: list[str]) -> dict[str, int]:
    """Published promises made for one of these areas (a member's GN up to the whole platform), by status."""
    rows = db.execute(
        text("""SELECT status, count(*) AS n FROM community.promise
                WHERE publication = 'published' AND area_key = ANY(:keys) GROUP BY status"""),
        {"keys": area_keys},
    )
    return {row.status: row.n for row in rows}


def report(db: Session, areas: list[str] | None) -> list[tuple[str, str, str, str, int]]:
    """(status, theme, office, area key, count) for published promises, FR-PRM-010."""
    condition, params = "publication = 'published'", {}
    if areas is not None:
        condition += " AND area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"""SELECT status, theme, office_en, area_key, count(*) AS n FROM community.promise
                 WHERE {condition} GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4"""),
        params,
    )
    return [(row.status, row.theme, row.office_en, row.area_key, row.n) for row in rows]


def holders(db: Session, permission: str, area_path: list[str]) -> list[uuid.UUID]:
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                  AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))
                """
            ),
            {"permission": permission, "path": area_path},
        )
    )
