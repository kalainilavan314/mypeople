"""Request and response bodies for learning (H15, H16 and course authoring)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.learning.repository import Course, Lesson, Progress
from app.modules.community.learning.service import CourseCard, CourseView

Topic = Literal["movement", "civic", "app", "skills"]


class CourseCardOut(CamelModel):
    id: uuid.UUID
    course_ref: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    topic: Topic
    lessons: int
    minutes: int
    completed_lessons: int
    resume_position: int | None
    completed_at: datetime | None

    @classmethod
    def build(cls, course: Course, progress: Progress | None) -> "CourseCardOut":
        return cls(
            id=course.id, course_ref=course.course_ref, title_en=course.title_en, title_ta=course.title_ta,
            summary_en=course.summary_en, summary_ta=course.summary_ta, topic=course.topic,  # type: ignore[arg-type]
            lessons=course.lessons, minutes=course.minutes,
            completed_lessons=len(progress.completed_lessons) if progress else 0,
            resume_position=progress.resume_position if progress else None,
            completed_at=progress.completed_at if progress else None,
        )

    @classmethod
    def from_card(cls, card: CourseCard) -> "CourseCardOut":
        return cls.build(card.course, card.progress)


class CatalogueOut(CamelModel):
    available: list[CourseCardOut]
    mine: list[CourseCardOut]
    completed: list[CourseCardOut]


class LessonOut(CamelModel):
    id: uuid.UUID
    position: int
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    minutes: int
    completed: bool


class CourseDetailOut(CourseCardOut):
    state: Literal["draft", "published", "retired"]
    lesson_list: list[LessonOut]

    @classmethod
    def from_view(cls, view: CourseView) -> "CourseDetailOut":
        done = view.progress.completed_lessons if view.progress else set()
        return cls(
            **CourseCardOut.build(view.course, view.progress).model_dump(),
            state=view.course.state,  # type: ignore[arg-type]
            lesson_list=[_lesson(lesson, lesson.id in done) for lesson in view.lessons],
        )


def _lesson(lesson: Lesson, completed: bool) -> LessonOut:
    return LessonOut(
        id=lesson.id, position=lesson.position, title_en=lesson.title_en, title_ta=lesson.title_ta, body_en=lesson.body_en,
        body_ta=lesson.body_ta, minutes=lesson.minutes, completed=completed,
    )


class SaveExitIn(CamelModel):
    lesson_id: uuid.UUID


class LessonIn(CamelModel):
    title_en: str = Field(min_length=3, max_length=120)
    title_ta: str = Field(min_length=3, max_length=160)
    body_en: str = Field(min_length=20, max_length=12000)
    body_ta: str = Field(min_length=20, max_length=18000)
    minutes: int = Field(ge=1, le=120)


class CourseIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=120)
    title_ta: str = Field(min_length=5, max_length=160)
    summary_en: str = Field(min_length=10, max_length=600)
    summary_ta: str = Field(min_length=10, max_length=900)
    topic: Topic
    lessons: list[LessonIn] = Field(max_length=50)


class ManagedCourseOut(CamelModel):
    id: uuid.UUID
    course_ref: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    topic: Topic
    state: Literal["draft", "published", "retired"]
    lessons: list[LessonIn]
    published_at: datetime | None

    @classmethod
    def build(cls, course: Course, lessons: list[Lesson]) -> "ManagedCourseOut":
        return cls(
            id=course.id, course_ref=course.course_ref, title_en=course.title_en, title_ta=course.title_ta,
            summary_en=course.summary_en, summary_ta=course.summary_ta, topic=course.topic,  # type: ignore[arg-type]
            state=course.state,  # type: ignore[arg-type]
            lessons=[LessonIn(title_en=l.title_en, title_ta=l.title_ta, body_en=l.body_en, body_ta=l.body_ta, minutes=l.minutes)
                     for l in lessons],
            published_at=course.published_at,
        )


class CourseStateIn(CamelModel):
    state: Literal["published", "retired"]


class ManagedCourseSummaryOut(CamelModel):
    id: uuid.UUID
    course_ref: str
    title_en: str
    title_ta: str
    topic: Topic
    state: Literal["draft", "published", "retired"]
    lessons: int
    minutes: int
    published_at: datetime | None

    @classmethod
    def build(cls, course: Course) -> "ManagedCourseSummaryOut":
        return cls(
            id=course.id, course_ref=course.course_ref, title_en=course.title_en, title_ta=course.title_ta,
            topic=course.topic, state=course.state, lessons=course.lessons, minutes=course.minutes,  # type: ignore[arg-type]
            published_at=course.published_at,
        )
