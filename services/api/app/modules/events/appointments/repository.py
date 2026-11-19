"""SQL for representative profiles, their appointment slots and the bookings."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Representative:
    id: uuid.UUID
    member_id: uuid.UUID
    role_en: str
    role_ta: str
    display_name_en: str
    display_name_ta: str
    area_key: str
    area_path: list[str]
    office_hours_en: str
    office_hours_ta: str
    public_phone: str | None
    public_email: str | None
    office_address_en: str | None
    office_address_ta: str | None
    contacts_approved_at: datetime | None
    state: str
    withdrawn_reason: str | None
    published_at: datetime | None
    open_slots: int
    next_open_slot: datetime | None
    created_at: datetime
    updated_at: datetime


PROFILE_FIELDS = ("role_en", "role_ta", "display_name_en", "display_name_ta", "office_hours_en", "office_hours_ta")
CONTACT_FIELDS = ("public_phone", "public_email", "office_address_en", "office_address_ta")

_FREE = """s.state = 'open' AND s.starts_at > now()
           AND NOT EXISTS (SELECT 1 FROM events.appointment a WHERE a.slot_id = s.id AND a.state <> 'cancelled')"""

_REPRESENTATIVE = f"""
    SELECT r.id, r.member_id, r.role_en, r.role_ta, r.display_name_en, r.display_name_ta, r.area_key, r.area_path,
           r.office_hours_en, r.office_hours_ta, r.public_phone, r.public_email, r.office_address_en,
           r.office_address_ta, r.contacts_approved_at, r.state, r.withdrawn_reason, r.published_at,
           (SELECT count(*) FROM events.appointment_slot s WHERE s.representative_id = r.id AND {_FREE}) AS open_slots,
           (SELECT min(s.starts_at) FROM events.appointment_slot s WHERE s.representative_id = r.id AND {_FREE})
               AS next_open_slot,
           r.created_at, r.updated_at
    FROM events.representative r
"""


def _representative(row: Any) -> Representative:
    return Representative(**{**row, "area_path": list(row["area_path"])})


def find(db: Session, representative_id: uuid.UUID, *, lock: bool = False) -> Representative | None:
    row = db.execute(
        text(f"{_REPRESENTATIVE} WHERE r.id = :id{' FOR UPDATE OF r' if lock else ''}"), {"id": representative_id}
    ).mappings().one_or_none()
    return _representative(row) if row else None


def find_by_member(db: Session, member_id: uuid.UUID) -> Representative | None:
    row = db.execute(text(f"{_REPRESENTATIVE} WHERE r.member_id = :member"), {"member": member_id}).mappings().one_or_none()
    return _representative(row) if row else None


def published(db: Session) -> list[Representative]:
    rows = db.execute(text(f"{_REPRESENTATIVE} WHERE r.state = 'published' ORDER BY r.display_name_en")).mappings()
    return [_representative(row) for row in rows]


def managed(db: Session, areas: list[str] | None, state: str | None) -> list[Representative]:
    conditions, params = ["TRUE"], {}
    if areas is not None:
        conditions.append("r.area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if state:
        conditions.append("r.state = :state")
        params["state"] = state
    rows = db.execute(
        text(f"{_REPRESENTATIVE} WHERE {' AND '.join(conditions)} ORDER BY r.state, r.display_name_en LIMIT 500"), params
    ).mappings()
    return [_representative(row) for row in rows]


def insert(db: Session, member_id: uuid.UUID, values: dict[str, Any], area_key: str, area_path: list[str],
           staff_id: uuid.UUID) -> uuid.UUID:
    fields = (*PROFILE_FIELDS, *CONTACT_FIELDS)
    return db.scalar(
        text(f"""INSERT INTO events.representative (member_id, {', '.join(fields)}, area_key, area_path, created_by, updated_by)
                 VALUES (:member, {', '.join(f':{name}' for name in fields)}, :area_key, :area_path, :staff, :staff)
                 RETURNING id"""),
        {**{name: values.get(name) for name in fields}, "member": member_id, "area_key": area_key,
         "area_path": area_path, "staff": staff_id},
    )


def update(db: Session, representative_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE events.representative SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": representative_id},
    )


def member_by_code(db: Session, member_code: str) -> uuid.UUID | None:
    return db.scalar(
        text("SELECT id FROM npm.member WHERE upper(member_code) = upper(:code) AND deleted_at IS NULL"),
        {"code": member_code.strip()},
    )


@dataclass(frozen=True)
class Slot:
    id: uuid.UUID
    representative_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    mode: str
    place_en: str | None
    place_ta: str | None
    state: str
    withdrawn_reason: str | None
    booking_id: uuid.UUID | None  # the live booking on it, if any


_SLOT = """
    SELECT s.id, s.representative_id, s.starts_at, s.ends_at, s.mode, s.place_en, s.place_ta, s.state, s.withdrawn_reason,
           (SELECT a.id FROM events.appointment a WHERE a.slot_id = s.id AND a.state <> 'cancelled') AS booking_id
    FROM events.appointment_slot s
"""


def find_slot(db: Session, slot_id: uuid.UUID, *, lock: bool = False) -> Slot | None:
    row = db.execute(
        text(f"{_SLOT} WHERE s.id = :id{' FOR UPDATE OF s' if lock else ''}"), {"id": slot_id}
    ).mappings().one_or_none()
    return Slot(**row) if row else None


def slots(db: Session, representative_id: uuid.UUID, *, since: datetime, until: datetime | None,
          free_only: bool) -> list[Slot]:
    conditions = ["s.representative_id = :rep", "s.ends_at >= :since"]
    params: dict[str, Any] = {"rep": representative_id, "since": since}
    if until is not None:
        conditions.append("s.starts_at < :until")
        params["until"] = until
    if free_only:
        conditions.append(_FREE)
    rows = db.execute(text(f"{_SLOT} WHERE {' AND '.join(conditions)} ORDER BY s.starts_at LIMIT 400"), params).mappings()
    return [Slot(**row) for row in rows]


def open_slot_times(db: Session, representative_id: uuid.UUID) -> list[tuple[datetime, datetime]]:
    rows = db.execute(
        text("SELECT starts_at, ends_at FROM events.appointment_slot WHERE representative_id = :rep AND state = 'open'"),
        {"rep": representative_id},
    )
    return [(row.starts_at, row.ends_at) for row in rows]


def insert_slot(db: Session, representative_id: uuid.UUID, starts_at: datetime, ends_at: datetime, mode: str,
                place_en: str | None, place_ta: str | None, staff_id: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO events.appointment_slot (representative_id, starts_at, ends_at, mode, place_en, place_ta, created_by)
                VALUES (:rep, :starts, :ends, :mode, :place_en, :place_ta, :staff) RETURNING id"""),
        {"rep": representative_id, "starts": starts_at, "ends": ends_at, "mode": mode, "place_en": place_en,
         "place_ta": place_ta, "staff": staff_id},
    )


def withdraw_slot(db: Session, slot_id: uuid.UUID, reason: str) -> None:
    db.execute(
        text("UPDATE events.appointment_slot SET state = 'withdrawn', withdrawn_reason = :reason WHERE id = :id"),
        {"id": slot_id, "reason": reason},
    )


@dataclass(frozen=True)
class Appointment:
    id: uuid.UUID
    appointment_ref: str
    slot_id: uuid.UUID
    representative_id: uuid.UUID
    member_id: uuid.UUID
    topic: str
    contact_preference: str
    contact_phone: str | None
    needs: list[str]
    needs_note: str | None
    case_ref: str | None
    case_consent_at: datetime | None
    state: str
    cancelled_by: str | None
    cancel_reason: str | None
    cancelled_at: datetime | None
    follow_up_note: str | None
    follow_up_at: datetime | None
    booked_at: datetime
    starts_at: datetime
    ends_at: datetime
    mode: str
    place_en: str | None
    place_ta: str | None
    role_en: str
    role_ta: str
    display_name_en: str
    display_name_ta: str
    area_key: str
    representative_member_id: uuid.UUID


_APPOINTMENT = """
    SELECT a.id, a.appointment_ref, a.slot_id, a.representative_id, a.member_id, a.topic, a.contact_preference,
           a.contact_phone, a.needs, a.needs_note, a.case_ref, a.case_consent_at, a.state, a.cancelled_by, a.cancel_reason,
           a.cancelled_at, a.follow_up_note, a.follow_up_at, a.booked_at, s.starts_at, s.ends_at, s.mode, s.place_en,
           s.place_ta, r.role_en, r.role_ta, r.display_name_en, r.display_name_ta, r.area_key,
           r.member_id AS representative_member_id
    FROM events.appointment a
    JOIN events.appointment_slot s ON s.id = a.slot_id
    JOIN events.representative r ON r.id = a.representative_id
"""


def _appointment(row: Any) -> Appointment:
    return Appointment(**{**row, "needs": list(row["needs"])})


def find_appointment(db: Session, appointment_id: uuid.UUID, *, lock: bool = False) -> Appointment | None:
    row = db.execute(
        text(f"{_APPOINTMENT} WHERE a.id = :id{' FOR UPDATE OF a' if lock else ''}"), {"id": appointment_id}
    ).mappings().one_or_none()
    return _appointment(row) if row else None


def member_appointments(db: Session, member_id: uuid.UUID) -> list[Appointment]:
    rows = db.execute(
        text(f"{_APPOINTMENT} WHERE a.member_id = :member ORDER BY s.starts_at DESC LIMIT 200"), {"member": member_id}
    ).mappings()
    return [_appointment(row) for row in rows]


def representative_appointments(db: Session, representative_id: uuid.UUID, slot_ids: list[uuid.UUID]) -> list[Appointment]:
    if not slot_ids:
        return []
    rows = db.execute(
        text(f"{_APPOINTMENT} WHERE a.representative_id = :rep AND a.slot_id = ANY(:slots) ORDER BY a.booked_at"),
        {"rep": representative_id, "slots": slot_ids},
    ).mappings()
    return [_appointment(row) for row in rows]


def upcoming_counts(db: Session, member_id: uuid.UUID, representative_id: uuid.UUID) -> tuple[int, int]:
    row = db.execute(
        text("""SELECT count(*) AS everyone, count(*) FILTER (WHERE a.representative_id = :rep) AS this_one
                FROM events.appointment a JOIN events.appointment_slot s ON s.id = a.slot_id
                WHERE a.member_id = :member AND a.state = 'booked' AND s.starts_at > now()"""),
        {"member": member_id, "rep": representative_id},
    ).one()
    return int(row.everyone), int(row.this_one)


def insert_appointment(db: Session, values: dict[str, Any]) -> uuid.UUID:
    names = ("slot_id", "representative_id", "member_id", "topic", "contact_preference", "contact_phone", "needs",
             "needs_note", "case_ref", "case_consent_at")
    return db.scalar(
        text(f"""INSERT INTO events.appointment ({', '.join(names)})
                 VALUES ({', '.join(f':{name}' for name in names)}) RETURNING id"""),
        {name: values.get(name) for name in names},
    )


def update_appointment(db: Session, appointment_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE events.appointment SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": appointment_id},
    )


def member_names(db: Session, member_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[str, str]]:
    """The name and member ID of the people booked, for the representative they booked with only."""
    if not member_ids:
        return {}
    rows = db.execute(
        text("SELECT id, full_name, member_code FROM npm.member WHERE id = ANY(:ids)"), {"ids": member_ids}
    )
    return {row.id: (row.full_name, row.member_code) for row in rows}


def due_reminders(db: Session, column: str, window_start: datetime, window_end: datetime,
                  lead: str) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """Booked appointments starting inside the window that were booked before the reminder's lead
    time (a booking made 30 minutes ahead gets no "within an hour" reminder), not reminded yet."""
    assert column in ("reminded_day_at", "reminded_hour_at")
    rows = db.execute(
        text(f"""SELECT a.id, a.member_id FROM events.appointment a JOIN events.appointment_slot s ON s.id = a.slot_id
                 WHERE a.state = 'booked' AND a.{column} IS NULL AND s.starts_at > :start AND s.starts_at <= :end
                   AND a.booked_at <= s.starts_at - CAST(:lead AS interval)
                 FOR UPDATE OF a SKIP LOCKED"""),
        {"start": window_start, "end": window_end, "lead": lead},
    )
    return [(row.id, row.member_id) for row in rows]


def purge_older_than(db: Session, cutoff: datetime) -> int:
    """ENT-58: appointments are kept two years after the meeting time."""
    result = db.execute(
        text("""DELETE FROM events.appointment a USING events.appointment_slot s
                WHERE s.id = a.slot_id AND s.ends_at < :cutoff"""),
        {"cutoff": cutoff},
    )
    return int(result.rowcount or 0)  # type: ignore[attr-defined]
