"""SQL for field visits and the counts kept after retention."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Visit:
    id: uuid.UUID
    visit_ref: str
    client_id: uuid.UUID
    coordinator_id: uuid.UUID
    coordinator_name: str
    gn_code: str
    area_path: list[str]
    visited_at: datetime
    consent: str
    concerns: list[str]
    notes: str | None
    place_text: str | None
    follow_up: str | None
    follow_up_by: uuid.UUID | None
    follow_up_done_at: datetime | None
    case_number: str | None
    version: int
    created_at: datetime
    updated_at: datetime


_SELECT = """
    SELECT v.id, v.visit_ref, v.client_id, v.coordinator_id, m.full_name AS coordinator_name, v.gn_code, v.area_path,
           v.visited_at, v.consent, v.concerns, v.notes, v.place_text, v.follow_up, v.follow_up_by, v.follow_up_done_at,
           v.case_number, v.version, v.created_at, v.updated_at
    FROM field.visit v JOIN npm.member m ON m.id = v.coordinator_id
"""
FIELDS = ("gn_code", "area_path", "visited_at", "consent", "concerns", "notes", "place_text", "follow_up", "case_number")


def _visit(row: Any) -> Visit:
    return Visit(**{**row, "area_path": list(row["area_path"]), "concerns": list(row["concerns"])})


def by_client_id(db: Session, client_id: uuid.UUID, *, lock: bool = False) -> Visit | None:
    row = db.execute(text(f"{_SELECT} WHERE v.client_id = :c{' FOR UPDATE OF v' if lock else ''}"), {"c": client_id}).mappings().one_or_none()
    return _visit(row) if row else None


def find(db: Session, visit_id: uuid.UUID) -> Visit | None:
    row = db.execute(text(f"{_SELECT} WHERE v.id = :id"), {"id": visit_id}).mappings().one_or_none()
    return _visit(row) if row else None


def insert(db: Session, client_id: uuid.UUID, coordinator_id: uuid.UUID, values: dict[str, Any]) -> None:
    db.execute(
        text(f"""INSERT INTO field.visit (client_id, coordinator_id, {', '.join(FIELDS)})
                 VALUES (:client_id, :coordinator_id, {', '.join(':' + f for f in FIELDS)})"""),
        {"client_id": client_id, "coordinator_id": coordinator_id, **{f: values.get(f) for f in FIELDS}},
    )


def update(db: Session, client_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets = ", ".join(f"{f} = :{f}" for f in FIELDS)
    db.execute(
        text(f"UPDATE field.visit SET {sets}, version = version + 1, updated_at = clock_timestamp() WHERE client_id = :client_id"),
        {"client_id": client_id, **{f: values.get(f) for f in FIELDS}},
    )


def mine(db: Session, coordinator_id: uuid.UUID, since: datetime | None) -> list[Visit]:
    condition, params = "v.coordinator_id = :c", {"c": coordinator_id}
    if since is not None:
        condition += " AND v.updated_at > :since"
        params["since"] = since
    return [_visit(row) for row in db.execute(text(f"{_SELECT} WHERE {condition} ORDER BY v.visited_at DESC LIMIT 500"), params).mappings()]


def in_areas(db: Session, areas: list[str] | None, open_follow_ups: bool, limit: int) -> list[Visit]:
    conditions, params = ["TRUE"], {"limit": limit}
    if areas is not None:
        conditions.append("v.area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if open_follow_ups:
        conditions.append("v.follow_up IS NOT NULL AND v.follow_up_done_at IS NULL")
    rows = db.execute(text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY v.visited_at DESC LIMIT :limit"), params).mappings()
    return [_visit(row) for row in rows]


def set_follow_up(db: Session, visit_id: uuid.UUID, by: uuid.UUID | None, done: bool) -> None:
    db.execute(
        text("""UPDATE field.visit SET follow_up_by = COALESCE(:by, follow_up_by),
                       follow_up_done_at = CASE WHEN :done THEN clock_timestamp() ELSE NULL END,
                       version = version + 1, updated_at = clock_timestamp() WHERE id = :id"""),
        {"id": visit_id, "by": by, "done": done},
    )


def purge_older_than(db: Session, cutoff: datetime) -> int:
    """Fold old visits into monthly counts, then delete them (FR-FLD-009)."""
    db.execute(
        text(
            """
            INSERT INTO field.visit_count (gn_code, month, concern, visits)
            SELECT v.gn_code, date_trunc('month', v.visited_at)::date,
                   COALESCE(c.concern, 'consent_declined'), count(*)
            FROM field.visit v LEFT JOIN LATERAL unnest(NULLIF(v.concerns, '{}')) AS c(concern) ON TRUE
            WHERE v.visited_at < :cutoff
            GROUP BY 1, 2, 3
            ON CONFLICT (gn_code, month, concern) DO UPDATE SET visits = field.visit_count.visits + EXCLUDED.visits
            """
        ),
        {"cutoff": cutoff},
    )
    return db.execute(text("DELETE FROM field.visit WHERE visited_at < :cutoff"), {"cutoff": cutoff}).rowcount


def counts(db: Session, areas: list[str] | None) -> list[tuple[str, str, int]]:
    """Visits by GN and concern: kept counts plus live visits, for supervisors (D24)."""
    params: dict[str, Any] = {}
    live_area = kept_area = ""
    if areas is not None:
        live_area = "AND v.area_path && CAST(:areas AS text[])"
        kept_area = """AND EXISTS (SELECT 1 FROM geo.gn_division g JOIN geo.ds_division d ON d.ds_code = g.ds_code
                                    WHERE g.gn_code = k.gn_code AND (('gn:' || g.gn_code) = ANY(:areas)
                                    OR ('ds:' || g.ds_code) = ANY(:areas) OR ('district:' || d.district_code) = ANY(:areas)))"""
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(
            f"""
            SELECT gn_code, concern, sum(n)::int AS n FROM (
                SELECT v.gn_code, COALESCE(c.concern, 'consent_declined') AS concern, count(*) AS n
                FROM field.visit v LEFT JOIN LATERAL unnest(NULLIF(v.concerns, '{{}}')) AS c(concern) ON TRUE
                WHERE TRUE {live_area} GROUP BY 1, 2
                UNION ALL
                SELECT k.gn_code, k.concern, k.visits FROM field.visit_count k WHERE TRUE {kept_area}
            ) all_counts GROUP BY 1, 2 ORDER BY 1, 2
            """
        ),
        params,
    )
    return [(row.gn_code, row.concern, row.n) for row in rows]
