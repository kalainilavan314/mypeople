"""SQL for the member's own profile: display name, gender, survey answers and activity.

profile.display_name is Alembic revision 0016; npm.member and npm.onboarding_answer
belong to the Express migrations and are queried with SQL.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


def display_name(db: Session, member_id: uuid.UUID) -> str | None:
    return db.scalar(text("SELECT display_name FROM profile.display_name WHERE member_id = :id"), {"id": member_id})


def set_display_name(db: Session, member_id: uuid.UUID, name: str | None) -> None:
    """None goes back to greeting the member by their legal name."""
    if name is None:
        db.execute(text("DELETE FROM profile.display_name WHERE member_id = :id"), {"id": member_id})
        return
    db.execute(
        text(
            """
            INSERT INTO profile.display_name (member_id, display_name) VALUES (:id, :name)
            ON CONFLICT (member_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = clock_timestamp()
            """
        ),
        {"id": member_id, "name": name},
    )


def set_gender(db: Session, member_id: uuid.UUID, gender: str | None) -> None:
    db.execute(text("UPDATE npm.member SET gender = :gender WHERE id = :id"), {"id": member_id, "gender": gender})


def set_language(db: Session, member_id: uuid.UUID, language: str) -> None:
    db.execute(text("UPDATE npm.member SET language = :language WHERE id = :id"), {"id": member_id, "language": language})


def survey_answers(db: Session, member_id: uuid.UUID) -> dict[str, str]:
    rows = db.execute(
        text("SELECT question_id, answer FROM npm.onboarding_answer WHERE member_id = :id ORDER BY question_id"),
        {"id": member_id},
    )
    return {row.question_id: row.answer for row in rows}


def replace_survey_answers(db: Session, member_id: uuid.UUID, answers: dict[str, str]) -> None:
    db.execute(text("DELETE FROM npm.onboarding_answer WHERE member_id = :id"), {"id": member_id})
    for question_id, answer in answers.items():
        db.execute(
            text("INSERT INTO npm.onboarding_answer (member_id, question_id, answer) VALUES (:id, :question, :answer)"),
            {"id": member_id, "question": question_id, "answer": answer},
        )


@dataclass(frozen=True)
class ActivityItem:
    kind: str
    reference: str  # the receipt's reference, or the event's
    title: str | None
    state: str
    at: datetime
    target_id: uuid.UUID  # what the item opens


# Each part reads only the member's own records; together they are P04's list (FR-PROF-010).
_ACTIVITY = {
    "identity_review": """
        SELECT 'identity_review' AS kind, r.review_ref AS reference, NULL AS title, r.state,
               COALESCE(r.decided_at, r.resubmitted_at, r.submitted_at) AS at, r.id AS target_id
        FROM identity.identity_review r WHERE r.member_id = :member""",
    "appeal": """
        SELECT 'appeal' AS kind, a.appeal_ref AS reference, NULL AS title, a.state, a.submitted_at AS at, a.id AS target_id
        FROM identity.review_appeal a WHERE a.member_id = :member""",
    "event": """
        SELECT 'event' AS kind, e.event_ref AS reference, e.title_en AS title,
               CASE WHEN at.scanned_at IS NOT NULL THEN 'attended' ELSE r.response END AS state,
               COALESCE(at.scanned_at, r.updated_at) AS at, e.id AS target_id
        FROM events.rsvp r JOIN events.event e ON e.id = r.event_id
        LEFT JOIN events.attendance at ON at.event_id = r.event_id AND at.member_id = r.member_id
        WHERE r.member_id = :member""",
    "removal_request": """
        SELECT 'removal_request' AS kind, q.request_ref AS reference, NULL AS title, q.state,
               COALESCE(q.decided_at, q.created_at) AS at, q.id AS target_id
        FROM content.removal_request q WHERE q.requester_id = :member""",
    "area_change": """
        SELECT 'area_change' AS kind, c.request_ref AS reference, c.to_gn AS title, c.state,
               COALESCE(c.decided_at, c.submitted_at, c.created_at) AS at, c.id AS target_id
        FROM profile.area_change c WHERE c.member_id = :member""",
    "privacy_request": """
        SELECT 'privacy_request' AS kind, p.request_ref AS reference, p.kind AS title, p.state,
               COALESCE(p.closed_at, p.created_at) AS at, p.id AS target_id
        FROM privacy.request p WHERE p.member_id = :member""",
}


def activity(db: Session, member_id: uuid.UUID, kinds: list[str], limit: int) -> list[ActivityItem]:
    """Newest first."""
    union = " UNION ALL ".join(_ACTIVITY[kind] for kind in kinds)
    rows = db.execute(
        text(f"SELECT * FROM ({union}) items ORDER BY at DESC, reference DESC LIMIT :limit"),
        {"member": member_id, "limit": limit},
    )
    return [ActivityItem(row.kind, row.reference, row.title, row.state, row.at, row.target_id) for row in rows]
