"""SQL for the assistant's knowledge base: source versions, their passages, and the search (D20, ENT-62)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Source:
    id: uuid.UUID
    family_id: uuid.UUID
    version: int
    kind: str
    title_ta: str
    title_en: str
    body_ta: str | None
    body_en: str | None
    publisher: str
    source_url: str | None
    published_on: date | None
    change_note: str | None
    state: str
    review_due: date
    return_reason: str | None
    drafted_by: uuid.UUID
    drafted_by_name: str | None
    approved_by: uuid.UUID | None
    approved_by_name: str | None
    approved_at: datetime | None
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    superseded_at: datetime | None
    retired_at: datetime | None
    retire_reason: str | None
    created_at: datetime
    updated_at: datetime
    passages: int


_SOURCE = """
    SELECT s.id, s.family_id, s.version, s.kind, s.title_ta, s.title_en, s.body_ta, s.body_en, s.publisher, s.source_url,
           s.published_on, s.change_note, s.state, s.review_due, s.return_reason, s.drafted_by,
           d.full_name AS drafted_by_name, s.approved_by, a.full_name AS approved_by_name, s.approved_at,
           r.full_name AS reviewed_by_name, s.reviewed_at, s.superseded_at, s.retired_at, s.retire_reason, s.created_at,
           s.updated_at, (SELECT count(*) FROM ai.kb_chunk c WHERE c.source_id = s.id)::int AS passages
    FROM ai.kb_source s
    LEFT JOIN npm.member d ON d.id = s.drafted_by
    LEFT JOIN npm.member a ON a.id = s.approved_by
    LEFT JOIN npm.member r ON r.id = s.reviewed_by
"""
FIELDS = (
    "kind", "title_ta", "title_en", "body_ta", "body_en", "publisher", "source_url", "published_on", "change_note",
    "review_due",
)


def find(db: Session, source_id: uuid.UUID, *, lock: bool = False) -> Source | None:
    if lock:
        db.execute(text("SELECT 1 FROM ai.kb_source WHERE id = :id FOR UPDATE"), {"id": source_id})
    row = db.execute(text(f"{_SOURCE} WHERE s.id = :id"), {"id": source_id}).mappings().one_or_none()
    return Source(**row) if row else None


def family(db: Session, family_id: uuid.UUID) -> list[Source]:
    rows = db.execute(text(f"{_SOURCE} WHERE s.family_id = :id ORDER BY s.version DESC"), {"id": family_id})
    return [Source(**row) for row in rows.mappings()]


def search_sources(db: Session, *, states: list[str], kind: str | None, limit: int = 500) -> list[Source]:
    conditions, params = ["s.state = ANY(:states)"], {"states": states, "limit": limit}
    if kind:
        conditions.append("s.kind = :kind")
        params["kind"] = kind
    rows = db.execute(
        text(f"{_SOURCE} WHERE {' AND '.join(conditions)} ORDER BY s.updated_at DESC LIMIT :limit"), params
    )
    return [Source(**row) for row in rows.mappings()]


def insert(db: Session, values: dict[str, Any], *, family_id: uuid.UUID | None, version: int, drafted_by: uuid.UUID) -> uuid.UUID:
    source_id = uuid.uuid4()
    columns = ", ".join(FIELDS)
    params = ", ".join(f":{name}" for name in FIELDS)
    db.execute(
        text(
            f"""INSERT INTO ai.kb_source (id, family_id, version, {columns}, drafted_by)
                VALUES (:id, :family_id, :version, {params}, :drafted_by)"""
        ),
        {**{name: values.get(name) for name in FIELDS}, "id": source_id, "family_id": family_id or source_id,
         "version": version, "drafted_by": drafted_by},
    )
    return source_id


def update(db: Session, source_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE ai.kb_source SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": source_id},
    )


def next_version(db: Session, family_id: uuid.UUID) -> int:
    return int(db.scalar(text("SELECT COALESCE(max(version), 0) + 1 FROM ai.kb_source WHERE family_id = :id"), {"id": family_id}))


def has_draft(db: Session, family_id: uuid.UUID) -> bool:
    return bool(db.scalar(text("SELECT 1 FROM ai.kb_source WHERE family_id = :id AND state = 'draft'"), {"id": family_id}))


def supersede_approved(db: Session, family_id: uuid.UUID) -> uuid.UUID | None:
    """The approved version before a new one is approved: superseded, and its passages no longer searched."""
    previous = db.scalar(
        text(
            """UPDATE ai.kb_source SET state = 'superseded', superseded_at = clock_timestamp(), updated_at = clock_timestamp()
               WHERE family_id = :id AND state = 'approved' RETURNING id"""
        ),
        {"id": family_id},
    )
    if previous is not None:
        delete_passages(db, previous)
    return previous


def replace_passages(db: Session, source_id: uuid.UUID, rows: list[dict[str, Any]]) -> None:
    delete_passages(db, source_id)
    for row in rows:
        db.execute(
            text(
                """INSERT INTO ai.kb_chunk (source_id, language, position, body, terms, title_terms)
                   VALUES (:source_id, :language, :position, :body, :terms, :title_terms)"""
            ),
            {"source_id": source_id, **row},
        )


def delete_passages(db: Session, source_id: uuid.UUID) -> None:
    db.execute(text("DELETE FROM ai.kb_chunk WHERE source_id = :id"), {"id": source_id})


@dataclass(frozen=True)
class Hit:
    chunk_id: uuid.UUID
    source_id: uuid.UUID
    family_id: uuid.UUID
    version: int
    kind: str
    language: str
    title_ta: str
    title_en: str
    publisher: str
    source_url: str | None
    body: str
    score: int


def search(db: Session, query_terms: list[str], *, excluded_kinds: list[str], today: date, limit: int) -> list[Hit]:
    """Passages of approved sources not past their review date, by how many of the terms they share
    (a term in the title counts twice)."""
    if not query_terms:
        return []
    rows = db.execute(
        text(
            """
            SELECT c.id AS chunk_id, c.source_id, s.family_id, s.version, s.kind, c.language, s.title_ta, s.title_en,
                   s.publisher, s.source_url, c.body,
                   ((SELECT count(*) FROM unnest(c.terms) t WHERE t = ANY(CAST(:terms AS text[])))
                    + 2 * (SELECT count(*) FROM unnest(c.title_terms) t WHERE t = ANY(CAST(:terms AS text[]))))::int AS score
            FROM ai.kb_chunk c JOIN ai.kb_source s ON s.id = c.source_id
            WHERE s.state = 'approved' AND s.review_due >= :today AND NOT (s.kind = ANY(CAST(:excluded AS text[])))
              AND (c.terms && CAST(:terms AS text[]) OR c.title_terms && CAST(:terms AS text[]))
            ORDER BY score DESC, s.updated_at DESC, c.position
            LIMIT :limit
            """
        ),
        {"terms": query_terms, "excluded": excluded_kinds or ["none"], "today": today, "limit": limit},
    )
    return [Hit(**row) for row in rows.mappings()]


@dataclass(frozen=True)
class SourceCounts:
    drafts: int
    approved: int
    review_overdue: int
    review_due_soon: int


def counts(db: Session, today: date) -> SourceCounts:
    row = db.execute(
        text(
            """
            SELECT count(*) FILTER (WHERE state = 'draft') AS drafts,
                   count(*) FILTER (WHERE state = 'approved') AS approved,
                   count(*) FILTER (WHERE state = 'approved' AND review_due < :today) AS review_overdue,
                   count(*) FILTER (WHERE state = 'approved' AND review_due >= :today AND review_due < :today + 30) AS review_due_soon
            FROM ai.kb_source
            """
        ),
        {"today": today},
    ).mappings().one()
    return SourceCounts(**row)
