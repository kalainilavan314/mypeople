"""SQL for events, RSVPs, passes and attendance (Alembic revision 0014)."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.rotating_codes import new_reference


@dataclass(frozen=True)
class StoredEvent:
    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    event_type: str
    starts_at: datetime
    ends_at: datetime
    checkin_opens_at: datetime
    checkin_closes_at: datetime
    venue: str
    meeting_point: str
    agenda: str
    accessibility: str
    contact_route: str
    capacity: int | None
    admits_pending: bool
    area_key: str
    area_path: list[str]
    state: str
    cancel_reason: str | None
    published_at: datetime | None
    cancelled_at: datetime | None
    going: int  # members going now
    waitlisted: int


# The details an event manager edits; everything else is set by the system.
EDITABLE = (
    "title_en",
    "title_ta",
    "description_en",
    "description_ta",
    "event_type",
    "starts_at",
    "ends_at",
    "checkin_opens_at",
    "checkin_closes_at",
    "venue",
    "meeting_point",
    "agenda",
    "accessibility",
    "contact_route",
    "capacity",
    "admits_pending",
)

_SELECT = """
    SELECT e.id, e.event_ref, e.title_en, e.title_ta, e.description_en, e.description_ta, e.event_type,
           e.starts_at, e.ends_at, e.checkin_opens_at, e.checkin_closes_at, e.venue, e.meeting_point, e.agenda,
           e.accessibility, e.contact_route, e.capacity, e.admits_pending, e.area_key, e.area_path, e.state,
           e.cancel_reason, e.published_at, e.cancelled_at,
           (SELECT count(*) FROM events.rsvp r WHERE r.event_id = e.id AND r.response = 'going')::int AS going,
           (SELECT count(*) FROM events.rsvp r WHERE r.event_id = e.id AND r.response = 'waitlisted')::int
               AS waitlisted
    FROM events.event e
"""


def _event(row: Any) -> StoredEvent:
    return StoredEvent(**row)


def insert_event(
    db: Session, *, details: dict[str, Any], area_key: str, area_path: list[str], created_by: uuid.UUID
) -> StoredEvent:
    columns = ", ".join(EDITABLE)
    values = ", ".join(f":{name}" for name in EDITABLE)
    event_id = db.scalar(
        text(
            f"""
            INSERT INTO events.event ({columns}, area_key, area_path, created_by, updated_by)
            VALUES ({values}, :area_key, :area_path, :member, :member) RETURNING id
            """
        ),
        {**details, "area_key": area_key, "area_path": area_path, "member": created_by},
    )
    stored = find_event(db, event_id)
    assert stored is not None
    return stored


def find_event(db: Session, event_id: uuid.UUID, *, for_update: bool = False) -> StoredEvent | None:
    if for_update:
        db.execute(text("SELECT 1 FROM events.event WHERE id = :id FOR UPDATE"), {"id": event_id})
    row = db.execute(text(f"{_SELECT} WHERE e.id = :id"), {"id": event_id}).mappings().one_or_none()
    return _event(row) if row else None


def update_event(db: Session, event_id: uuid.UUID, details: dict[str, Any], updated_by: uuid.UUID) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in details)
    db.execute(
        text(
            f"""
            UPDATE events.event SET {assignments}, updated_by = :member, updated_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {**details, "id": event_id, "member": updated_by},
    )


def publish(db: Session, event_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE events.event SET state = 'published', published_at = clock_timestamp(),
                   updated_by = :member, updated_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": event_id, "member": member_id},
    )


def cancel(db: Session, event_id: uuid.UUID, member_id: uuid.UUID, reason: str) -> None:
    """Every pass of the event stops working with it."""
    db.execute(
        text(
            """
            UPDATE events.event SET state = 'cancelled', cancelled_at = clock_timestamp(), cancel_reason = :reason,
                   updated_by = :member, updated_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": event_id, "member": member_id, "reason": reason},
    )
    db.execute(text("UPDATE events.rsvp SET pass_ref = NULL WHERE event_id = :id"), {"id": event_id})


@dataclass(frozen=True)
class EventListItem:
    event: StoredEvent
    my_response: str | None


def published_events(
    db: Session,
    *,
    member_id: uuid.UUID,
    area_keys: list[str] | None,
    starts_from: datetime,
    starts_before: datetime | None,
    event_type: str | None,
    search: str | None,
    participation: str | None,
    limit: int,
) -> list[EventListItem]:
    """Published and cancelled events still to come, soonest first. area_keys narrows to events
    whose scope is one of those areas (BR-057: "My area" is a filter, not a restriction)."""
    conditions = ["e.state IN ('published', 'cancelled')", "e.ends_at >= :starts_from"]
    params: dict[str, Any] = {"member": member_id, "starts_from": starts_from, "limit": limit}
    if area_keys is not None:
        conditions.append("e.area_key = ANY(CAST(:area_keys AS text[]))")
        params["area_keys"] = area_keys
    if starts_before is not None:
        conditions.append("e.starts_at < :starts_before")
        params["starts_before"] = starts_before
    if event_type is not None:
        conditions.append("e.event_type = :event_type")
        params["event_type"] = event_type
    if search:
        conditions.append(
            "(e.title_en ILIKE :search OR e.title_ta ILIKE :search OR e.venue ILIKE :search)"
        )
        params["search"] = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    if participation is not None:
        conditions.append("mine.response = :participation")
        params["participation"] = participation
    rows = db.execute(
        text(
            f"""
            SELECT ev.*, mine.response AS my_response FROM ({_SELECT}) ev
            JOIN events.event e ON e.id = ev.id
            LEFT JOIN events.rsvp mine ON mine.event_id = e.id AND mine.member_id = :member
            WHERE {" AND ".join(conditions)}
            ORDER BY e.starts_at, e.event_ref LIMIT :limit
            """
        ),
        params,
    ).mappings()
    items = []
    for row in rows:
        values = dict(row)
        my_response = values.pop("my_response")
        items.append(EventListItem(event=_event(values), my_response=my_response))
    return items


def next_going_event(db: Session, member_id: uuid.UUID, now: datetime, within: timedelta) -> StoredEvent | None:
    """The member's soonest published event they are going to, starting within the given time."""
    row = db.execute(
        text(
            f"""{_SELECT}
            JOIN events.rsvp r ON r.event_id = e.id AND r.member_id = :member AND r.response = 'going'
            WHERE e.state = 'published' AND e.starts_at >= :now AND e.starts_at < :until
            ORDER BY e.starts_at LIMIT 1
            """
        ),
        {"member": member_id, "now": now, "until": now + within},
    ).mappings().one_or_none()
    return _event(row) if row else None


def managed_events(
    db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int
) -> list[StoredEvent]:
    """Events in the manager's areas, soonest first. visible_areas=None means every area."""
    conditions = ["e.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit}
    if visible_areas is not None:
        conditions.append("e.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY e.starts_at, e.event_ref LIMIT :limit"), params
    ).mappings()
    return [_event(row) for row in rows]


# --- RSVPs (E05) --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredRsvp:
    response: str
    responded_at: datetime
    updated_at: datetime


def find_rsvp(db: Session, event_id: uuid.UUID, member_id: uuid.UUID) -> StoredRsvp | None:
    row = db.execute(
        text(
            "SELECT response, responded_at, updated_at FROM events.rsvp WHERE event_id = :event AND member_id = :member"
        ),
        {"event": event_id, "member": member_id},
    ).one_or_none()
    return StoredRsvp(row.response, row.responded_at, row.updated_at) if row else None


def save_rsvp(db: Session, event_id: uuid.UUID, member_id: uuid.UUID, response: str) -> None:
    """One record per member and event, changed in place, with every response kept in its history.
    A member who stops going loses their pass reference."""
    db.execute(
        text(
            """
            INSERT INTO events.rsvp (event_id, member_id, response) VALUES (:event, :member, :response)
            ON CONFLICT (event_id, member_id) DO UPDATE
            SET response = EXCLUDED.response, updated_at = clock_timestamp(),
                pass_ref = CASE WHEN EXCLUDED.response = 'going' THEN events.rsvp.pass_ref END
            """
        ),
        {"event": event_id, "member": member_id, "response": response},
    )
    db.execute(
        text("INSERT INTO events.rsvp_change (event_id, member_id, response) VALUES (:event, :member, :response)"),
        {"event": event_id, "member": member_id, "response": response},
    )


@dataclass(frozen=True)
class RsvpChange:
    response: str
    changed_at: datetime


def rsvp_history(db: Session, event_id: uuid.UUID, member_id: uuid.UUID) -> list[RsvpChange]:
    rows = db.execute(
        text(
            """
            SELECT response, changed_at FROM events.rsvp_change
            WHERE event_id = :event AND member_id = :member ORDER BY id
            """
        ),
        {"event": event_id, "member": member_id},
    )
    return [RsvpChange(row.response, row.changed_at) for row in rows]


def first_waitlisted(db: Session, event_id: uuid.UUID) -> uuid.UUID | None:
    """The member waiting longest, who takes a place that frees up."""
    return db.scalar(
        text(
            """
            SELECT r.member_id FROM events.rsvp r
            WHERE r.event_id = :event AND r.response = 'waitlisted'
            ORDER BY (SELECT max(c.changed_at) FROM events.rsvp_change c
                      WHERE c.event_id = r.event_id AND c.member_id = r.member_id), r.member_id
            LIMIT 1
            """
        ),
        {"event": event_id},
    )


def members_to_notify(db: Session, event_id: uuid.UUID) -> list[uuid.UUID]:
    """Members going, maybe going or waiting for a place (FR-ADM-004)."""
    return list(
        db.scalars(
            text(
                """
                SELECT member_id FROM events.rsvp
                WHERE event_id = :event AND response IN ('going', 'maybe', 'waitlisted')
                """
            ),
            {"event": event_id},
        )
    )


# --- Passes and attendance (E06, FR-EVT-012 to 017) -----------------------------------------------------


def pass_ref(db: Session, event_id: uuid.UUID, member_id: uuid.UUID) -> str:
    """The going member's pass reference, created on first use."""
    db.execute(
        text(
            """
            UPDATE events.rsvp SET pass_ref = :ref
            WHERE event_id = :event AND member_id = :member AND response = 'going' AND pass_ref IS NULL
            """
        ),
        {"event": event_id, "member": member_id, "ref": new_reference()},
    )
    ref = db.scalar(
        text("SELECT pass_ref FROM events.rsvp WHERE event_id = :event AND member_id = :member"),
        {"event": event_id, "member": member_id},
    )
    assert ref is not None
    return ref


def rsvp_by_pass_ref(db: Session, ref: str) -> tuple[uuid.UUID, uuid.UUID] | None:
    """(event, member) for a current pass reference."""
    row = db.execute(
        text("SELECT event_id, member_id FROM events.rsvp WHERE pass_ref = :ref AND response = 'going'"), {"ref": ref}
    ).one_or_none()
    return (row.event_id, row.member_id) if row else None


def attended_at(db: Session, event_id: uuid.UUID, member_id: uuid.UUID) -> datetime | None:
    return db.scalar(
        text("SELECT scanned_at FROM events.attendance WHERE event_id = :event AND member_id = :member"),
        {"event": event_id, "member": member_id},
    )


def record_attendance(
    db: Session,
    event_id: uuid.UUID,
    member_id: uuid.UUID,
    scanned_by: uuid.UUID,
    *,
    manual_reason: str | None = None,
    scanned_at: datetime | None = None,
) -> bool:
    """True when this check-in created the record; a repeat creates nothing (BR-061). A manual
    check-in (FR-VOI-007) keeps the reason the pass could not be scanned. An offline scan keeps the
    time the staff phone recorded it (scanned_at) rather than the time it reached the server."""
    created = db.scalar(
        text(
            """
            INSERT INTO events.attendance (event_id, member_id, scanned_by, method, manual_reason, scanned_at)
            VALUES (:event, :member, :scanner, :method, :reason, COALESCE(CAST(:scanned_at AS timestamptz), clock_timestamp()))
            ON CONFLICT (event_id, member_id) DO NOTHING RETURNING 1
            """
        ),
        {
            "event": event_id,
            "member": member_id,
            "scanner": scanned_by,
            "method": "scan" if manual_reason is None else "manual",
            "reason": manual_reason,
            "scanned_at": scanned_at,
        },
    )
    return created is not None


def member_by_code(db: Session, member_code: str) -> uuid.UUID | None:
    """As printed on the card, or typed in lower case on a phone keyboard."""
    return db.scalar(
        text("SELECT id FROM npm.member WHERE member_code IN (:code, upper(:code)) AND deleted_at IS NULL LIMIT 1"),
        {"code": member_code},
    )


def member_name(db: Session, member_id: uuid.UUID) -> tuple[str, str]:
    """What a scanner is shown: the name and member ID, nothing else (FR-ADM-001)."""
    row = db.execute(text("SELECT full_name, member_code FROM npm.member WHERE id = :id"), {"id": member_id}).one()
    return row.full_name, row.member_code


@dataclass(frozen=True)
class RosterEntry:
    member_id: uuid.UUID
    full_name: str
    member_code: str
    response: str | None  # None for someone scanned in after their RSVP changed
    attended_at: datetime | None
    checkin_method: str | None  # scan or manual


def roster(db: Session, event_id: uuid.UUID) -> list[RosterEntry]:
    """Everyone going or waitlisted, and everyone who attended (FR-STF-006)."""
    rows = db.execute(
        text(
            """
            SELECT m.id AS member_id, m.full_name, m.member_code, r.response, a.scanned_at AS attended_at,
                   a.method AS checkin_method
            FROM npm.member m
            LEFT JOIN events.rsvp r ON r.member_id = m.id AND r.event_id = :event
            LEFT JOIN events.attendance a ON a.member_id = m.id AND a.event_id = :event
            WHERE r.response IN ('going', 'waitlisted') OR a.scanned_at IS NOT NULL
            ORDER BY a.scanned_at NULLS LAST, m.full_name, m.member_code
            """
        ),
        {"event": event_id},
    )
    return [
        RosterEntry(row.member_id, row.full_name, row.member_code, row.response, row.attended_at, row.checkin_method)
        for row in rows
    ]
