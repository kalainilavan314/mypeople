"""SQL for the election duty roster: shifts, assignments and operational messages."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Shift:
    id: uuid.UUID
    period_id: uuid.UUID
    period_ref: str
    role_en: str
    role_ta: str
    site_en: str
    site_ta: str
    area_key: str
    area_path: list[str]
    starts_at: datetime
    ends_at: datetime
    places: int
    state: str
    accepted: int
    offered: int


_SHIFT = """
    SELECT s.id, s.period_id, p.period_ref, s.role_en, s.role_ta, s.site_en, s.site_ta, s.area_key, s.area_path,
           s.starts_at, s.ends_at, s.places, s.state,
           (SELECT count(*) FROM election.roster_assignment a WHERE a.shift_id = s.id AND a.state = 'accepted') AS accepted,
           (SELECT count(*) FROM election.roster_assignment a WHERE a.shift_id = s.id AND a.state = 'offered') AS offered
    FROM election.roster_shift s JOIN election.period p ON p.id = s.period_id
"""


def _shift(row: Any) -> Shift:
    return Shift(**{**row, "area_path": list(row["area_path"])})


def find_shift(db: Session, shift_id: uuid.UUID, *, lock: bool = False) -> Shift | None:
    row = db.execute(text(f"{_SHIFT} WHERE s.id = :id{' FOR UPDATE OF s' if lock else ''}"), {"id": shift_id}).mappings().one_or_none()
    return _shift(row) if row else None


def shifts(db: Session, areas: list[str] | None, period_id: uuid.UUID | None) -> list[Shift]:
    conditions, params = ["TRUE"], {}
    if areas is not None:
        conditions.append("s.area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if period_id is not None:
        conditions.append("s.period_id = :period")
        params["period"] = period_id
    rows = db.execute(text(f"{_SHIFT} WHERE {' AND '.join(conditions)} ORDER BY s.starts_at LIMIT 300"), params).mappings()
    return [_shift(row) for row in rows]


def insert_shift(db: Session, values: dict[str, Any]) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO election.roster_shift (period_id, role_en, role_ta, site_en, site_ta, area_key, area_path,
                                                    starts_at, ends_at, places, created_by)
                VALUES (:period_id, :role_en, :role_ta, :site_en, :site_ta, :area_key, :area_path, :starts_at, :ends_at,
                        :places, :created_by) RETURNING id"""),
        values,
    )


def cancel_shift(db: Session, shift_id: uuid.UUID) -> None:
    db.execute(text("UPDATE election.roster_shift SET state = 'cancelled' WHERE id = :id"), {"id": shift_id})
    db.execute(text("""UPDATE election.roster_assignment SET state = 'cancelled'
                       WHERE shift_id = :id AND state IN ('offered', 'accepted')"""), {"id": shift_id})


@dataclass(frozen=True)
class Assignment:
    id: uuid.UUID
    shift_id: uuid.UUID
    member_id: uuid.UUID
    volunteer_name: str
    member_code: str
    state: str
    responded_at: datetime | None
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    site_confirmed: bool | None
    created_at: datetime


_ASSIGNMENT = """
    SELECT a.id, a.shift_id, a.member_id, COALESCE(dn.display_name, m.full_name) AS volunteer_name, m.member_code, a.state,
           a.responded_at, a.checked_in_at, a.checked_out_at, a.site_confirmed, a.created_at
    FROM election.roster_assignment a JOIN npm.member m ON m.id = a.member_id
    LEFT JOIN profile.display_name dn ON dn.member_id = m.id
"""


def assignments(db: Session, shift_id: uuid.UUID) -> list[Assignment]:
    return [Assignment(**row) for row in db.execute(text(f"{_ASSIGNMENT} WHERE a.shift_id = :s ORDER BY volunteer_name"),
                                                     {"s": shift_id}).mappings()]


def find_assignment(db: Session, assignment_id: uuid.UUID, *, lock: bool = False) -> Assignment | None:
    row = db.execute(text(f"{_ASSIGNMENT} WHERE a.id = :id{' FOR UPDATE OF a' if lock else ''}"),
                     {"id": assignment_id}).mappings().one_or_none()
    return Assignment(**row) if row else None


def member_assignments(db: Session, member_id: uuid.UUID) -> list[Assignment]:
    return [Assignment(**row) for row in db.execute(text(f"{_ASSIGNMENT} WHERE a.member_id = :m ORDER BY a.created_at DESC"),
                                                     {"m": member_id}).mappings()]


def insert_assignment(db: Session, shift_id: uuid.UUID, member_id: uuid.UUID, by: uuid.UUID) -> uuid.UUID | None:
    return db.scalar(
        text("""INSERT INTO election.roster_assignment (shift_id, member_id, assigned_by) VALUES (:s, :m, :by)
                ON CONFLICT (shift_id, member_id) DO NOTHING RETURNING id"""),
        {"s": shift_id, "m": member_id, "by": by},
    )


def update_assignment(db: Session, assignment_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE election.roster_assignment SET {sets} WHERE id = :id"), {**values, "id": assignment_id})


def member_by_code(db: Session, member_code: str) -> uuid.UUID | None:
    return db.scalar(text("SELECT id FROM npm.member WHERE upper(member_code) = upper(:c) AND deleted_at IS NULL"), {"c": member_code})


def insert_message(db: Session, shift_id: uuid.UUID, body_en: str, body_ta: str, sent_by: uuid.UUID, recipients: int) -> None:
    db.execute(
        text("""INSERT INTO election.roster_message (shift_id, body_en, body_ta, sent_by, recipients)
                VALUES (:s, :en, :ta, :by, :n)"""),
        {"s": shift_id, "en": body_en, "ta": body_ta, "by": sent_by, "n": recipients},
    )


def period_report(db: Session, period_id: uuid.UUID) -> dict[str, int]:
    """FR-ELX-009: what was sent, changed and published in the period's area and time."""
    row = db.execute(
        text(
            """
            WITH p AS (SELECT * FROM election.period WHERE id = :id)
            SELECT
              (SELECT count(*) FROM election.roster_shift s WHERE s.period_id = :id) AS shifts,
              (SELECT count(*) FROM election.roster_assignment a JOIN election.roster_shift s ON s.id = a.shift_id
               WHERE s.period_id = :id) AS roster_assignments,
              (SELECT count(*) FROM election.roster_assignment a JOIN election.roster_shift s ON s.id = a.shift_id
               WHERE s.period_id = :id AND a.state IN ('declined', 'cancelled')) AS roster_changes,
              (SELECT count(*) FROM election.roster_message m JOIN election.roster_shift s ON s.id = m.shift_id
               WHERE s.period_id = :id) AS roster_messages,
              (SELECT count(*) FROM ops.audit_log l, p WHERE l.occurred_at BETWEEN p.starts_at AND p.ends_at
               AND l.action = 'messaging.broadcast.sent') AS broadcasts_sent,
              (SELECT count(*) FROM ops.audit_log l, p WHERE l.occurred_at BETWEEN p.starts_at AND p.ends_at
               AND l.action IN ('events.event.published', 'gallery.album.publish')) AS content_published,
              (SELECT count(*) FROM ops.audit_log l, p WHERE l.occurred_at BETWEEN p.starts_at AND p.ends_at
               AND l.action = 'election.silence.blocked') AS silence_blocks
            """
        ),
        {"id": period_id},
    ).mappings().one()
    return dict(row)
