"""SQL for scorecards: the case facts behind the figures, versions and corrections."""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.community.scorecards.rules import CaseFacts


def case_facts(db: Session, start: datetime, end: datetime, now: datetime) -> list[CaseFacts]:
    """Cases reported in the period that were accepted (taken past the GN stage), for FR-ACS-001."""
    rows = db.execute(
        text(
            """
            SELECT i.area_path,
                   i.stage = 'resolved' AND i.closed_at < :end AS closed,
                   NOT EXISTS (SELECT 1 FROM community.case_action b WHERE b.issue_id = i.id AND b.kind = 'breach_alerted') AS on_time,
                   i.stage IN ('ds', 'district', 'regional', 'executive', 'implementation') AND i.stage_due_at < :now AS delayed,
                   CASE WHEN i.stage = 'resolved' THEN extract(epoch FROM i.closed_at - i.created_at) / 86400 END AS days,
                   (SELECT r.resolved FROM community.issue_closure_response r
                    WHERE r.issue_id = i.id AND r.member_id = i.reporter_id ORDER BY r.created_at DESC LIMIT 1) AS confirmed,
                   EXISTS (SELECT 1 FROM community.case_action o WHERE o.issue_id = i.id AND o.kind = 'reopened') AS reopened
            FROM community.issue i
            WHERE i.created_at >= :start AND i.created_at < :end AND i.stage <> 'linked'
              AND EXISTS (SELECT 1 FROM community.case_action a WHERE a.issue_id = i.id
                          AND a.to_stage IN ('ds', 'district', 'regional', 'executive', 'implementation', 'resolved'))
            """
        ),
        {"start": start, "end": end, "now": now},
    )
    return [
        CaseFacts(
            area_keys=list(row.area_path), closed=bool(row.closed), on_time=bool(row.on_time), delayed=bool(row.delayed),
            processing_days=float(row.days) if row.days is not None else None, confirmed=row.confirmed,
            reopened=bool(row.reopened),
        )
        for row in rows
    ]


@dataclass(frozen=True)
class Scorecard:
    id: uuid.UUID
    period: str
    version: int
    state: str
    sla_version: str
    figures: dict[str, Any]
    notes: dict[str, Any]
    created_at: datetime
    shared_at: datetime | None
    publishable_at: datetime | None
    published_at: datetime | None
    correction_reason: str | None


_SELECT = """SELECT id, period, version, state, sla_version, figures, notes, created_at, shared_at, publishable_at,
                    published_at, correction_reason FROM community.scorecard"""


def find(db: Session, scorecard_id: uuid.UUID, *, lock: bool = False) -> Scorecard | None:
    row = db.execute(text(f"{_SELECT} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": scorecard_id}).mappings().one_or_none()
    return Scorecard(**row) if row else None


def all_versions(db: Session, limit: int = 100) -> list[Scorecard]:
    rows = db.execute(text(f"{_SELECT} ORDER BY period DESC, version DESC LIMIT :limit"), {"limit": limit}).mappings()
    return [Scorecard(**row) for row in rows]


def latest_published(db: Session, periods: list[str]) -> list[Scorecard]:
    rows = db.execute(
        text(f"""{_SELECT} WHERE state = 'published' AND period = ANY(:periods) ORDER BY period DESC"""),
        {"periods": periods},
    ).mappings()
    return [Scorecard(**row) for row in rows]


def latest_published_period(db: Session) -> str | None:
    return db.scalar(text("SELECT max(period) FROM community.scorecard WHERE state = 'published'"))


def supersede_other_versions(db: Session, period: str, keep_id: uuid.UUID) -> None:
    """Only one version of a quarter is ever published; the others stay readable as superseded."""
    db.execute(
        text("""UPDATE community.scorecard SET state = 'superseded'
                WHERE period = :p AND state = 'published' AND id <> :keep"""),
        {"p": period, "keep": keep_id},
    )


def holders(db: Session, permissions: list[str], area_keys: list[str]) -> list[uuid.UUID]:
    """Active staff holding any of the permissions over one of the areas, or over the whole platform."""
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.state = 'active' AND a.permissions && CAST(:permissions AS text[])
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                  AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:areas))
                """
            ),
            {"permissions": permissions, "areas": area_keys},
        )
    )


def has_open_draft(db: Session, period: str) -> bool:
    return bool(db.scalar(
        text("SELECT EXISTS (SELECT 1 FROM community.scorecard WHERE period = :p AND state IN ('draft', 'shared'))"),
        {"p": period},
    ))


def next_version(db: Session, period: str) -> int:
    return (db.scalar(text("SELECT max(version) FROM community.scorecard WHERE period = :p"), {"p": period}) or 0) + 1


def insert(db: Session, period: str, version: int, state: str, sla_version: str, figures: dict[str, Any],
           notes: dict[str, Any], created_by: uuid.UUID, correction_reason: str | None = None) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO community.scorecard (period, version, state, sla_version, figures, notes, created_by,
                                                correction_reason, published_at, published_by)
               VALUES (:p, :v, :state, :sla, CAST(:figures AS jsonb), CAST(:notes AS jsonb), :by, :reason,
                       CASE WHEN :state = 'published' THEN clock_timestamp() END,
                       CASE WHEN :state = 'published' THEN CAST(:by AS uuid) END)
               RETURNING id"""
        ),
        {"p": period, "v": version, "state": state, "sla": sla_version, "figures": json.dumps(figures),
         "notes": json.dumps(notes), "by": created_by, "reason": correction_reason},
    )


def update(db: Session, scorecard_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets, params = [], {"id": scorecard_id}
    for name, value in values.items():
        if name in ("figures", "notes"):
            sets.append(f"{name} = CAST(:{name} AS jsonb)")
            params[name] = json.dumps(value)
        else:
            sets.append(f"{name} = :{name}")
            params[name] = value
    db.execute(text(f"UPDATE community.scorecard SET {', '.join(sets)} WHERE id = :id"), params)


@dataclass(frozen=True)
class Correction:
    id: uuid.UUID
    scorecard_id: uuid.UUID
    area_key: str
    metric: str
    reason: str
    state: str
    decision_note: str | None
    created_at: datetime
    decided_at: datetime | None


_CORRECTION = """SELECT id, scorecard_id, area_key, metric, reason, state, decision_note, created_at, decided_at
                 FROM community.scorecard_correction"""


def corrections(db: Session, scorecard_id: uuid.UUID) -> list[Correction]:
    rows = db.execute(text(f"{_CORRECTION} WHERE scorecard_id = :id ORDER BY created_at"), {"id": scorecard_id}).mappings()
    return [Correction(**row) for row in rows]


def find_correction(db: Session, correction_id: uuid.UUID) -> Correction | None:
    row = db.execute(text(f"{_CORRECTION} WHERE id = :id"), {"id": correction_id}).mappings().one_or_none()
    return Correction(**row) if row else None


def insert_correction(db: Session, scorecard_id: uuid.UUID, area_key: str, metric: str, reason: str,
                      requested_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO community.scorecard_correction (scorecard_id, area_key, metric, reason, requested_by)
                VALUES (:s, :a, :m, :r, :by) RETURNING id"""),
        {"s": scorecard_id, "a": area_key, "m": metric, "r": reason, "by": requested_by},
    )


def decide_correction(db: Session, correction_id: uuid.UUID, accepted: bool, decided_by: uuid.UUID, note: str) -> None:
    db.execute(
        text("""UPDATE community.scorecard_correction SET state = :state, decided_by = :by, decision_note = :note,
                       decided_at = clock_timestamp() WHERE id = :id"""),
        {"id": correction_id, "state": "accepted" if accepted else "rejected", "by": decided_by, "note": note},
    )
