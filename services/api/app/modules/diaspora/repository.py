"""SQL for overseas supporters, international events and diaspora-tagged proposals (Alembic 0047)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Supporter:
    member_id: uuid.UUID
    country_code: str
    time_zone: str
    contact_topics: list[str]
    skills: list[str]
    consent_version: str
    registered_at: datetime
    updated_at: datetime


def find_supporter(db: Session, member_id: uuid.UUID) -> Supporter | None:
    row = db.execute(
        text("""SELECT member_id, country_code, time_zone, contact_topics, skills, consent_version, registered_at, updated_at
                FROM diaspora.supporter WHERE member_id = :id"""),
        {"id": member_id},
    ).mappings().one_or_none()
    if row is None:
        return None
    return Supporter(**{**row, "contact_topics": list(row["contact_topics"]), "skills": list(row["skills"])})


def is_registered(db: Session, member_id: uuid.UUID) -> bool:
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM diaspora.supporter WHERE member_id = :id)"), {"id": member_id}))


def save_supporter(db: Session, member_id: uuid.UUID, values: dict[str, Any]) -> None:
    db.execute(
        text(
            """
            INSERT INTO diaspora.supporter (member_id, country_code, time_zone, contact_topics, skills, consent_version)
            VALUES (:id, :country_code, :time_zone, :contact_topics, :skills, :consent_version)
            ON CONFLICT (member_id) DO UPDATE SET country_code = EXCLUDED.country_code, time_zone = EXCLUDED.time_zone,
                contact_topics = EXCLUDED.contact_topics, skills = EXCLUDED.skills,
                consent_version = EXCLUDED.consent_version, updated_at = clock_timestamp()
            """
        ),
        {"id": member_id, **values},
    )


def delete_supporter(db: Session, member_id: uuid.UUID) -> bool:
    return db.execute(text("DELETE FROM diaspora.supporter WHERE member_id = :id"), {"id": member_id}).rowcount > 0


def supporters_with_topic(db: Session, topic: str) -> list[uuid.UUID]:
    return list(db.scalars(text("SELECT member_id FROM diaspora.supporter WHERE :topic = ANY(contact_topics)"),
                           {"topic": topic}))


def skill_keys(db: Session) -> set[str]:
    return set(db.scalars(text("SELECT key FROM engagement.volunteer_skill WHERE active")))


# --- International events (FR-DSP-002) --------------------------------------------------------------------


@dataclass(frozen=True)
class EventRow:
    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    starts_at: datetime
    ends_at: datetime
    venue: str
    area_key: str
    area_path: list[str]
    international: bool


_EVENT = """
    SELECT e.id, e.event_ref, e.title_en, e.title_ta, e.description_en, e.description_ta, e.starts_at, e.ends_at,
           e.venue, e.area_key, e.area_path, (x.event_id IS NOT NULL) AS international
    FROM events.event e LEFT JOIN diaspora.international_event x ON x.event_id = e.id
"""


def _event(row: Any) -> EventRow:
    return EventRow(**{**row, "area_path": list(row["area_path"])})


def international_events(db: Session, now: datetime) -> list[EventRow]:
    rows = db.execute(
        text(f"{_EVENT} WHERE x.event_id IS NOT NULL AND e.state = 'published' AND e.ends_at > :now "
             "ORDER BY e.starts_at LIMIT 100"),
        {"now": now},
    ).mappings()
    return [_event(row) for row in rows]


def upcoming_events(db: Session, now: datetime, area_keys: list[str] | None) -> list[EventRow]:
    """For the people who mark events: published, not yet over, in their areas (None: every area)."""
    condition = "" if area_keys is None else " AND e.area_path && CAST(:areas AS text[])"
    params: dict[str, Any] = {"now": now}
    if area_keys is not None:
        params["areas"] = area_keys
    rows = db.execute(
        text(f"{_EVENT} WHERE e.state = 'published' AND e.ends_at > :now{condition} ORDER BY e.starts_at LIMIT 200"),
        params,
    ).mappings()
    return [_event(row) for row in rows]


def find_event(db: Session, event_id: uuid.UUID) -> EventRow | None:
    row = db.execute(text(f"{_EVENT} WHERE e.id = :id"), {"id": event_id}).mappings().one_or_none()
    return _event(row) if row else None


def mark_international(db: Session, event_id: uuid.UUID, by: uuid.UUID) -> bool:
    return db.execute(
        text("""INSERT INTO diaspora.international_event (event_id, marked_by) VALUES (:id, :by)
                ON CONFLICT (event_id) DO NOTHING"""),
        {"id": event_id, "by": by},
    ).rowcount > 0


def unmark_international(db: Session, event_id: uuid.UUID) -> bool:
    return db.execute(text("DELETE FROM diaspora.international_event WHERE event_id = :id"), {"id": event_id}).rowcount > 0


# --- Remote volunteering (FR-DSP-003) ---------------------------------------------------------------------


@dataclass(frozen=True)
class RemoteOpportunity:
    id: uuid.UUID
    opportunity_ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    starts_at: datetime
    ends_at: datetime
    skills: list[str]
    places: int
    confirmed: int


def remote_opportunities(db: Session, now: datetime) -> list[RemoteOpportunity]:
    rows = db.execute(
        text(
            """
            SELECT o.id, o.opportunity_ref, o.title_en, o.title_ta, o.role_en, o.role_ta, o.starts_at, o.ends_at,
                   o.skills, o.places,
                   (SELECT count(*) FROM engagement.volunteer_offer f
                     WHERE f.opportunity_id = o.id AND f.state = 'confirmed')::int AS confirmed
            FROM engagement.volunteer_opportunity o
            WHERE o.remote AND o.state = 'open' AND o.starts_at > :now
            ORDER BY o.starts_at LIMIT 100
            """
        ),
        {"now": now},
    ).mappings()
    return [RemoteOpportunity(**{**row, "skills": list(row["skills"])}) for row in rows]


# --- Development proposals (FR-DSP-004) -------------------------------------------------------------------


def tag_proposal(db: Session, proposal_id: uuid.UUID) -> None:
    """For aggregate analysis only: the tag names the proposal, never the supporter."""
    db.execute(text("INSERT INTO diaspora.proposal_tag (proposal_id) VALUES (:id) ON CONFLICT DO NOTHING"),
               {"id": proposal_id})


# --- Aggregates for staff ---------------------------------------------------------------------------------


def counts_by_country(db: Session) -> list[tuple[str, int]]:
    rows = db.execute(text("SELECT country_code, count(*) FROM diaspora.supporter GROUP BY 1 ORDER BY 2 DESC, 1"))
    return [(row[0], int(row[1])) for row in rows]


def counts_by_topic(db: Session) -> list[tuple[str, int]]:
    rows = db.execute(text("SELECT unnest(contact_topics), count(*) FROM diaspora.supporter GROUP BY 1 ORDER BY 1"))
    return [(row[0], int(row[1])) for row in rows]


def tagged_proposals_by_stage(db: Session) -> list[tuple[str, int]]:
    rows = db.execute(text(
        """SELECT p.stage, count(*) FROM diaspora.proposal_tag t JOIN community.proposal p ON p.id = t.proposal_id
           GROUP BY 1 ORDER BY 1"""))
    return [(row[0], int(row[1])) for row in rows]


def total_supporters(db: Session) -> int:
    return int(db.scalar(text("SELECT count(*) FROM diaspora.supporter")) or 0)
