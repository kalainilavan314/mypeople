"""SQL for identity.review_appeal (Alembic revision 0005)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredAppeal:
    id: uuid.UUID
    appeal_ref: str
    decision_id: uuid.UUID
    appealed_decision: str
    original_reviewer_id: uuid.UUID
    review_id: uuid.UUID
    review_ref: str
    member_id: uuid.UUID
    area_path: list[str]
    statement: str
    state: str
    submitted_at: datetime
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None
    claimed_at: datetime | None
    decided_by: uuid.UUID | None
    decider_tier: str | None
    decided_at: datetime | None
    outcome_reason: str | None


_SELECT = """
    SELECT a.id, a.appeal_ref, a.decision_id, d.decision AS appealed_decision, d.reviewer_id AS original_reviewer_id,
           a.review_id, r.review_ref, a.member_id, a.area_path, a.statement, a.state, a.submitted_at,
           a.claimed_by, c.full_name AS claimed_by_name, a.claimed_at, a.decided_by, a.decider_tier, a.decided_at,
           a.outcome_reason
    FROM identity.review_appeal a
    JOIN identity.review_decision d ON d.id = a.decision_id
    JOIN identity.identity_review r ON r.id = a.review_id
    JOIN npm.member m ON m.id = a.member_id AND m.deleted_at IS NULL
    LEFT JOIN npm.member c ON c.id = a.claimed_by
"""


def find_appeal(db: Session, appeal_id: uuid.UUID, *, for_update: bool = False) -> StoredAppeal | None:
    if for_update:
        # Locks the appeal, so two deciders claiming or deciding at once are applied one after the other.
        db.execute(text("SELECT 1 FROM identity.review_appeal WHERE id = :id FOR UPDATE"), {"id": appeal_id})
    row = db.execute(text(f"{_SELECT} WHERE a.id = :id"), {"id": appeal_id}).mappings().one_or_none()
    return StoredAppeal(**row) if row else None


def find_by_decision(db: Session, decision_id: uuid.UUID) -> StoredAppeal | None:
    row = db.execute(text(f"{_SELECT} WHERE a.decision_id = :id"), {"id": decision_id}).mappings().one_or_none()
    return StoredAppeal(**row) if row else None


def appeals_for_review(db: Session, review_id: uuid.UUID) -> list[StoredAppeal]:
    rows = db.execute(text(f"{_SELECT} WHERE a.review_id = :id ORDER BY a.submitted_at"), {"id": review_id}).mappings()
    return [StoredAppeal(**row) for row in rows]


def insert_appeal(
    db: Session, *, decision_id: uuid.UUID, review_id: uuid.UUID, member_id: uuid.UUID, area_path: list[str], statement: str
) -> StoredAppeal:
    appeal_id = db.scalar(
        text(
            """
            INSERT INTO identity.review_appeal (decision_id, review_id, member_id, area_path, statement)
            VALUES (:decision_id, :review_id, :member_id, :area_path, :statement)
            RETURNING id
            """
        ),
        {
            "decision_id": decision_id,
            "review_id": review_id,
            "member_id": member_id,
            "area_path": area_path,
            "statement": statement,
        },
    )
    appeal = find_appeal(db, appeal_id)
    assert appeal is not None
    return appeal


def claim(db: Session, appeal_id: uuid.UUID, decider_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.review_appeal SET state = 'in_review', claimed_by = :decider_id, claimed_at = now()
            WHERE id = :id AND state IN ('submitted', 'in_review')
            """
        ),
        {"id": appeal_id, "decider_id": decider_id},
    )


def release(db: Session, appeal_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.review_appeal SET state = 'submitted', claimed_by = NULL, claimed_at = NULL
            WHERE id = :id AND state = 'in_review'
            """
        ),
        {"id": appeal_id},
    )


def decide(
    db: Session, appeal_id: uuid.UUID, *, state: str, decided_by: uuid.UUID, decider_tier: str, reason: str
) -> None:
    db.execute(
        text(
            """
            UPDATE identity.review_appeal
            SET state = :state, decided_by = :decided_by, decider_tier = :decider_tier, decided_at = now(),
                outcome_reason = :reason
            WHERE id = :id AND state = 'in_review'
            """
        ),
        {"id": appeal_id, "state": state, "decided_by": decided_by, "decider_tier": decider_tier, "reason": reason},
    )


def queue(
    db: Session, *, visible_areas: list[str] | None, states: list[str], claimed_by: uuid.UUID | None, limit: int, offset: int = 0
) -> list[StoredAppeal]:
    """Oldest first (D05). visible_areas=None means every area."""
    conditions = ["a.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit, "offset": offset}
    if visible_areas is not None:
        conditions.append("a.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    if claimed_by is not None:
        conditions.append("a.claimed_by = :claimed_by")
        params["claimed_by"] = claimed_by
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY a.submitted_at, a.appeal_ref LIMIT :limit OFFSET :offset"),
        params,
    ).mappings()
    return [StoredAppeal(**row) for row in rows]


def has_pending_appeal(db: Session, review_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            text(
                "SELECT EXISTS (SELECT 1 FROM identity.review_appeal "
                "WHERE review_id = :id AND state IN ('submitted', 'in_review'))"
            ),
            {"id": review_id},
        )
    )


def overturned_reviewers(db: Session, review_id: uuid.UUID) -> set[uuid.UUID]:
    """Reviewers whose decisions on this review were overturned on appeal."""
    rows = db.execute(
        text(
            """
            SELECT d.reviewer_id FROM identity.review_appeal a
            JOIN identity.review_decision d ON d.id = a.decision_id
            WHERE a.review_id = :id AND a.state = 'overturned'
            """
        ),
        {"id": review_id},
    )
    return {row.reviewer_id for row in rows}


def has_open_appeal_claimed_by(db: Session, member_id: uuid.UUID, decider_id: uuid.UUID) -> bool:
    """PRM-03 for appeals: the evidence opens to the person deciding the member's appeal (D05)."""
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM identity.review_appeal
                               WHERE member_id = :member_id AND state = 'in_review' AND claimed_by = :decider_id)
                """
            ),
            {"member_id": member_id, "decider_id": decider_id},
        )
    )
