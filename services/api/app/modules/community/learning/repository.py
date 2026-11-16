"""SQL for courses, lessons and each member's progress."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Course:
    id: uuid.UUID
    course_ref: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    topic: str
    state: str
    published_at: datetime | None
    created_at: datetime
    lessons: int
    minutes: int


_COURSE = """
    SELECT c.id, c.course_ref, c.title_en, c.title_ta, c.summary_en, c.summary_ta, c.topic, c.state, c.published_at,
           c.created_at,
           (SELECT count(*) FROM community.course_lesson l WHERE l.course_id = c.id) AS lessons,
           (SELECT COALESCE(sum(l.minutes), 0) FROM community.course_lesson l WHERE l.course_id = c.id) AS minutes
    FROM community.course c
"""


def find_course(db: Session, course_id: uuid.UUID) -> Course | None:
    row = db.execute(text(f"{_COURSE} WHERE c.id = :id"), {"id": course_id}).mappings().one_or_none()
    return Course(**row) if row else None


def courses(db: Session, states: tuple[str, ...]) -> list[Course]:
    rows = db.execute(
        text(f"{_COURSE} WHERE c.state = ANY(:states) ORDER BY c.published_at DESC NULLS LAST, c.created_at DESC"),
        {"states": list(states)},
    ).mappings()
    return [Course(**row) for row in rows]


def insert_course(db: Session, values: dict[str, Any], created_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO community.course (title_en, title_ta, summary_en, summary_ta, topic, created_by)
               VALUES (:title_en, :title_ta, :summary_en, :summary_ta, :topic, :created_by) RETURNING id"""
        ),
        {**values, "created_by": created_by},
    )


def update_course(db: Session, course_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE community.course SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": course_id},
    )


@dataclass(frozen=True)
class Lesson:
    id: uuid.UUID
    course_id: uuid.UUID
    position: int
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    minutes: int


def lessons(db: Session, course_id: uuid.UUID) -> list[Lesson]:
    rows = db.execute(
        text("""SELECT id, course_id, position, title_en, title_ta, body_en, body_ta, minutes
                FROM community.course_lesson WHERE course_id = :id ORDER BY position"""),
        {"id": course_id},
    ).mappings()
    return [Lesson(**row) for row in rows]


def replace_lessons(db: Session, course_id: uuid.UUID, items: list[dict[str, Any]]) -> None:
    db.execute(text("DELETE FROM community.course_lesson WHERE course_id = :id"), {"id": course_id})
    for position, item in enumerate(items, start=1):
        db.execute(
            text(
                """INSERT INTO community.course_lesson (course_id, position, title_en, title_ta, body_en, body_ta, minutes)
                   VALUES (:course, :position, :title_en, :title_ta, :body_en, :body_ta, :minutes)"""
            ),
            {**item, "course": course_id, "position": position},
        )


@dataclass(frozen=True)
class Progress:
    resume_position: int
    started_at: datetime
    completed_at: datetime | None
    completed_lessons: set[uuid.UUID]


def progress(db: Session, course_id: uuid.UUID, member_id: uuid.UUID) -> Progress | None:
    row = db.execute(
        text("""SELECT resume_position, started_at, completed_at FROM community.course_progress
                WHERE course_id = :c AND member_id = :m"""),
        {"c": course_id, "m": member_id},
    ).one_or_none()
    if row is None:
        return None
    done = set(
        db.scalars(
            text(
                """SELECT c.lesson_id FROM community.lesson_completion c JOIN community.course_lesson l ON l.id = c.lesson_id
                   WHERE l.course_id = :c AND c.member_id = :m"""
            ),
            {"c": course_id, "m": member_id},
        )
    )
    return Progress(row.resume_position, row.started_at, row.completed_at, done)


def start(db: Session, course_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text("""INSERT INTO community.course_progress (course_id, member_id) VALUES (:c, :m) ON CONFLICT DO NOTHING"""),
        {"c": course_id, "m": member_id},
    )


def complete_lesson(db: Session, lesson_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text("INSERT INTO community.lesson_completion (lesson_id, member_id) VALUES (:l, :m) ON CONFLICT DO NOTHING"),
        {"l": lesson_id, "m": member_id},
    )


def set_progress(db: Session, course_id: uuid.UUID, member_id: uuid.UUID, resume_position: int, completed: bool) -> None:
    db.execute(
        text(
            """UPDATE community.course_progress SET resume_position = :p, updated_at = clock_timestamp(),
                      completed_at = CASE WHEN :done THEN COALESCE(completed_at, clock_timestamp()) ELSE completed_at END
               WHERE course_id = :c AND member_id = :m"""
        ),
        {"c": course_id, "m": member_id, "p": resume_position, "done": completed},
    )


def member_course_ids(db: Session, member_id: uuid.UUID) -> dict[uuid.UUID, datetime | None]:
    rows = db.execute(
        text("SELECT course_id, completed_at FROM community.course_progress WHERE member_id = :m"), {"m": member_id}
    )
    return {row.course_id: row.completed_at for row in rows}
