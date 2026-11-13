"""SQL for identity reviews and decisions (Alembic revision 0004), and the
Express verification status kept in step with them."""

import json
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Serialises submissions per member, so a double tap cannot create two reviews (FR-REG-019).
_SUBMIT_LOCK_SPACE = 30_002


@dataclass(frozen=True)
class StoredReview:
    id: uuid.UUID
    review_ref: str
    member_id: uuid.UUID
    route: str
    state: str
    area_path: list[str]
    submitted_at: datetime
    resubmitted_at: datetime | None
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None
    claimed_at: datetime | None
    decided_at: datetime | None


@dataclass(frozen=True)
class StoredDecision:
    id: uuid.UUID
    review_id: uuid.UUID
    decision: str
    reviewer_id: uuid.UUID
    reviewer_tier: str
    decided_at: datetime
    checklist: list[str]
    requested_items: list[str]
    reason_category: str | None
    note: str | None
    evidence: dict[str, Any]

    def document_ids(self) -> dict[str, str]:
        """{kind: document id} of the images the decision was made on."""
        return {kind: document["id"] for kind, document in self.evidence.items()}


@dataclass(frozen=True)
class ReviewMember:
    id: uuid.UUID
    member_code: str
    full_name: str
    dob: date | None
    district_code: str | None
    ds_code: str | None
    gs_code: str | None
    verification_status: str


_SELECT_REVIEW = """
    SELECT r.id, r.review_ref, r.member_id, r.route, r.state, r.area_path, r.submitted_at, r.resubmitted_at,
           r.claimed_by, c.full_name AS claimed_by_name, r.claimed_at, r.decided_at
    FROM identity.identity_review r
    JOIN npm.member m ON m.id = r.member_id AND m.deleted_at IS NULL
    LEFT JOIN npm.member c ON c.id = r.claimed_by
"""

_SELECT_DECISION = """
    SELECT id, review_id, decision, reviewer_id, reviewer_tier, decided_at, checklist, requested_items,
           reason_category, note, evidence
    FROM identity.review_decision
"""


def _review(row: Any) -> StoredReview:
    return StoredReview(**row)


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:member_id AS text)))"),
        {"space": _SUBMIT_LOCK_SPACE, "member_id": member_id},
    )


def find_review(db: Session, review_id: uuid.UUID, *, for_update: bool = False) -> StoredReview | None:
    if for_update:
        # Locks the review row, so two reviewers claiming or deciding at once are applied one after the other.
        db.execute(text("SELECT 1 FROM identity.identity_review WHERE id = :id FOR UPDATE"), {"id": review_id})
    row = db.execute(text(f"{_SELECT_REVIEW} WHERE r.id = :id"), {"id": review_id}).mappings().one_or_none()
    return _review(row) if row else None


def latest_review(db: Session, member_id: uuid.UUID) -> StoredReview | None:
    row = db.execute(
        text(f"{_SELECT_REVIEW} WHERE r.member_id = :member_id ORDER BY r.submitted_at DESC, r.review_ref DESC LIMIT 1"),
        {"member_id": member_id},
    ).mappings().one_or_none()
    return _review(row) if row else None


def insert_review(db: Session, *, member_id: uuid.UUID, route: str, area_path: list[str]) -> StoredReview:
    review_id = db.scalar(
        text(
            """
            INSERT INTO identity.identity_review (member_id, route, area_path)
            VALUES (:member_id, :route, :area_path)
            RETURNING id
            """
        ),
        {"member_id": member_id, "route": route, "area_path": area_path},
    )
    review = find_review(db, review_id)
    assert review is not None
    return review


def resubmit(db: Session, review_id: uuid.UUID) -> None:
    """A correction goes back to the reviewer who asked for it, or to the queue if nobody holds it (FR-REG-023)."""
    db.execute(
        text(
            """
            UPDATE identity.identity_review
            SET state = CASE WHEN claimed_by IS NULL THEN 'submitted' ELSE 'in_review' END,
                resubmitted_at = now()
            WHERE id = :id AND state = 'needs_update'
            """
        ),
        {"id": review_id},
    )


def claim(db: Session, review_id: uuid.UUID, reviewer_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.identity_review SET state = 'in_review', claimed_by = :reviewer_id, claimed_at = now()
            WHERE id = :id AND state IN ('submitted', 'in_review')
            """
        ),
        {"id": review_id, "reviewer_id": reviewer_id},
    )


def release(db: Session, review_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE identity.identity_review SET state = 'submitted', claimed_by = NULL, claimed_at = NULL
            WHERE id = :id AND state = 'in_review'
            """
        ),
        {"id": review_id},
    )


def reopen_after_appeal(db: Session, review_id: uuid.UUID) -> None:
    """An overturned decision: the review goes back to the queue, unclaimed, for a fresh decision."""
    db.execute(
        text(
            """
            UPDATE identity.identity_review
            SET state = 'submitted', claimed_by = NULL, claimed_at = NULL, decided_at = NULL, resubmitted_at = now()
            WHERE id = :id AND state IN ('needs_update', 'unable_to_verify')
            """
        ),
        {"id": review_id},
    )


def set_state_after_decision(db: Session, review_id: uuid.UUID, state: str) -> None:
    db.execute(
        text(
            """
            UPDATE identity.identity_review
            SET state = :state,
                decided_at = CASE WHEN :state IN ('verified', 'unable_to_verify') THEN now() END
            WHERE id = :id
            """
        ),
        {"id": review_id, "state": state},
    )


def insert_decision(
    db: Session,
    *,
    review_id: uuid.UUID,
    decision: str,
    reviewer_id: uuid.UUID,
    reviewer_tier: str,
    checklist: list[str],
    requested_items: list[str],
    reason_category: str | None,
    note: str | None,
    evidence: dict[str, Any],
) -> None:
    db.execute(
        text(
            """
            INSERT INTO identity.review_decision (review_id, decision, reviewer_id, reviewer_tier, decided_at, checklist,
                                                  requested_items, reason_category, note, evidence)
            -- clock_timestamp(), not now(): the real time even inside a longer transaction, so
            -- decisions on one review always sort in the order they were made.
            VALUES (:review_id, :decision, :reviewer_id, :reviewer_tier, clock_timestamp(), :checklist,
                    :requested_items, :reason_category, :note, CAST(:evidence AS jsonb))
            """
        ),
        {
            "review_id": review_id,
            "decision": decision,
            "reviewer_id": reviewer_id,
            "reviewer_tier": reviewer_tier,
            "checklist": checklist,
            "requested_items": requested_items,
            "reason_category": reason_category,
            "note": note,
            "evidence": json.dumps(evidence),
        },
    )


def decisions(db: Session, review_id: uuid.UUID) -> list[StoredDecision]:
    """Oldest first."""
    rows = db.execute(
        text(f"{_SELECT_DECISION} WHERE review_id = :review_id ORDER BY decided_at, id"), {"review_id": review_id}
    ).mappings()
    return [StoredDecision(**row) for row in rows]


def queue(
    db: Session,
    *,
    visible_areas: list[str] | None,
    states: list[str],
    claimed_by: uuid.UUID | None,
    review_ref: str | None,
    limit: int,
    offset: int = 0,
) -> list[StoredReview]:
    """Oldest waiting first (W01). visible_areas=None means every area."""
    conditions = ["r.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit, "offset": offset}
    if visible_areas is not None:
        conditions.append("r.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    if claimed_by is not None:
        conditions.append("r.claimed_by = :claimed_by")
        params["claimed_by"] = claimed_by
    if review_ref is not None:
        conditions.append("r.review_ref = :review_ref")
        params["review_ref"] = review_ref
    rows = db.execute(
        text(
            f"""{_SELECT_REVIEW} WHERE {" AND ".join(conditions)}
            ORDER BY COALESCE(r.resubmitted_at, r.submitted_at), r.review_ref LIMIT :limit OFFSET :offset"""
        ),
        params,
    ).mappings()
    return [_review(row) for row in rows]


@dataclass(frozen=True)
class QueueCounts:
    awaiting_review: int
    needs_update: int
    assigned_to_me: int


def queue_counts(db: Session, *, visible_areas: list[str] | None, reviewer_id: uuid.UUID) -> QueueCounts:
    area_condition = "AND r.area_path && CAST(:areas AS text[])" if visible_areas is not None else ""
    row = db.execute(
        text(
            f"""
            SELECT count(*) FILTER (WHERE r.state = 'submitted') AS awaiting_review,
                   count(*) FILTER (WHERE r.state = 'needs_update') AS needs_update,
                   count(*) FILTER (WHERE r.state IN ('in_review', 'needs_update') AND r.claimed_by = :reviewer_id)
                       AS assigned_to_me
            FROM identity.identity_review r
            JOIN npm.member m ON m.id = r.member_id AND m.deleted_at IS NULL
            WHERE r.state IN ('submitted', 'in_review', 'needs_update') {area_condition}
            """
        ),
        {"areas": visible_areas, "reviewer_id": reviewer_id},
    ).one()
    return QueueCounts(row.awaiting_review, row.needs_update, row.assigned_to_me)


def has_open_review_claimed_by(db: Session, member_id: uuid.UUID, reviewer_id: uuid.UUID) -> bool:
    """PRM-03: evidence opens only inside a review that this reviewer is working on."""
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM identity.identity_review
                               WHERE member_id = :member_id AND state = 'in_review' AND claimed_by = :reviewer_id)
                """
            ),
            {"member_id": member_id, "reviewer_id": reviewer_id},
        )
    )


def find_member(db: Session, member_id: uuid.UUID) -> ReviewMember | None:
    """The profile details a reviewer compares with the documents (FR-WEB-007)."""
    row = db.execute(
        text(
            """
            SELECT id, member_code, full_name, dob, district_code, ds_code, gs_code, verification_status
            FROM npm.member WHERE id = :id AND deleted_at IS NULL
            """
        ),
        {"id": member_id},
    ).mappings().one_or_none()
    return ReviewMember(**row) if row else None


def set_express_status(
    db: Session, *, member_id: uuid.UUID, status: str, changed_by: uuid.UUID, review_ref: str
) -> None:
    """Keep npm.member.verification_status in step, with its own audit row, for the live member app
    and the Express API. Only an approval sets identity_confirmed and verified_by."""
    db.execute(
        text(
            """
            INSERT INTO npm.verification_audit (member_id, from_status, to_status, method, changed_by, notes)
            SELECT id, verification_status, :status, 'identity_review', :changed_by, :review_ref
            FROM npm.member WHERE id = :member_id
            """
        ),
        {"member_id": member_id, "status": status, "changed_by": changed_by, "review_ref": review_ref},
    )
    confirmed = status == "identity_confirmed"
    db.execute(
        text(
            """
            UPDATE npm.member
            SET verification_status = :status, verification_method = 'identity_review',
                verified_at = CASE WHEN :confirmed THEN now() END,
                verified_by = CASE WHEN :confirmed THEN CAST(:changed_by AS uuid) END
            WHERE id = :member_id
            """
        ),
        {"member_id": member_id, "status": status, "changed_by": changed_by, "confirmed": confirmed},
    )


def has_nic_hash(db: Session, member_id: uuid.UUID) -> bool:
    return bool(db.scalar(text("SELECT nic_hash IS NOT NULL FROM npm.member WHERE id = :id"), {"id": member_id}))
