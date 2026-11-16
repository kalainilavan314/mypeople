"""SQL for development proposals and their stage history."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Proposal:
    id: uuid.UUID
    proposal_ref: str
    author_id: uuid.UUID
    client_reference: uuid.UUID
    title: str
    category: str
    area_key: str
    area_path: list[str]
    problem: str
    solution: str
    benefit: str
    cost_estimate: Decimal | None
    evidence: str | None
    stage: str
    stage_reason: str | None
    revision: int
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


_SELECT = """
    SELECT id, proposal_ref, author_id, client_reference, title, category, area_key, area_path, problem, solution,
           benefit, cost_estimate, evidence, stage, stage_reason, revision, published_at, created_at, updated_at
    FROM community.proposal
"""


def _proposal(row: Any) -> Proposal:
    return Proposal(**{**row, "area_path": list(row["area_path"])})


def find(db: Session, proposal_id: uuid.UUID, *, lock: bool = False) -> Proposal | None:
    suffix = " FOR UPDATE" if lock else ""
    row = db.execute(text(f"{_SELECT} WHERE id = :id{suffix}"), {"id": proposal_id}).mappings().one_or_none()
    return _proposal(row) if row else None


def find_by_reference(db: Session, author_id: uuid.UUID, client_reference: uuid.UUID) -> Proposal | None:
    row = db.execute(
        text(f"{_SELECT} WHERE author_id = :a AND client_reference = :r"), {"a": author_id, "r": client_reference}
    ).mappings().one_or_none()
    return _proposal(row) if row else None


def insert(db: Session, values: dict[str, Any]) -> uuid.UUID | None:
    return db.scalar(
        text(
            """
            INSERT INTO community.proposal (author_id, client_reference, title, category, area_key, area_path, problem,
                                            solution, benefit, cost_estimate, evidence)
            VALUES (:author_id, :client_reference, :title, :category, :area_key, :area_path, :problem, :solution,
                    :benefit, :cost_estimate, :evidence)
            ON CONFLICT (author_id, client_reference) DO NOTHING
            RETURNING id
            """
        ),
        values,
    )


def count_recent(db: Session, author_id: uuid.UUID) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.proposal WHERE author_id = :a AND created_at > now() - interval '1 day'"),
        {"a": author_id},
    ) or 0


def update(db: Session, proposal_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE community.proposal SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": proposal_id},
    )


def record_event(db: Session, proposal_id: uuid.UUID, from_stage: str | None, to_stage: str, actor_id: uuid.UUID,
                 actor_tier: str | None, reason: str | None) -> None:
    db.execute(
        text(
            """INSERT INTO community.proposal_event (proposal_id, from_stage, to_stage, actor_id, actor_tier, reason)
               VALUES (:p, :f, :t, :a, :tier, :reason)"""
        ),
        {"p": proposal_id, "f": from_stage, "t": to_stage, "a": actor_id, "tier": actor_tier, "reason": reason},
    )


@dataclass(frozen=True)
class StageEvent:
    from_stage: str | None
    to_stage: str
    actor_tier: str | None
    reason: str | None
    occurred_at: datetime


def history(db: Session, proposal_id: uuid.UUID) -> list[StageEvent]:
    rows = db.execute(
        text("""SELECT from_stage, to_stage, actor_tier, reason, occurred_at FROM community.proposal_event
                WHERE proposal_id = :id ORDER BY id"""),
        {"id": proposal_id},
    )
    return [StageEvent(row.from_stage, row.to_stage, row.actor_tier, row.reason, row.occurred_at) for row in rows]


def search(
    db: Session, *, area_keys: list[str] | None, stages: list[str] | None, author_id: uuid.UUID | None,
    query: str | None, category: str | None, limit: int,
) -> list[Proposal]:
    """Word search in the title, problem and solution [plain text until semantic search, AI-09, OD-42]."""
    conditions = ["TRUE"]
    params: dict[str, Any] = {"limit": limit}
    if area_keys is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = area_keys or ["none"]
    if stages:
        conditions.append("stage = ANY(:stages)")
        params["stages"] = stages
    if author_id is not None:
        conditions.append("author_id = :author")
        params["author"] = author_id
    if category:
        conditions.append("category = :category")
        params["category"] = category
    if query:
        conditions.append("(title ILIKE :q OR problem ILIKE :q OR solution ILIKE :q OR proposal_ref ILIKE :q)")
        params["q"] = f"%{query}%"
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY updated_at DESC LIMIT :limit"), params
    ).mappings()
    return [_proposal(row) for row in rows]


def needs_counts(db: Session, area_keys: list[str] | None, stages: tuple[str, ...]) -> list[tuple[str, str | None, str, int]]:
    """(district, DS division or None, category, count) for published proposals in the areas."""
    params: dict[str, Any] = {"stages": list(stages)}
    condition = ""
    if area_keys is not None:
        condition = "AND p.area_path && CAST(:areas AS text[])"
        params["areas"] = area_keys or ["none"]
    rows = db.execute(
        text(
            f"""
            SELECT substring(d.key FROM 10) AS district, substring(s.key FROM 4) AS ds, p.category, count(*) AS n
            FROM community.proposal p
            CROSS JOIN LATERAL (SELECT k AS key FROM unnest(p.area_path) k WHERE k LIKE 'district:%' LIMIT 1) d
            LEFT JOIN LATERAL (SELECT k AS key FROM unnest(p.area_path) k WHERE k LIKE 'ds:%' LIMIT 1) s ON TRUE
            WHERE p.stage = ANY(:stages) {condition}
            GROUP BY 1, 2, 3
            """
        ),
        params,
    )
    return [(row.district, row.ds, row.category, row.n) for row in rows]
