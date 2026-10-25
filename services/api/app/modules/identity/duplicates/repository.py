"""SQL for identity.duplicate_case (Alembic revision 0007)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredCase:
    id: uuid.UUID
    case_ref: str
    member_a: uuid.UUID
    member_b: uuid.UUID
    signal: str
    opened_by: uuid.UUID | None
    opened_reason: str | None
    area_path: list[str]
    state: str
    opened_at: datetime
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None
    claimed_at: datetime | None
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    outcome_reason: str | None

    def members(self) -> tuple[uuid.UUID, uuid.UUID]:
        return (self.member_a, self.member_b)


_SELECT = """
    SELECT c.id, c.case_ref, c.member_a, c.member_b, c.signal, c.opened_by, c.opened_reason, c.area_path, c.state,
           c.opened_at, c.claimed_by, cl.full_name AS claimed_by_name, c.claimed_at, c.decided_by, c.decided_at,
           c.outcome_reason
    FROM identity.duplicate_case c
    LEFT JOIN npm.member cl ON cl.id = c.claimed_by
"""


def find_case(db: Session, case_id: uuid.UUID, *, for_update: bool = False) -> StoredCase | None:
    if for_update:
        db.execute(text("SELECT 1 FROM identity.duplicate_case WHERE id = :id FOR UPDATE"), {"id": case_id})
    row = db.execute(text(f"{_SELECT} WHERE c.id = :id"), {"id": case_id}).mappings().one_or_none()
    return StoredCase(**row) if row else None


def find_pair(db: Session, member_a: uuid.UUID, member_b: uuid.UUID) -> StoredCase | None:
    row = db.execute(
        text(f"{_SELECT} WHERE c.member_a = :a AND c.member_b = :b"), {"a": member_a, "b": member_b}
    ).mappings().one_or_none()
    return StoredCase(**row) if row else None


def insert_case(
    db: Session,
    *,
    member_a: uuid.UUID,
    member_b: uuid.UUID,
    signal: str,
    opened_by: uuid.UUID | None,
    opened_reason: str | None,
    area_path: list[str],
) -> StoredCase:
    case_id = db.scalar(
        text(
            """
            INSERT INTO identity.duplicate_case (member_a, member_b, signal, opened_by, opened_reason, area_path)
            VALUES (:a, :b, :signal, :opened_by, :opened_reason, :area_path)
            RETURNING id
            """
        ),
        {
            "a": member_a,
            "b": member_b,
            "signal": signal,
            "opened_by": opened_by,
            "opened_reason": opened_reason,
            "area_path": area_path,
        },
    )
    case = find_case(db, case_id)
    assert case is not None
    return case


def same_name_and_birth_date(db: Session, member_id: uuid.UUID) -> list[uuid.UUID]:
    """Other active accounts with the same name (ignoring case and spacing) and date of birth."""
    rows = db.execute(
        text(
            """
            SELECT other.id FROM npm.member me
            JOIN npm.member other
              ON lower(regexp_replace(trim(other.full_name), '\\s+', ' ', 'g'))
                 = lower(regexp_replace(trim(me.full_name), '\\s+', ' ', 'g'))
             AND other.dob = me.dob
             AND other.deleted_at IS NULL AND other.dob IS NOT NULL
             AND other.id <> me.id
            WHERE me.id = :id AND me.dob IS NOT NULL
            ORDER BY other.id
            """
        ),
        {"id": member_id},
    )
    return [row.id for row in rows]


def claim(db: Session, case_id: uuid.UUID, investigator_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.duplicate_case SET state = 'in_review', claimed_by = :who, claimed_at = now()
            WHERE id = :id AND state IN ('open', 'in_review')
            """
        ),
        {"id": case_id, "who": investigator_id},
    )


def release(db: Session, case_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.duplicate_case SET state = 'open', claimed_by = NULL, claimed_at = NULL
            WHERE id = :id AND state = 'in_review'
            """
        ),
        {"id": case_id},
    )


def decide(db: Session, case_id: uuid.UUID, *, outcome: str, decided_by: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """
            UPDATE identity.duplicate_case
            SET state = :outcome, decided_by = :decided_by, decided_at = clock_timestamp(), outcome_reason = :reason
            WHERE id = :id AND state = 'in_review'
            """
        ),
        {"id": case_id, "outcome": outcome, "decided_by": decided_by, "reason": reason},
    )


def queue(
    db: Session, *, visible_areas: list[str] | None, states: list[str], claimed_by: uuid.UUID | None, limit: int
) -> list[StoredCase]:
    conditions = ["c.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit}
    if visible_areas is not None:
        conditions.append("c.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    if claimed_by is not None:
        conditions.append("c.claimed_by = :claimed_by")
        params["claimed_by"] = claimed_by
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY c.opened_at, c.case_ref LIMIT :limit"), params
    ).mappings()
    return [StoredCase(**row) for row in rows]


def cases_for_member(db: Session, member_id: uuid.UUID) -> list[StoredCase]:
    """Every case involving the member, newest first: the flags a reviewer sees (FR-WEB-012)."""
    rows = db.execute(
        text(f"{_SELECT} WHERE :id IN (c.member_a, c.member_b) ORDER BY c.opened_at DESC"), {"id": member_id}
    ).mappings()
    return [StoredCase(**row) for row in rows]


def has_open_case_claimed_by(db: Session, member_id: uuid.UUID, investigator_id: uuid.UUID) -> bool:
    """PRM-03 for investigations: both accounts' evidence opens to the investigator holding the case (D04)."""
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM identity.duplicate_case
                               WHERE :member_id IN (member_a, member_b) AND state = 'in_review'
                                 AND claimed_by = :investigator_id)
                """
            ),
            {"member_id": member_id, "investigator_id": investigator_id},
        )
    )
