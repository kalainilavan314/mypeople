"""SQL for identity.assisted_request and identity.assisted_session (Alembic revision 0051).

Neither table holds an image, an ID number or anything read from a document: the images are in the
evidence vault (identity/documents) and are never opened here.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Serialises a member's requests, so a double tap cannot open two.
_REQUEST_LOCK_SPACE = 30_052


@dataclass(frozen=True)
class Request:
    id: uuid.UUID
    request_ref: str
    member_id: uuid.UUID
    reason: str
    route: str
    preferred_date: date | None
    preferred_time: str | None
    area_path: list[str]
    state: str
    scheduled_for: datetime | None
    meeting_place: str | None
    closed_reason: str | None
    created_at: datetime
    updated_at: datetime


_REQUEST = """
    SELECT id, request_ref, member_id, reason, route, preferred_date, preferred_time, area_path, state, scheduled_for,
           meeting_place, closed_reason, created_at, updated_at
    FROM identity.assisted_request
"""


def _request(row: Any) -> Request:
    return Request(**{**row, "area_path": list(row["area_path"])})


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:member_id AS text)))"),
        {"space": _REQUEST_LOCK_SPACE, "member_id": member_id},
    )


def insert_request(db: Session, *, member_id: uuid.UUID, reason: str, route: str, preferred_date: date | None,
                   preferred_time: str | None, area_path: list[str]) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO identity.assisted_request (member_id, reason, route, preferred_date, preferred_time, area_path)
            VALUES (:member_id, :reason, :route, :preferred_date, :preferred_time, :area_path) RETURNING id
            """
        ),
        {"member_id": member_id, "reason": reason, "route": route, "preferred_date": preferred_date,
         "preferred_time": preferred_time, "area_path": area_path},
    )


def find_request(db: Session, request_id: uuid.UUID, *, lock: bool = False) -> Request | None:
    row = db.execute(
        text(f"{_REQUEST} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": request_id}
    ).mappings().one_or_none()
    return _request(row) if row else None


def latest_request(db: Session, member_id: uuid.UUID) -> Request | None:
    row = db.execute(
        text(f"{_REQUEST} WHERE member_id = :id ORDER BY created_at DESC LIMIT 1"), {"id": member_id}
    ).mappings().one_or_none()
    return _request(row) if row else None


def update_request(db: Session, request_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE identity.assisted_request SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": request_id},
    )


def queue(db: Session, *, areas: list[str] | None, states: list[str], limit: int) -> list[Request]:
    """Oldest first: the member who has waited longest is helped first."""
    conditions, params = ["state = ANY(CAST(:states AS text[]))"], {"states": states, "limit": limit}
    if areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"{_REQUEST} WHERE {' AND '.join(conditions)} ORDER BY COALESCE(scheduled_for, created_at), request_ref LIMIT :limit"),
        params,
    ).mappings()
    return [_request(row) for row in rows]


def holders(db: Session, permission: str, area_path: list[str]) -> list[uuid.UUID]:
    """Active staff holding the permission over the area, to tell them a request arrived."""
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


@dataclass(frozen=True)
class MemberCard:
    """What the witness needs to find and call the member: no ID number, no image."""

    member_code: str
    full_name: str
    district_name: str | None
    ds_name: str | None
    gn_name: str | None


def member_card(db: Session, member_id: uuid.UUID) -> MemberCard | None:
    row = db.execute(
        text(
            """
            SELECT m.member_code, m.full_name, d.name_en AS district_name, ds.name_en AS ds_name, g.name_en AS gn_name
            FROM npm.member m
            LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
            LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            WHERE m.id = :id AND m.deleted_at IS NULL
            """
        ),
        {"id": member_id},
    ).mappings().one_or_none()
    return MemberCard(**row) if row else None


# --- Sessions ----------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class AssistedSession:
    id: uuid.UUID
    request_id: uuid.UUID
    witness_id: uuid.UUID
    witness_tier: str
    device: str
    started_at: datetime
    ended_at: datetime | None
    outcome: str | None
    checklist: list[str]
    notes: str | None
    abandon_reason: str | None
    review_id: uuid.UUID | None


_SESSION = """
    SELECT id, request_id, witness_id, witness_tier, device, started_at, ended_at, outcome, checklist, notes, abandon_reason,
           review_id
    FROM identity.assisted_session
"""


def insert_session(db: Session, *, request_id: uuid.UUID, witness_id: uuid.UUID, witness_tier: str,
                   device: str) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO identity.assisted_session (request_id, witness_id, witness_tier, device)
            VALUES (:request_id, :witness_id, :witness_tier, :device) RETURNING id
            """
        ),
        {"request_id": request_id, "witness_id": witness_id, "witness_tier": witness_tier, "device": device},
    )


def find_session(db: Session, session_id: uuid.UUID, *, lock: bool = False) -> AssistedSession | None:
    row = db.execute(
        text(f"{_SESSION} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": session_id}
    ).mappings().one_or_none()
    return AssistedSession(**row) if row else None


def sessions_for_request(db: Session, request_id: uuid.UUID) -> list[AssistedSession]:
    rows = db.execute(text(f"{_SESSION} WHERE request_id = :id ORDER BY started_at"), {"id": request_id}).mappings()
    return [AssistedSession(**row) for row in rows]


def sessions_for_review(db: Session, review_id: uuid.UUID) -> list[tuple[AssistedSession, str]]:
    """(session, request reference) for the sessions that fed this review."""
    rows = db.execute(
        text(
            """
            SELECT s.id, s.request_id, s.witness_id, s.witness_tier, s.device, s.started_at, s.ended_at, s.outcome,
                   s.checklist, s.notes, s.abandon_reason, s.review_id, r.request_ref
            FROM identity.assisted_session s JOIN identity.assisted_request r ON r.id = s.request_id
            WHERE s.review_id = :id ORDER BY s.started_at
            """
        ),
        {"id": review_id},
    ).mappings()
    result = []
    for row in rows:
        values = dict(row)
        ref = values.pop("request_ref")
        result.append((AssistedSession(**values), ref))
    return result


def end_session(db: Session, session_id: uuid.UUID, *, outcome: str, checklist: list[str], notes: str | None,
                abandon_reason: str | None, review_id: uuid.UUID | None) -> None:
    db.execute(
        text(
            """
            UPDATE identity.assisted_session
            SET ended_at = clock_timestamp(), outcome = :outcome, checklist = :checklist, notes = :notes,
                abandon_reason = :abandon_reason, review_id = :review_id
            WHERE id = :id AND ended_at IS NULL
            """
        ),
        {"id": session_id, "outcome": outcome, "checklist": checklist, "notes": notes, "abandon_reason": abandon_reason,
         "review_id": review_id},
    )


def witnessed(db: Session, review_id: uuid.UUID, staff_id: uuid.UUID) -> bool:
    """The person witnessed a session that fed this review (they may not then decide it)."""
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM identity.assisted_session WHERE review_id = :review AND witness_id = :staff)"),
            {"review": review_id, "staff": staff_id},
        )
    )
