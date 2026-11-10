"""SQL for GN area-change requests (profile.area_change, Alembic revision 0016)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredChange:
    id: uuid.UUID
    request_ref: str
    member_id: uuid.UUID
    from_gn: str | None
    from_gn_name: str | None
    to_gn: str
    to_gn_name: str
    area_path: list[str]
    proof_id: uuid.UUID | None
    proof_key: str | None
    proof_type: str | None
    state: str
    decision_reason: str | None
    created_at: datetime
    submitted_at: datetime | None
    decided_at: datetime | None


_SELECT = """
    SELECT c.id, c.request_ref, c.member_id, c.from_gn, fg.name_en AS from_gn_name, c.to_gn, g.name_en AS to_gn_name,
           c.area_path, c.proof_id, c.proof_key, c.proof_type, c.state, c.decision_reason, c.created_at, c.submitted_at,
           c.decided_at
    FROM profile.area_change c
    JOIN geo.gn_division g ON g.gn_code = c.to_gn
    LEFT JOIN geo.gn_division fg ON fg.gn_code = c.from_gn
"""


def _change(row: Any) -> StoredChange:
    return StoredChange(**row)


def insert(db: Session, *, member_id: uuid.UUID, from_gn: str | None, to_gn: str, area_path: list[str]) -> StoredChange:
    change_id = db.scalar(
        text(
            """
            INSERT INTO profile.area_change (member_id, from_gn, to_gn, area_path)
            VALUES (:member, :from_gn, :to_gn, :area_path) RETURNING id
            """
        ),
        {"member": member_id, "from_gn": from_gn, "to_gn": to_gn, "area_path": area_path},
    )
    stored = find(db, change_id)
    assert stored is not None
    return stored


def find(db: Session, change_id: uuid.UUID, *, for_update: bool = False) -> StoredChange | None:
    if for_update:
        db.execute(text("SELECT 1 FROM profile.area_change WHERE id = :id FOR UPDATE"), {"id": change_id})
    row = db.execute(text(f"{_SELECT} WHERE c.id = :id"), {"id": change_id}).mappings().one_or_none()
    return _change(row) if row else None


def has_open(db: Session, member_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM profile.area_change
                               WHERE member_id = :member AND state IN ('awaiting_proof', 'submitted'))
                """
            ),
            {"member": member_id},
        )
    )


def of_member(db: Session, member_id: uuid.UUID) -> list[StoredChange]:
    rows = db.execute(
        text(f"{_SELECT} WHERE c.member_id = :member ORDER BY c.created_at DESC"), {"member": member_id}
    ).mappings()
    return [_change(row) for row in rows]


def attach_proof(db: Session, change_id: uuid.UUID, *, proof_id: uuid.UUID, proof_key: str, proof_type: str) -> None:
    db.execute(
        text(
            """
            UPDATE profile.area_change
            SET proof_id = :proof, proof_key = :key, proof_type = :type, state = 'submitted',
                submitted_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": change_id, "proof": proof_id, "key": proof_key, "type": proof_type},
    )


def withdraw(db: Session, change_id: uuid.UUID) -> None:
    db.execute(
        text("UPDATE profile.area_change SET state = 'withdrawn', decided_at = clock_timestamp() WHERE id = :id"),
        {"id": change_id},
    )


def queue(
    db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int, reviewer_id: uuid.UUID | None = None
) -> list[StoredChange]:
    """Oldest submitted first. visible_areas=None means every area. A reviewer's own requests are left out:
    nobody may open or decide their own record, so listing it would only offer refused actions."""
    conditions = ["c.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit}
    if reviewer_id is not None:
        conditions.append("c.member_id <> :reviewer")
        params["reviewer"] = reviewer_id
    if visible_areas is not None:
        conditions.append("c.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY c.submitted_at NULLS LAST, c.request_ref LIMIT :limit"),
        params,
    ).mappings()
    return [_change(row) for row in rows]


def decide(db: Session, change_id: uuid.UUID, *, state: str, reason: str, decided_by: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE profile.area_change
            SET state = :state, decision_reason = :reason, decided_by = :member, decided_at = clock_timestamp()
            WHERE id = :id AND state = 'submitted'
            """
        ),
        {"id": change_id, "state": state, "reason": reason, "member": decided_by},
    )


def move_member(db: Session, member_id: uuid.UUID, gn_code: str) -> None:
    """The member's area becomes the GN division and the DS division and district above it,
    in the columns both APIs read."""
    db.execute(
        text(
            """
            UPDATE npm.member m SET gs_code = g.gn_code, ds_code = ds.ds_code, district_code = ds.district_code
            FROM geo.gn_division g JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
            WHERE m.id = :member AND g.gn_code = :gn
            """
        ),
        {"member": member_id, "gn": gn_code},
    )


def current_gn(db: Session, member_id: uuid.UUID) -> str | None:
    return db.scalar(text("SELECT gs_code FROM npm.member WHERE id = :id"), {"id": member_id})
