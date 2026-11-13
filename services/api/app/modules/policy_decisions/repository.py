"""SQL for append-only Phase 1 policy decision revisions and reviews."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Revision:
    id: uuid.UUID
    decision_key: str
    revision: int
    status: str
    decision_text: str
    rationale: str
    effective_from: date | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    resolved_at: datetime | None


@dataclass(frozen=True)
class Review:
    id: int
    revision_id: uuid.UUID
    role: str
    outcome: str
    reviewer_name: str
    reviewer_title: str
    evidence_ref: str
    comment: str
    reviewed_at: date
    recorded_by: uuid.UUID
    created_at: datetime


def latest_revisions(db: Session) -> dict[str, Revision]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (decision_key)
                   id, decision_key, revision, status, decision_text, rationale, effective_from,
                   created_by, created_at, updated_at, submitted_at, resolved_at
              FROM ops.policy_decision_revision
             ORDER BY decision_key, revision DESC
            """
        )
    ).mappings()
    return {row["decision_key"]: Revision(**row) for row in rows}


def lock_key(db: Session, decision_key: str) -> None:
    """Serialize revision creation for one catalogue key without a mutable catalogue table."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": decision_key})


def get_revision(db: Session, revision_id: uuid.UUID, *, lock: bool = False) -> Revision | None:
    suffix = " FOR UPDATE" if lock else ""
    row = db.execute(
        text(
            """
            SELECT id, decision_key, revision, status, decision_text, rationale, effective_from,
                   created_by, created_at, updated_at, submitted_at, resolved_at
              FROM ops.policy_decision_revision WHERE id = :id
            """ + suffix
        ),
        {"id": revision_id},
    ).mappings().one_or_none()
    return Revision(**row) if row else None


def create_revision(
    db: Session,
    *,
    decision_key: str,
    decision_text: str,
    rationale: str,
    effective_from: date | None,
    actor_id: uuid.UUID,
) -> Revision:
    row = db.execute(
        text(
            """
            INSERT INTO ops.policy_decision_revision
                (decision_key, revision, decision_text, rationale, effective_from, created_by, updated_by)
            VALUES (
                :key,
                COALESCE((SELECT max(revision) + 1 FROM ops.policy_decision_revision WHERE decision_key = :key), 1),
                :decision_text, :rationale, :effective_from, :actor_id, :actor_id
            )
            RETURNING id, decision_key, revision, status, decision_text, rationale, effective_from,
                      created_by, created_at, updated_at, submitted_at, resolved_at
            """
        ),
        {
            "key": decision_key,
            "decision_text": decision_text,
            "rationale": rationale,
            "effective_from": effective_from,
            "actor_id": actor_id,
        },
    ).mappings().one()
    return Revision(**row)


def update_draft(
    db: Session,
    *,
    revision_id: uuid.UUID,
    decision_text: str,
    rationale: str,
    effective_from: date | None,
    actor_id: uuid.UUID,
) -> Revision:
    row = db.execute(
        text(
            """
            UPDATE ops.policy_decision_revision
               SET decision_text = :decision_text, rationale = :rationale, effective_from = :effective_from,
                   updated_by = :actor_id, updated_at = clock_timestamp()
             WHERE id = :id AND status = 'draft'
            RETURNING id, decision_key, revision, status, decision_text, rationale, effective_from,
                      created_by, created_at, updated_at, submitted_at, resolved_at
            """
        ),
        {
            "id": revision_id,
            "decision_text": decision_text,
            "rationale": rationale,
            "effective_from": effective_from,
            "actor_id": actor_id,
        },
    ).mappings().one_or_none()
    if row is None:
        raise LookupError("draft_not_found")
    return Revision(**row)


def submit(db: Session, revision_id: uuid.UUID, actor_id: uuid.UUID) -> Revision:
    row = db.execute(
        text(
            """
            UPDATE ops.policy_decision_revision
               SET status = 'in_review', submitted_by = :actor_id, submitted_at = clock_timestamp(),
                   updated_by = :actor_id, updated_at = clock_timestamp()
             WHERE id = :id AND status = 'draft'
            RETURNING id, decision_key, revision, status, decision_text, rationale, effective_from,
                      created_by, created_at, updated_at, submitted_at, resolved_at
            """
        ),
        {"id": revision_id, "actor_id": actor_id},
    ).mappings().one_or_none()
    if row is None:
        raise LookupError("draft_not_found")
    return Revision(**row)


def reviews(db: Session, revision_id: uuid.UUID) -> list[Review]:
    rows = db.execute(
        text(
            """
            SELECT id, revision_id, role, outcome, reviewer_name, reviewer_title, evidence_ref,
                   comment, reviewed_at, recorded_by, created_at
              FROM ops.policy_decision_review
             WHERE revision_id = :revision_id ORDER BY created_at, id
            """
        ),
        {"revision_id": revision_id},
    ).mappings()
    return [Review(**row) for row in rows]


def add_review(
    db: Session,
    *,
    revision_id: uuid.UUID,
    role: str,
    outcome: str,
    reviewer_name: str,
    reviewer_title: str,
    evidence_ref: str,
    comment: str,
    reviewed_at: date,
    actor_id: uuid.UUID,
) -> Review:
    row = db.execute(
        text(
            """
            INSERT INTO ops.policy_decision_review
                (revision_id, role, outcome, reviewer_name, reviewer_title, evidence_ref,
                 comment, reviewed_at, recorded_by)
            VALUES (:revision_id, :role, :outcome, :reviewer_name, :reviewer_title, :evidence_ref,
                    :comment, :reviewed_at, :actor_id)
            RETURNING id, revision_id, role, outcome, reviewer_name, reviewer_title, evidence_ref,
                      comment, reviewed_at, recorded_by, created_at
            """
        ),
        {
            "revision_id": revision_id,
            "role": role,
            "outcome": outcome,
            "reviewer_name": reviewer_name,
            "reviewer_title": reviewer_title,
            "evidence_ref": evidence_ref,
            "comment": comment,
            "reviewed_at": reviewed_at,
            "actor_id": actor_id,
        },
    ).mappings().one()
    return Review(**row)


def resolve(db: Session, revision_id: uuid.UUID, status: str, actor_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE ops.policy_decision_revision
               SET status = :status, resolved_at = clock_timestamp(), updated_by = :actor_id,
                   updated_at = clock_timestamp()
             WHERE id = :id AND status = 'in_review'
            """
        ),
        {"id": revision_id, "status": status, "actor_id": actor_id},
    )


def approved_keys(db: Session, keys: tuple[str, ...]) -> set[str]:
    if not keys:
        return set()
    return set(
        db.scalars(
            text(
                """
                SELECT decision_key
                  FROM (
                    SELECT DISTINCT ON (decision_key) decision_key, status
                      FROM ops.policy_decision_revision
                     WHERE decision_key = ANY(:keys)
                     ORDER BY decision_key, revision DESC
                  ) latest
                 WHERE status = 'approved'
                """
            ),
            {"keys": list(keys)},
        )
    )
