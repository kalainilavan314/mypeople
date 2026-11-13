"""SQL for town hall sessions, questions, votes and reminders."""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class TownHall:
    id: uuid.UUID
    session_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    language: str
    speakers_en: str
    speakers_ta: str
    area_key: str
    area_path: list[str]
    starts_at: datetime
    ends_at: datetime
    state: str
    stream_url: str | None
    audio_url: str | None
    captions_url: str | None
    recording_url: str | None
    transcript_en: str | None
    transcript_ta: str | None
    legal_review_ref: str | None
    outcomes: list[dict[str, Any]]
    cancel_reason: str | None
    created_at: datetime


FIELDS = (
    "title_en", "title_ta", "description_en", "description_ta", "language", "speakers_en", "speakers_ta", "starts_at",
    "ends_at", "stream_url", "audio_url", "captions_url", "legal_review_ref",
)
_SELECT = f"""SELECT id, session_ref, {', '.join(FIELDS)}, area_key, area_path, state, recording_url, transcript_en,
                     transcript_ta, outcomes, cancel_reason, created_at FROM community.townhall"""


def _townhall(row: Any) -> TownHall:
    return TownHall(**{**row, "area_path": list(row["area_path"]), "outcomes": list(row["outcomes"])})


def find(db: Session, townhall_id: uuid.UUID, *, lock: bool = False) -> TownHall | None:
    row = db.execute(text(f"{_SELECT} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": townhall_id}).mappings().one_or_none()
    return _townhall(row) if row else None


def for_member(db: Session, area_keys: list[str]) -> list[TownHall]:
    rows = db.execute(
        text(f"""{_SELECT} WHERE state IN ('scheduled', 'live', 'ended')
                 AND (area_key = 'platform' OR area_key = ANY(:areas)) ORDER BY starts_at DESC LIMIT 100"""),
        {"areas": area_keys},
    ).mappings()
    return [_townhall(row) for row in rows]


def managed(db: Session, areas: list[str] | None) -> list[TownHall]:
    where, params = "TRUE", {}
    if areas is not None:
        where, params = "area_path && CAST(:areas AS text[])", {"areas": areas or ["none"]}
    return [_townhall(row) for row in db.execute(text(f"{_SELECT} WHERE {where} ORDER BY starts_at DESC LIMIT 200"), params).mappings()]


def insert(db: Session, values: dict[str, Any], area_key: str, area_path: list[str], created_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(f"""INSERT INTO community.townhall ({', '.join(FIELDS)}, area_key, area_path, created_by)
                 VALUES ({', '.join(':' + f for f in FIELDS)}, :area_key, :area_path, :by) RETURNING id"""),
        {**{f: values.get(f) for f in FIELDS}, "area_key": area_key, "area_path": area_path, "by": created_by},
    )


def update(db: Session, townhall_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets, params = [], {"id": townhall_id}
    for name, value in values.items():
        if name == "outcomes":
            sets.append("outcomes = CAST(:outcomes AS jsonb)")
            params[name] = json.dumps(value)
        else:
            sets.append(f"{name} = :{name}")
            params[name] = value
    db.execute(text(f"UPDATE community.townhall SET {', '.join(sets)}, updated_at = clock_timestamp() WHERE id = :id"), params)


@dataclass(frozen=True)
class Question:
    id: uuid.UUID
    townhall_id: uuid.UUID
    member_id: uuid.UUID
    body: str
    state: str
    merged_into_id: uuid.UUID | None
    moderation_reason: str | None
    answer_mode: str | None
    answered_at_second: int | None
    answer_en: str | None
    answer_ta: str | None
    answered_at: datetime | None
    created_at: datetime
    votes: int
    voted: bool


_QUESTION = """
    SELECT q.id, q.townhall_id, q.member_id, q.body, q.state, q.merged_into_id, q.moderation_reason, q.answer_mode,
           q.answered_at_second, q.answer_en, q.answer_ta, q.answered_at, q.created_at,
           (SELECT count(*) FROM community.townhall_vote v WHERE v.question_id = q.id) AS votes,
           EXISTS (SELECT 1 FROM community.townhall_vote v WHERE v.question_id = q.id AND v.member_id = :viewer) AS voted
    FROM community.townhall_question q
"""


def questions(db: Session, townhall_id: uuid.UUID, viewer: uuid.UUID, *, states: tuple[str, ...] | None = None,
              query: str | None = None) -> list[Question]:
    conditions, params = ["q.townhall_id = :t"], {"t": townhall_id, "viewer": viewer}
    if states:
        conditions.append("q.state = ANY(:states)")
        params["states"] = list(states)
    if query:
        # The member's words are matched literally: % and _ are not wildcards here. The backslash is
        # PostgreSQL's default LIKE escape character, so it is escaped first.
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append("(q.body ILIKE :q OR q.answer_en ILIKE :q OR q.answer_ta ILIKE :q)")
        params["q"] = f"%{escaped}%"
    rows = db.execute(text(f"{_QUESTION} WHERE {' AND '.join(conditions)} ORDER BY q.created_at"), params).mappings()
    return [Question(**row) for row in rows]


def find_question(db: Session, question_id: uuid.UUID, viewer: uuid.UUID) -> Question | None:
    row = db.execute(text(f"{_QUESTION} WHERE q.id = :id"), {"id": question_id, "viewer": viewer}).mappings().one_or_none()
    return Question(**row) if row else None


def insert_question(db: Session, townhall_id: uuid.UUID, member_id: uuid.UUID, body: str) -> uuid.UUID:
    return db.scalar(
        text("INSERT INTO community.townhall_question (townhall_id, member_id, body) VALUES (:t, :m, :b) RETURNING id"),
        {"t": townhall_id, "m": member_id, "b": body},
    )


def count_member_questions(db: Session, townhall_id: uuid.UUID, member_id: uuid.UUID) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.townhall_question WHERE townhall_id = :t AND member_id = :m"),
        {"t": townhall_id, "m": member_id},
    ) or 0


def update_question(db: Session, question_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE community.townhall_question SET {sets} WHERE id = :id"), {**values, "id": question_id})


def vote(db: Session, question_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text("INSERT INTO community.townhall_vote (question_id, member_id) VALUES (:q, :m) ON CONFLICT DO NOTHING"),
        {"q": question_id, "m": member_id},
    )


def set_reminder(db: Session, townhall_id: uuid.UUID, member_id: uuid.UUID, on: bool) -> None:
    if on:
        db.execute(text("INSERT INTO community.townhall_reminder (townhall_id, member_id) VALUES (:t, :m) ON CONFLICT DO NOTHING"),
                   {"t": townhall_id, "m": member_id})
    else:
        db.execute(text("DELETE FROM community.townhall_reminder WHERE townhall_id = :t AND member_id = :m"),
                   {"t": townhall_id, "m": member_id})


def reminder_members(db: Session, townhall_id: uuid.UUID) -> list[uuid.UUID]:
    return list(db.scalars(text("SELECT member_id FROM community.townhall_reminder WHERE townhall_id = :t"), {"t": townhall_id}))


def reminded(db: Session, townhall_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    return bool(db.scalar(
        text("SELECT EXISTS (SELECT 1 FROM community.townhall_reminder WHERE townhall_id = :t AND member_id = :m)"),
        {"t": townhall_id, "m": member_id},
    ))


def due_reminders(db: Session, column: str, within_seconds: int, now: datetime) -> list[tuple[uuid.UUID, list[uuid.UUID]]]:
    """Sessions starting within the window whose reminder of this kind has not gone, with who asked."""
    assert column in ("reminded_day_at", "reminded_soon_at")
    rows = db.execute(
        text(
            f"""SELECT t.id, array_agg(r.member_id) FILTER (WHERE r.member_id IS NOT NULL) AS members
                FROM community.townhall t LEFT JOIN community.townhall_reminder r ON r.townhall_id = t.id
                WHERE t.state = 'scheduled' AND t.{column} IS NULL AND t.starts_at > :now
                  AND t.starts_at <= :now + make_interval(secs => :window)
                GROUP BY t.id"""
        ),
        {"now": now, "window": within_seconds},
    )
    return [(row[0], list(row[1] or [])) for row in rows]
