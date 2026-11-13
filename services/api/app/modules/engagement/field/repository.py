"""SQL for field visits and the counts kept after retention.

Every function opens the row-level firewall for its own transaction first: without that, field
rows are invisible to the database session (Alembic 0042, MP-FEA-002 §8).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('field.firewall', 'open', true)"))


@dataclass(frozen=True)
class Visit:
    id: uuid.UUID
    visit_ref: str
    client_id: uuid.UUID
    coordinator_id: uuid.UUID
    coordinator_name: str
    gn_code: str | None
    ds_code: str | None
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
    SELECT v.id, v.visit_ref, v.client_id, v.coordinator_id, m.full_name AS coordinator_name, v.gn_code, v.ds_code,
           v.area_path, v.visited_at, v.consent, v.concerns, v.notes, v.place_text, v.follow_up, v.follow_up_by,
           v.follow_up_done_at, v.case_number, v.version, v.created_at, v.updated_at
    FROM field.visit v JOIN npm.member m ON m.id = v.coordinator_id
"""
FIELDS = ("gn_code", "ds_code", "area_path", "visited_at", "consent", "concerns", "notes", "place_text", "follow_up",
          "case_number")

# The most specific area a visit is counted under: its GN, its DS, or (no place chosen) the
# coordinator's own area, the last key of its area path.
_PLACE = "COALESCE('gn:' || v.gn_code, 'ds:' || v.ds_code, v.area_path[cardinality(v.area_path)])"


def _visit(row: Any) -> Visit:
    return Visit(**{**row, "area_path": list(row["area_path"]), "concerns": list(row["concerns"])})


def by_client_id(db: Session, client_id: uuid.UUID, *, lock: bool = False) -> Visit | None:
    _open(db)
    row = db.execute(text(f"{_SELECT} WHERE v.client_id = :c{' FOR UPDATE OF v' if lock else ''}"), {"c": client_id}).mappings().one_or_none()
    return _visit(row) if row else None


def find(db: Session, visit_id: uuid.UUID) -> Visit | None:
    _open(db)
    row = db.execute(text(f"{_SELECT} WHERE v.id = :id"), {"id": visit_id}).mappings().one_or_none()
    return _visit(row) if row else None


def insert(db: Session, client_id: uuid.UUID, coordinator_id: uuid.UUID, values: dict[str, Any]) -> None:
    _open(db)
    db.execute(
        text(f"""INSERT INTO field.visit (client_id, coordinator_id, {', '.join(FIELDS)})
                 VALUES (:client_id, :coordinator_id, {', '.join(':' + f for f in FIELDS)})"""),
        {"client_id": client_id, "coordinator_id": coordinator_id, **{f: values.get(f) for f in FIELDS}},
    )


def update(db: Session, client_id: uuid.UUID, values: dict[str, Any]) -> None:
    _open(db)
    sets = ", ".join(f"{f} = :{f}" for f in FIELDS)
    db.execute(
        text(f"UPDATE field.visit SET {sets}, version = version + 1, updated_at = clock_timestamp() WHERE client_id = :client_id"),
        {"client_id": client_id, **{f: values.get(f) for f in FIELDS}},
    )


def mine(db: Session, coordinator_id: uuid.UUID, since: datetime | None) -> list[Visit]:
    _open(db)
    condition, params = "v.coordinator_id = :c", {"c": coordinator_id}
    if since is not None:
        condition += " AND v.updated_at > :since"
        params["since"] = since
    return [_visit(row) for row in db.execute(text(f"{_SELECT} WHERE {condition} ORDER BY v.visited_at DESC LIMIT 500"), params).mappings()]


def in_areas(db: Session, areas: list[str] | None, open_follow_ups: bool, limit: int) -> list[Visit]:
    _open(db)
    conditions, params = ["TRUE"], {"limit": limit}
    if areas is not None:
        conditions.append("v.area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if open_follow_ups:
        conditions.append("v.follow_up IS NOT NULL AND v.follow_up_done_at IS NULL")
    rows = db.execute(text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY v.visited_at DESC LIMIT :limit"), params).mappings()
    return [_visit(row) for row in rows]


def set_follow_up(db: Session, visit_id: uuid.UUID, by: uuid.UUID | None, done: bool) -> None:
    _open(db)
    db.execute(
        text("""UPDATE field.visit SET follow_up_by = COALESCE(:by, follow_up_by),
                       follow_up_done_at = CASE WHEN :done THEN clock_timestamp() ELSE NULL END,
                       version = version + 1, updated_at = clock_timestamp() WHERE id = :id"""),
        {"id": visit_id, "by": by, "done": done},
    )


def purge_older_than(db: Session, now: datetime, months: int) -> int:
    """Fold visits older than the retention period (calendar months) into monthly counts, then
    delete them (FR-FLD-009).

    A kept count is keyed by the visit's place ('gn:...', 'ds:...', or the coordinator's area for a
    visit with no place) and keeps the visit's area path for the supervisors' area check.
    """
    _open(db)
    params = {"now": now, "months": months}
    cutoff = "CAST(:now AS timestamptz) - make_interval(months => :months)"
    db.execute(
        text(
            f"""
            INSERT INTO field.visit_count (place_key, area_path, month, concern, visits)
            SELECT {_PLACE}, min(v.area_path), date_trunc('month', v.visited_at)::date,
                   COALESCE(c.concern, 'consent_declined'), count(*)
            FROM field.visit v LEFT JOIN LATERAL unnest(NULLIF(v.concerns, '{{}}')) AS c(concern) ON TRUE
            WHERE v.visited_at < {cutoff}
            GROUP BY 1, 3, 4
            ON CONFLICT (place_key, month, concern) DO UPDATE SET visits = field.visit_count.visits + EXCLUDED.visits
            """
        ),
        params,
    )
    return db.execute(text(f"DELETE FROM field.visit WHERE visited_at < {cutoff}"), params).rowcount


def counts(db: Session, areas: list[str] | None) -> list[tuple[str, str, int]]:
    """Visits by place and concern: kept counts plus live visits, for supervisors (D24).

    The place is an area key: 'gn:...', 'ds:...', or the coordinator's area for a visit with no place.
    """
    _open(db)
    params: dict[str, Any] = {}
    live_area = kept_area = ""
    if areas is not None:
        live_area = "AND v.area_path && CAST(:areas AS text[])"
        kept_area = "WHERE k.area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(
            f"""
            SELECT place, concern, sum(n)::int AS n FROM (
                SELECT {_PLACE} AS place, COALESCE(c.concern, 'consent_declined') AS concern, count(*) AS n
                FROM field.visit v LEFT JOIN LATERAL unnest(NULLIF(v.concerns, '{{}}')) AS c(concern) ON TRUE
                WHERE TRUE {live_area} GROUP BY 1, 2
                UNION ALL
                SELECT k.place_key, k.concern, k.visits FROM field.visit_count k {kept_area}
            ) all_counts GROUP BY 1, 2 ORDER BY 1, 2
            """
        ),
        params,
    )
    return [(row.place, row.concern, row.n) for row in rows]
