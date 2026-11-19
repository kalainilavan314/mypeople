"""SQL for relayed alerts, their revisions, shelters and relief volunteers (Alembic 0048)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Alert:
    id: uuid.UUID
    alert_ref: str
    source_key: str
    source_url: str
    source_issued_at: datetime
    source_ends_at: datetime
    hazard: str
    severity: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    target_keys: list[str]
    scope_keys: list[str]
    state: str
    withdrawn_reason: str | None
    relayed_at: datetime
    refreshed_at: datetime
    recipients: int


_ALERT = """
    SELECT id, alert_ref, source_key, source_url, source_issued_at, source_ends_at, hazard, severity, title_en, title_ta,
           body_en, body_ta, target_keys, scope_keys, state, withdrawn_reason, relayed_at, refreshed_at, recipients
    FROM disaster.alert
"""
ALERT_TEXT = ("source_url", "source_issued_at", "source_ends_at", "severity", "title_en", "title_ta", "body_en", "body_ta")


def _alert(row: Any) -> Alert:
    return Alert(**{**row, "target_keys": list(row["target_keys"]), "scope_keys": list(row["scope_keys"])})


def find(db: Session, alert_id: uuid.UUID, *, lock: bool = False) -> Alert | None:
    row = db.execute(text(f"{_ALERT} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": alert_id}).mappings().one_or_none()
    return _alert(row) if row else None


def for_areas(db: Session, area_keys: list[str], *, current: bool, now: datetime, since: datetime | None = None,
              limit: int = 50) -> list[Alert]:
    """Alerts targeting any of these areas (a member's GN, DS division and district): the current ones,
    most severe and newest first, or the history since a date, newest first."""
    if current:
        condition = "state = 'active' AND source_ends_at > :now"
        order = "array_position(ARRAY['warning', 'watch', 'advisory'], severity), source_issued_at DESC"
    else:
        condition = "(state = 'withdrawn' OR source_ends_at <= :now) AND source_issued_at >= :since"
        order = "source_issued_at DESC"
    rows = db.execute(
        text(f"{_ALERT} WHERE target_keys && CAST(:keys AS text[]) AND {condition} ORDER BY {order} LIMIT :limit"),
        {"keys": area_keys or ["none"], "now": now, "since": since, "limit": limit},
    ).mappings()
    return [_alert(row) for row in rows]


def managed(db: Session, areas: list[str] | None, *, current: bool, now: datetime, limit: int = 200) -> list[Alert]:
    """Staff: alerts whose targets lie in their areas (None: every alert)."""
    conditions = ["state = 'active' AND source_ends_at > :now" if current else "(state = 'withdrawn' OR source_ends_at <= :now)"]
    params: dict[str, Any] = {"now": now, "limit": limit}
    if areas is not None:
        conditions.append("scope_keys && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    order = "refreshed_at" if current else "source_ends_at DESC"
    rows = db.execute(text(f"{_ALERT} WHERE {' AND '.join(conditions)} ORDER BY {order} LIMIT :limit"), params).mappings()
    return [_alert(row) for row in rows]


def insert(db: Session, values: dict[str, Any], target_keys: list[str], scope_keys: list[str], by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO disaster.alert (source_key, source_url, source_issued_at, source_ends_at, hazard, severity, title_en,
                                           title_ta, body_en, body_ta, target_keys, scope_keys, relayed_by, refreshed_by)
               VALUES (:source_key, :source_url, :source_issued_at, :source_ends_at, :hazard, :severity, :title_en, :title_ta,
                       :body_en, :body_ta, :targets, :scope, :by, :by)
               RETURNING id"""
        ),
        {**values, "targets": target_keys, "scope": scope_keys, "by": by},
    )


def update(db: Session, alert_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE disaster.alert SET {assignments} WHERE id = :id"), {**values, "id": alert_id})


def add_revision(db: Session, alert: Alert, kind: str, by: uuid.UUID, note: str | None) -> None:
    db.execute(
        text(
            """INSERT INTO disaster.alert_revision (alert_id, kind, source_url, source_issued_at, source_ends_at, severity,
                                                    title_en, title_ta, body_en, body_ta, note, changed_by)
               VALUES (:id, :kind, :source_url, :source_issued_at, :source_ends_at, :severity, :title_en, :title_ta,
                       :body_en, :body_ta, :note, :by)"""
        ),
        {"id": alert.id, "kind": kind, "note": note, "by": by, **{name: getattr(alert, name) for name in ALERT_TEXT}},
    )


@dataclass(frozen=True)
class Revision:
    kind: str
    source_url: str
    source_issued_at: datetime
    source_ends_at: datetime
    severity: str
    note: str | None
    changed_at: datetime


def revisions(db: Session, alert_id: uuid.UUID) -> list[Revision]:
    rows = db.execute(
        text("""SELECT kind, source_url, source_issued_at, source_ends_at, severity, note, changed_at
                FROM disaster.alert_revision WHERE alert_id = :id ORDER BY id"""),
        {"id": alert_id},
    ).mappings()
    return [Revision(**row) for row in rows]


def newly_stale(db: Session, stale_before: datetime, now: datetime) -> list[Alert]:
    """Current alerts nobody has checked since `stale_before`, not yet raised with the relayers."""
    rows = db.execute(
        text(f"""{_ALERT} WHERE state = 'active' AND source_ends_at > :now AND refreshed_at <= :before
                 AND stale_alerted_at IS NULL FOR UPDATE SKIP LOCKED"""),
        {"now": now, "before": stale_before},
    ).mappings()
    return [_alert(row) for row in rows]


def purge_before(db: Session, ended_before: datetime) -> int:
    """ENT-54: alerts are kept 2 years after their end time, with their revisions. Relief records keep only
    the alert's id, which then opens nothing."""
    return db.execute(text("DELETE FROM disaster.alert WHERE source_ends_at < :before"), {"before": ended_before}).rowcount


# --- Shelters (FR-DIS-006) ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class Shelter:
    id: uuid.UUID
    name_en: str
    name_ta: str
    place_en: str
    place_ta: str
    area_key: str
    area_path: list[str]
    status: str
    capacity: int | None
    source_key: str
    source_url: str | None
    source_reported_at: datetime
    updated_at: datetime


_SHELTER = """SELECT id, name_en, name_ta, place_en, place_ta, area_key, area_path, status, capacity, source_key, source_url,
                     source_reported_at, updated_at FROM disaster.shelter"""
SHELTER_FIELDS = ("name_en", "name_ta", "place_en", "place_ta", "status", "capacity", "source_key", "source_url",
                  "source_reported_at")


def _shelter(row: Any) -> Shelter:
    return Shelter(**{**row, "area_path": list(row["area_path"])})


def shelters_near(db: Session, area_keys: list[str], limit: int = 30) -> list[Shelter]:
    """Shelters in the member's GN or DS division (not the whole district: too far to be useful), open first."""
    rows = db.execute(
        text(f"""{_SHELTER} WHERE area_path && CAST(:keys AS text[])
                 ORDER BY array_position(ARRAY['open', 'full', 'closed'], status), source_reported_at DESC LIMIT :limit"""),
        {"keys": area_keys or ["none"], "limit": limit},
    ).mappings()
    return [_shelter(row) for row in rows]


def managed_shelters(db: Session, areas: list[str] | None, limit: int = 300) -> list[Shelter]:
    condition, params = "TRUE", {"limit": limit}
    if areas is not None:
        condition = "area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(text(f"{_SHELTER} WHERE {condition} ORDER BY updated_at DESC LIMIT :limit"), params).mappings()
    return [_shelter(row) for row in rows]


def find_shelter(db: Session, shelter_id: uuid.UUID, *, lock: bool = False) -> Shelter | None:
    row = db.execute(text(f"{_SHELTER} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": shelter_id}).mappings().one_or_none()
    return _shelter(row) if row else None


def insert_shelter(db: Session, values: dict[str, Any], area_key: str, area_path: list[str], by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(SHELTER_FIELDS)
    params = ", ".join(f":{name}" for name in SHELTER_FIELDS)
    return db.scalar(
        text(f"""INSERT INTO disaster.shelter ({columns}, area_key, area_path, recorded_by, updated_by)
                 VALUES ({params}, :area_key, :area_path, :by, :by) RETURNING id"""),
        {**{name: values.get(name) for name in SHELTER_FIELDS}, "area_key": area_key, "area_path": area_path, "by": by},
    )


def update_shelter(db: Session, shelter_id: uuid.UUID, values: dict[str, Any], by: uuid.UUID) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in SHELTER_FIELDS)
    db.execute(
        text(f"""UPDATE disaster.shelter SET {assignments}, updated_by = :by, updated_at = clock_timestamp()
                 WHERE id = :id"""),
        {**{name: values.get(name) for name in SHELTER_FIELDS}, "by": by, "id": shelter_id},
    )


# --- Relief volunteers (FR-DIS-004) -------------------------------------------------------------------------


@dataclass(frozen=True)
class Volunteer:
    member_id: uuid.UUID
    tasks: list[str]
    available_until: date
    area_key: str
    updated_at: datetime


def find_volunteer(db: Session, member_id: uuid.UUID) -> Volunteer | None:
    row = db.execute(
        text("""SELECT member_id, tasks, available_until, area_key, updated_at FROM disaster.relief_volunteer
                WHERE member_id = :id"""),
        {"id": member_id},
    ).mappings().one_or_none()
    return Volunteer(**{**row, "tasks": list(row["tasks"])}) if row else None


def save_volunteer(db: Session, member_id: uuid.UUID, tasks: list[str], available_until: date, area_key: str,
                   area_path: list[str], consent_version: str) -> None:
    db.execute(
        text(
            """INSERT INTO disaster.relief_volunteer (member_id, tasks, available_until, area_key, area_path, consent_version,
                                                      consented_at)
               VALUES (:id, :tasks, :until, :area_key, :area_path, :consent, clock_timestamp())
               ON CONFLICT (member_id) DO UPDATE SET tasks = EXCLUDED.tasks, available_until = EXCLUDED.available_until,
                   area_key = EXCLUDED.area_key, area_path = EXCLUDED.area_path, consent_version = EXCLUDED.consent_version,
                   consented_at = EXCLUDED.consented_at, updated_at = clock_timestamp()"""
        ),
        {"id": member_id, "tasks": tasks, "until": available_until, "area_key": area_key, "area_path": area_path,
         "consent": consent_version},
    )


def remove_volunteer(db: Session, member_id: uuid.UUID) -> bool:
    return db.execute(text("DELETE FROM disaster.relief_volunteer WHERE member_id = :id"), {"id": member_id}).rowcount > 0


@dataclass(frozen=True)
class ListedVolunteer:
    full_name: str
    area_key: str
    tasks: list[str]
    available_until: date
    updated_at: datetime


def available_volunteers(db: Session, areas: list[str] | None, today: date, limit: int = 300) -> list[ListedVolunteer]:
    """Coordinators see a name, the area, the tasks offered and until when; never a phone number. Ordered by
    name, never by how much someone has done (BR-043)."""
    condition, params = "v.available_until >= :today", {"today": today, "limit": limit}
    if areas is not None:
        condition += " AND v.area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"""SELECT m.full_name, v.area_key, v.tasks, v.available_until, v.updated_at
                 FROM disaster.relief_volunteer v JOIN npm.member m ON m.id = v.member_id AND m.deleted_at IS NULL
                 WHERE {condition} ORDER BY m.full_name LIMIT :limit"""),
        params,
    ).mappings()
    return [ListedVolunteer(**{**row, "tasks": list(row["tasks"])}) for row in rows]


def holders(db: Session, permission: str, area_path: list[str]) -> list[uuid.UUID]:
    """Staff holding a permission over an area (or the platform), whose role counts now (BR-097)."""
    return list(
        db.scalars(
            text(
                """SELECT DISTINCT a.member_id FROM access.staff_assignment a
                   JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                   WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                     AND (a.review_due_at IS NULL OR a.review_due_at > now())
                     AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))"""
            ),
            {"permission": permission, "path": area_path},
        )
    )
