"""SQL for quarterly access reviews (FR-AUTH-027, KPI-42)."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.access.repository import StoredAssignment, to_assignment
from app.modules.access.rules import Area


@dataclass(frozen=True)
class DueAssignment:
    assignment: StoredAssignment
    member_code: str
    full_name: str
    last_reviewed_at: datetime | None


def due_assignments(db: Session, due_by: datetime, limit: int) -> list[DueAssignment]:
    """Active grants due for review by this moment, the most overdue first; the caller keeps
    the ones the reviewer may review."""
    rows = db.execute(
        text(
            """
            SELECT a.id, a.member_id, a.tier, a.area_level, a.area_code, a.permissions, a.state, a.granted_by,
                   a.granted_at, a.review_due_at, a.ended_at, a.ended_by, a.end_reason, m.member_code, m.full_name,
                   (SELECT max(r.reviewed_at) FROM access.assignment_review r WHERE r.assignment_id = a.id)
                       AS last_reviewed_at
            FROM access.staff_assignment a JOIN npm.member m ON m.id = a.member_id
            WHERE a.state = 'active' AND a.review_due_at IS NOT NULL AND a.review_due_at <= :due_by
            ORDER BY a.review_due_at, a.granted_at
            LIMIT :limit
            """
        ),
        {"due_by": due_by, "limit": limit},
    )
    return [DueAssignment(to_assignment(row), row.member_code, row.full_name, row.last_reviewed_at) for row in rows]


def reviewed_areas(db: Session, quarter: str) -> list[Area]:
    """The area of each grant reviewed in the quarter, one entry per review, for KPI-42."""
    rows = db.execute(
        text(
            """
            SELECT a.area_level, a.area_code
            FROM access.assignment_review r JOIN access.staff_assignment a ON a.id = r.assignment_id
            WHERE r.quarter = :quarter
            """
        ),
        {"quarter": quarter},
    )
    return [Area(row.area_level, row.area_code) for row in rows]


def set_review_due(db: Session, assignment_id: uuid.UUID, review_due_at: datetime | None) -> None:
    db.execute(
        text("UPDATE access.staff_assignment SET review_due_at = :due WHERE id = :id"),
        {"id": assignment_id, "due": review_due_at},
    )


def insert_review(
    db: Session, *, assignment_id: uuid.UUID, quarter: str, decision: str, reason: str, reviewed_by: uuid.UUID
) -> None:
    db.execute(
        text(
            """
            INSERT INTO access.assignment_review (assignment_id, quarter, decision, reason, reviewed_by)
            VALUES (:assignment, :quarter, :decision, :reason, :reviewed_by)
            """
        ),
        {
            "assignment": assignment_id,
            "quarter": quarter,
            "decision": decision,
            "reason": reason,
            "reviewed_by": reviewed_by,
        },
    )
