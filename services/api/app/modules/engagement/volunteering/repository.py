"""SQL for volunteer skills, opportunities, offers, bookmarks and coordinator contact."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Skill:
    key: str
    name_en: str
    name_ta: str


def skills(db: Session) -> list[Skill]:
    rows = db.execute(text("SELECT key, name_en, name_ta FROM engagement.volunteer_skill WHERE active ORDER BY position"))
    return [Skill(row.key, row.name_en, row.name_ta) for row in rows]


@dataclass(frozen=True)
class Profile:
    member_id: uuid.UUID
    skills: list[str]
    availability: list[str]
    travel_area: str
    consent_version: str
    consented_at: datetime
    updated_at: datetime


def find_profile(db: Session, member_id: uuid.UUID) -> Profile | None:
    row = db.execute(
        text(
            """SELECT member_id, skills, availability, travel_area, consent_version, consented_at, updated_at
               FROM engagement.volunteer_profile WHERE member_id = :id"""
        ),
        {"id": member_id},
    ).mappings().one_or_none()
    return Profile(**{**row, "skills": list(row["skills"]), "availability": list(row["availability"])}) if row else None


def save_profile(db: Session, member_id: uuid.UUID, skills: list[str], availability: list[str], travel_area: str,
                 consent_version: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO engagement.volunteer_profile (member_id, skills, availability, travel_area, consent_version, consented_at)
            VALUES (:id, :skills, :availability, :travel, :consent, clock_timestamp())
            ON CONFLICT (member_id) DO UPDATE SET skills = EXCLUDED.skills, availability = EXCLUDED.availability,
                travel_area = EXCLUDED.travel_area, consent_version = EXCLUDED.consent_version,
                consented_at = EXCLUDED.consented_at, updated_at = clock_timestamp()
            """
        ),
        {"id": member_id, "skills": skills, "availability": availability, "travel": travel_area, "consent": consent_version},
    )


def delete_profile(db: Session, member_id: uuid.UUID) -> bool:
    return db.execute(text("DELETE FROM engagement.volunteer_profile WHERE member_id = :id"), {"id": member_id}).rowcount > 0


# --- Opportunities -------------------------------------------------------------------------------------

_OPPORTUNITY = """
    SELECT o.id, o.opportunity_ref, o.title_en, o.title_ta, o.role_en, o.role_ta, o.description_en, o.description_ta,
           o.place_en, o.place_ta, o.bring_en, o.bring_ta, o.team_en, o.team_ta, o.starts_at, o.ends_at, o.event_id,
           o.skills, o.places, o.area_key, o.area_path, o.state, o.cancel_reason, o.created_by, o.created_at, o.updated_at,
           (SELECT count(*) FROM engagement.volunteer_offer f WHERE f.opportunity_id = o.id AND f.state = 'confirmed') AS confirmed,
           (SELECT count(*) FROM engagement.volunteer_offer f WHERE f.opportunity_id = o.id AND f.state = 'offered') AS waiting
    FROM engagement.volunteer_opportunity o
"""


@dataclass(frozen=True)
class Opportunity:
    id: uuid.UUID
    opportunity_ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    description_en: str
    description_ta: str
    place_en: str
    place_ta: str
    bring_en: str
    bring_ta: str
    team_en: str
    team_ta: str
    starts_at: datetime
    ends_at: datetime
    event_id: uuid.UUID | None
    skills: list[str]
    places: int
    area_key: str
    area_path: list[str]
    state: str
    cancel_reason: str | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    confirmed: int
    waiting: int


def _opportunity(row: Any) -> Opportunity:
    return Opportunity(**{**row, "skills": list(row["skills"]), "area_path": list(row["area_path"])})


OPPORTUNITY_FIELDS = (
    "title_en", "title_ta", "role_en", "role_ta", "description_en", "description_ta", "place_en", "place_ta",
    "bring_en", "bring_ta", "team_en", "team_ta", "starts_at", "ends_at", "event_id", "skills", "places",
)


def insert_opportunity(db: Session, values: dict[str, Any], *, area_key: str, area_path: list[str], created_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(OPPORTUNITY_FIELDS)
    params = ", ".join(f":{name}" for name in OPPORTUNITY_FIELDS)
    return db.scalar(
        text(
            f"""INSERT INTO engagement.volunteer_opportunity ({columns}, area_key, area_path, created_by)
                VALUES ({params}, :area_key, :area_path, :created_by) RETURNING id"""
        ),
        {**{name: values[name] for name in OPPORTUNITY_FIELDS}, "area_key": area_key, "area_path": area_path,
         "created_by": created_by},
    )


def update_opportunity(db: Session, opportunity_id: uuid.UUID, values: dict[str, Any]) -> None:
    """Only the listed briefing fields, and state or cancel_reason; never the area."""
    allowed = {name: values[name] for name in (*OPPORTUNITY_FIELDS, "state", "cancel_reason") if name in values}
    if not allowed:
        return
    assignments = ", ".join(f"{name} = :{name}" for name in allowed)
    db.execute(
        text(f"UPDATE engagement.volunteer_opportunity SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**allowed, "id": opportunity_id},
    )


def find_opportunity(db: Session, opportunity_id: uuid.UUID, *, lock: bool = False) -> Opportunity | None:
    suffix = " FOR UPDATE OF o" if lock else ""
    row = db.execute(text(f"{_OPPORTUNITY} WHERE o.id = :id{suffix}"), {"id": opportunity_id}).mappings().one_or_none()
    return _opportunity(row) if row else None


def open_opportunities_for(db: Session, area_keys: list[str], now: datetime) -> list[Opportunity]:
    rows = db.execute(
        text(
            f"""{_OPPORTUNITY} WHERE o.state = 'open' AND o.starts_at > :now
                AND (o.area_key = 'platform' OR o.area_key = ANY(:areas)) ORDER BY o.starts_at LIMIT 100"""
        ),
        {"now": now, "areas": area_keys},
    ).mappings()
    return [_opportunity(row) for row in rows]


def managed_opportunities(db: Session, areas: list[str] | None, states: list[str] | None, limit: int) -> list[Opportunity]:
    conditions = ["TRUE"]
    params: dict[str, Any] = {"limit": limit}
    if areas is not None:
        conditions.append("o.area_path && CAST(:areas AS text[])")
        params["areas"] = areas
    if states:
        conditions.append("o.state = ANY(:states)")
        params["states"] = states
    rows = db.execute(
        text(f"{_OPPORTUNITY} WHERE {' AND '.join(conditions)} ORDER BY o.starts_at DESC LIMIT :limit"), params
    ).mappings()
    return [_opportunity(row) for row in rows]


# --- Offers --------------------------------------------------------------------------------------------

_OFFER = """
    SELECT f.id, f.offer_ref, f.opportunity_id, f.member_id, f.state, f.role_en, f.role_ta, f.meeting_point_en,
           f.meeting_point_ta, f.decided_by, f.decided_at, f.decision_reason, f.created_at, f.updated_at,
           COALESCE(dn.display_name, m.full_name) AS volunteer_name, m.member_code
    FROM engagement.volunteer_offer f JOIN npm.member m ON m.id = f.member_id
    LEFT JOIN profile.display_name dn ON dn.member_id = m.id
"""


@dataclass(frozen=True)
class Offer:
    id: uuid.UUID
    offer_ref: str
    opportunity_id: uuid.UUID
    member_id: uuid.UUID
    state: str
    role_en: str | None
    role_ta: str | None
    meeting_point_en: str | None
    meeting_point_ta: str | None
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    decision_reason: str | None
    created_at: datetime
    updated_at: datetime
    volunteer_name: str
    member_code: str


def find_offer(db: Session, offer_id: uuid.UUID, *, lock: bool = False) -> Offer | None:
    suffix = " FOR UPDATE OF f" if lock else ""
    row = db.execute(text(f"{_OFFER} WHERE f.id = :id{suffix}"), {"id": offer_id}).mappings().one_or_none()
    return Offer(**row) if row else None


def offer_for(db: Session, opportunity_id: uuid.UUID, member_id: uuid.UUID) -> Offer | None:
    row = db.execute(
        text(f"{_OFFER} WHERE f.opportunity_id = :opportunity AND f.member_id = :member"),
        {"opportunity": opportunity_id, "member": member_id},
    ).mappings().one_or_none()
    return Offer(**row) if row else None


def member_offers(db: Session, member_id: uuid.UUID) -> list[Offer]:
    rows = db.execute(text(f"{_OFFER} WHERE f.member_id = :member ORDER BY f.created_at DESC"), {"member": member_id}).mappings()
    return [Offer(**row) for row in rows]


def opportunity_offers(db: Session, opportunity_id: uuid.UUID) -> list[Offer]:
    # Ordered by when they offered, never by anything that would rank volunteers.
    rows = db.execute(
        text(f"{_OFFER} WHERE f.opportunity_id = :id ORDER BY f.created_at"), {"id": opportunity_id}
    ).mappings()
    return [Offer(**row) for row in rows]


def upsert_offer(db: Session, opportunity_id: uuid.UUID, member_id: uuid.UUID) -> uuid.UUID:
    """A withdrawn or declined offer may be made again; the history keeps the earlier round."""
    return db.scalar(
        text(
            """
            INSERT INTO engagement.volunteer_offer (opportunity_id, member_id) VALUES (:opportunity, :member)
            ON CONFLICT (opportunity_id, member_id) DO UPDATE SET state = 'offered', decided_by = NULL,
                decided_at = NULL, decision_reason = NULL, role_en = NULL, role_ta = NULL, meeting_point_en = NULL,
                meeting_point_ta = NULL, updated_at = clock_timestamp()
            RETURNING id
            """
        ),
        {"opportunity": opportunity_id, "member": member_id},
    )


def set_offer_state(db: Session, offer_id: uuid.UUID, state: str, **values: Any) -> None:
    columns = {"state": state, **values}
    assignments = ", ".join(f"{name} = :{name}" for name in columns)
    db.execute(
        text(f"UPDATE engagement.volunteer_offer SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**columns, "id": offer_id},
    )


def record_offer_event(db: Session, offer_id: uuid.UUID, from_state: str | None, to_state: str, actor_id: uuid.UUID,
                       reason: str | None = None) -> None:
    db.execute(
        text(
            """INSERT INTO engagement.volunteer_offer_event (offer_id, from_state, to_state, actor_id, reason)
               VALUES (:offer, :from_state, :to_state, :actor, :reason)"""
        ),
        {"offer": offer_id, "from_state": from_state, "to_state": to_state, "actor": actor_id, "reason": reason},
    )


@dataclass(frozen=True)
class OfferEvent:
    from_state: str | None
    to_state: str
    reason: str | None
    occurred_at: datetime


def offer_history(db: Session, offer_id: uuid.UUID) -> list[OfferEvent]:
    rows = db.execute(
        text("""SELECT from_state, to_state, reason, occurred_at FROM engagement.volunteer_offer_event
                WHERE offer_id = :id ORDER BY id"""),
        {"id": offer_id},
    )
    return [OfferEvent(row.from_state, row.to_state, row.reason, row.occurred_at) for row in rows]


# --- Bookmarks and contact -----------------------------------------------------------------------------


def set_bookmark(db: Session, opportunity_id: uuid.UUID, member_id: uuid.UUID, saved: bool) -> None:
    if saved:
        db.execute(
            text("""INSERT INTO engagement.volunteer_bookmark (opportunity_id, member_id) VALUES (:o, :m)
                    ON CONFLICT DO NOTHING"""),
            {"o": opportunity_id, "m": member_id},
        )
    else:
        db.execute(
            text("DELETE FROM engagement.volunteer_bookmark WHERE opportunity_id = :o AND member_id = :m"),
            {"o": opportunity_id, "m": member_id},
        )


def bookmarked(db: Session, member_id: uuid.UUID) -> set[uuid.UUID]:
    return set(db.scalars(text("SELECT opportunity_id FROM engagement.volunteer_bookmark WHERE member_id = :m"), {"m": member_id}))


@dataclass(frozen=True)
class Contact:
    id: uuid.UUID
    offer_id: uuid.UUID
    member_id: uuid.UUID
    kind: str
    body: str
    state: str
    answer: str | None
    answered_at: datetime | None
    created_at: datetime
    volunteer_name: str
    offer_ref: str
    opportunity_id: uuid.UUID
    opportunity_title_en: str
    area_path: list[str]


_CONTACT = """
    SELECT c.id, c.offer_id, c.member_id, c.kind, c.body, c.state, c.answer, c.answered_at, c.created_at,
           COALESCE(dn.display_name, m.full_name) AS volunteer_name, f.offer_ref, o.id AS opportunity_id,
           o.title_en AS opportunity_title_en, o.area_path
    FROM engagement.volunteer_contact c
    JOIN engagement.volunteer_offer f ON f.id = c.offer_id
    JOIN engagement.volunteer_opportunity o ON o.id = f.opportunity_id
    JOIN npm.member m ON m.id = c.member_id
    LEFT JOIN profile.display_name dn ON dn.member_id = m.id
"""


def _contact(row: Any) -> Contact:
    return Contact(**{**row, "area_path": list(row["area_path"])})


def insert_contact(db: Session, offer_id: uuid.UUID, member_id: uuid.UUID, kind: str, body: str) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO engagement.volunteer_contact (offer_id, member_id, kind, body)
                VALUES (:offer, :member, :kind, :body) RETURNING id"""),
        {"offer": offer_id, "member": member_id, "kind": kind, "body": body},
    )


def offer_contacts(db: Session, offer_id: uuid.UUID) -> list[Contact]:
    rows = db.execute(text(f"{_CONTACT} WHERE c.offer_id = :id ORDER BY c.created_at"), {"id": offer_id}).mappings()
    return [_contact(row) for row in rows]


def open_contacts(db: Session, areas: list[str] | None, limit: int = 100) -> list[Contact]:
    condition = "c.state = 'open'"
    params: dict[str, Any] = {"limit": limit}
    if areas is not None:
        condition += " AND o.area_path && CAST(:areas AS text[])"
        params["areas"] = areas
    rows = db.execute(text(f"{_CONTACT} WHERE {condition} ORDER BY c.created_at LIMIT :limit"), params).mappings()
    return [_contact(row) for row in rows]


def find_contact(db: Session, contact_id: uuid.UUID) -> Contact | None:
    row = db.execute(text(f"{_CONTACT} WHERE c.id = :id"), {"id": contact_id}).mappings().one_or_none()
    return _contact(row) if row else None


def answer_contact(db: Session, contact_id: uuid.UUID, answer: str, answered_by: uuid.UUID) -> None:
    db.execute(
        text("""UPDATE engagement.volunteer_contact SET state = 'answered', answer = :answer, answered_by = :by,
                       answered_at = clock_timestamp() WHERE id = :id"""),
        {"id": contact_id, "answer": answer, "by": answered_by},
    )


# --- People --------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class VolunteerCard:
    member_id: uuid.UUID
    name: str
    member_code: str
    skills: list[str]
    availability: list[str]
    travel_area: str
    area_path: list[str]


def consented_volunteers(db: Session, area_keys: list[str] | None, skill: str | None, limit: int) -> list[VolunteerCard]:
    """Volunteers who consented to share their skills (FR-VOL-003), in the given areas, by name."""
    params: dict[str, Any] = {"limit": limit, "skill": skill}
    area_condition = ""
    if area_keys is not None:
        # The member's own area path, built from their recorded GN, DS division and district.
        area_condition = """AND (('gn:' || m.gs_code) = ANY(:areas) OR ('ds:' || m.ds_code) = ANY(:areas)
                                 OR ('district:' || m.district_code) = ANY(:areas)
                                 OR ('province:' || d.province_code) = ANY(:areas))"""
        params["areas"] = area_keys
    rows = db.execute(
        text(
            f"""
            SELECT p.member_id, COALESCE(dn.display_name, m.full_name) AS name, m.member_code, p.skills,
                   p.availability, p.travel_area,
                   ARRAY_REMOVE(ARRAY['platform', 'province:' || d.province_code, 'district:' || m.district_code,
                                      'ds:' || m.ds_code, 'gn:' || m.gs_code], NULL) AS area_path
            FROM engagement.volunteer_profile p
            JOIN npm.member m ON m.id = p.member_id AND m.deleted_at IS NULL
            LEFT JOIN profile.display_name dn ON dn.member_id = m.id
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            WHERE (CAST(:skill AS text) IS NULL OR CAST(:skill AS text) = ANY(p.skills)) {area_condition}
            ORDER BY name LIMIT :limit
            """
        ),
        params,
    ).mappings()
    return [
        VolunteerCard(**{**row, "skills": list(row["skills"]), "availability": list(row["availability"]),
                         "area_path": list(row["area_path"])})
        for row in rows
    ]


def coordinators(db: Session, area_path: list[str]) -> list[uuid.UUID]:
    """Holders of volunteers.manage over the area whose assignment counts now."""
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.state = 'active' AND 'volunteers.manage' = ANY(a.permissions)
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                  AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))
                """
            ),
            {"path": area_path},
        )
    )
