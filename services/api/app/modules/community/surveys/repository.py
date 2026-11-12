"""SQL for surveys, their questions, participation and responses."""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Survey:
    id: uuid.UUID
    survey_ref: str
    title_en: str
    title_ta: str
    audience_en: str
    audience_ta: str
    privacy_en: str
    privacy_ta: str
    next_steps_en: str
    next_steps_ta: str
    anonymous: bool
    allow_edits: bool
    area_key: str
    area_path: list[str]
    state: str
    closes_at: datetime | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    responses: int


_SURVEY = """
    SELECT s.id, s.survey_ref, s.title_en, s.title_ta, s.audience_en, s.audience_ta, s.privacy_en, s.privacy_ta,
           s.next_steps_en, s.next_steps_ta, s.anonymous, s.allow_edits, s.area_key, s.area_path, s.state, s.closes_at,
           s.created_by, s.created_at, s.updated_at,
           (SELECT count(*) FROM community.survey_participation p WHERE p.survey_id = s.id) AS responses
    FROM community.survey s
"""

SURVEY_FIELDS = (
    "title_en", "title_ta", "audience_en", "audience_ta", "privacy_en", "privacy_ta", "next_steps_en", "next_steps_ta",
    "anonymous", "allow_edits", "closes_at",
)


def _survey(row: Any) -> Survey:
    return Survey(**{**row, "area_path": list(row["area_path"])})


def find(db: Session, survey_id: uuid.UUID, *, lock: bool = False) -> Survey | None:
    suffix = " FOR UPDATE OF s" if lock else ""
    row = db.execute(text(f"{_SURVEY} WHERE s.id = :id{suffix}"), {"id": survey_id}).mappings().one_or_none()
    return _survey(row) if row else None


def open_for(db: Session, area_keys: list[str]) -> list[Survey]:
    rows = db.execute(
        text(
            f"""{_SURVEY} WHERE s.state = 'open' AND (s.closes_at IS NULL OR s.closes_at > now())
                AND (s.area_key = 'platform' OR s.area_key = ANY(:areas)) ORDER BY s.created_at DESC LIMIT 50"""
        ),
        {"areas": area_keys},
    ).mappings()
    return [_survey(row) for row in rows]


def managed(db: Session, areas: list[str] | None, limit: int) -> list[Survey]:
    where, params = "TRUE", {"limit": limit}
    if areas is not None:
        where, params = "s.area_path && CAST(:areas AS text[])", {"limit": limit, "areas": areas}
    rows = db.execute(text(f"{_SURVEY} WHERE {where} ORDER BY s.created_at DESC LIMIT :limit"), params).mappings()
    return [_survey(row) for row in rows]


def insert(db: Session, values: dict[str, Any], area_key: str, area_path: list[str], created_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(SURVEY_FIELDS)
    params = ", ".join(f":{name}" for name in SURVEY_FIELDS)
    return db.scalar(
        text(
            f"""INSERT INTO community.survey ({columns}, area_key, area_path, created_by)
                VALUES ({params}, :area_key, :area_path, :created_by) RETURNING id"""
        ),
        {**{name: values[name] for name in SURVEY_FIELDS}, "area_key": area_key, "area_path": area_path,
         "created_by": created_by},
    )


def update(db: Session, survey_id: uuid.UUID, values: dict[str, Any]) -> None:
    allowed = {name: values[name] for name in (*SURVEY_FIELDS, "state") if name in values}
    assignments = ", ".join(f"{name} = :{name}" for name in allowed)
    db.execute(
        text(f"UPDATE community.survey SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**allowed, "id": survey_id},
    )


def questions(db: Session, survey_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """SELECT id, position, kind, prompt_en, prompt_ta, options, sensitive, required
               FROM community.survey_question WHERE survey_id = :id ORDER BY position"""
        ),
        {"id": survey_id},
    ).mappings()
    return [dict(row) for row in rows]


def replace_questions(db: Session, survey_id: uuid.UUID, items: list[dict[str, Any]]) -> None:
    db.execute(text("DELETE FROM community.survey_question WHERE survey_id = :id"), {"id": survey_id})
    for position, item in enumerate(items, start=1):
        db.execute(
            text(
                """INSERT INTO community.survey_question (survey_id, position, kind, prompt_en, prompt_ta, options,
                                                          sensitive, required)
                   VALUES (:survey, :position, :kind, :prompt_en, :prompt_ta, CAST(:options AS jsonb), :sensitive, :required)"""
            ),
            {"survey": survey_id, "position": position, "kind": item["kind"], "prompt_en": item["prompt_en"],
             "prompt_ta": item["prompt_ta"], "options": json.dumps(item["options"]), "sensitive": item["sensitive"],
             "required": item["required"]},
        )


@dataclass(frozen=True)
class Participation:
    receipt_ref: str
    submitted_at: datetime
    updated_at: datetime


def participation(db: Session, survey_id: uuid.UUID, member_id: uuid.UUID) -> Participation | None:
    row = db.execute(
        text("""SELECT receipt_ref, submitted_at, updated_at FROM community.survey_participation
                WHERE survey_id = :s AND member_id = :m"""),
        {"s": survey_id, "m": member_id},
    ).one_or_none()
    return Participation(row.receipt_ref, row.submitted_at, row.updated_at) if row else None


def record_response(db: Session, survey_id: uuid.UUID, member_id: uuid.UUID, answers: dict[str, Any], anonymous: bool) -> None:
    """Participation names the member; an anonymous survey's answers do not (FR-SRV-003)."""
    db.execute(
        text("INSERT INTO community.survey_participation (survey_id, member_id) VALUES (:s, :m)"),
        {"s": survey_id, "m": member_id},
    )
    db.execute(
        text("INSERT INTO community.survey_response (survey_id, member_id, answers) VALUES (:s, :m, CAST(:a AS jsonb))"),
        {"s": survey_id, "m": None if anonymous else member_id, "a": json.dumps(answers)},
    )


def replace_response(db: Session, survey_id: uuid.UUID, member_id: uuid.UUID, answers: dict[str, Any]) -> None:
    db.execute(
        text("UPDATE community.survey_response SET answers = CAST(:a AS jsonb) WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": member_id, "a": json.dumps(answers)},
    )
    db.execute(
        text("UPDATE community.survey_participation SET updated_at = clock_timestamp() WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": member_id},
    )


def own_answers(db: Session, survey_id: uuid.UUID, member_id: uuid.UUID) -> dict[str, Any] | None:
    return db.scalar(
        text("SELECT answers FROM community.survey_response WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": member_id},
    )


def all_answers(db: Session, survey_id: uuid.UUID) -> list[dict[str, Any]]:
    return list(db.scalars(text("SELECT answers FROM community.survey_response WHERE survey_id = :s"), {"s": survey_id}))
