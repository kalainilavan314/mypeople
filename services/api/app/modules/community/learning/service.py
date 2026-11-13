"""Learning and courses (BRD H15, H16, FR-LRN-001 to 004, BR-047).

Progress is recorded only when the member taps "Complete lesson"; "Save and exit" keeps the lesson to
resume at. Completing a course appears in My Activity and never changes verification, role or
authority. Courses are written and published by staff with content.moderate [ASSUMPTION: the BRD
names no permission for course publishing].
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.service import AccessRefused, Staff
from app.modules.audit import service as audit
from app.modules.community.learning import repository
from app.modules.community.learning.repository import Course, Lesson, Progress

PUBLISH = "content.moderate"


class LearningRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class CourseNotFound(Exception):
    pass


@dataclass(frozen=True)
class CourseCard:
    course: Course
    progress: Progress | None


@dataclass(frozen=True)
class Catalogue:
    available: list[CourseCard]
    mine: list[CourseCard]
    completed: list[CourseCard]


def catalogue(db: Session, member_id: uuid.UUID) -> Catalogue:
    """FR-LRN-001: Available, My courses (started) and completed history. A course retired after the
    member started or finished it stays in their lists (H15 completed-course history), but is no
    longer offered to anyone else."""
    started = repository.member_course_ids(db, member_id)
    available, mine, completed = [], [], []
    for course in repository.courses(db, ("published", "retired")):
        if course.id not in started:
            if course.state == "published":
                available.append(CourseCard(course, None))
            continue
        card = CourseCard(course, repository.progress(db, course.id, member_id))
        (completed if started[course.id] else mine).append(card)
    return Catalogue(available, mine, completed)


@dataclass(frozen=True)
class CourseView:
    course: Course
    lessons: list[Lesson]
    progress: Progress | None


def view(db: Session, member_id: uuid.UUID, course_id: uuid.UUID) -> CourseView:
    course = repository.find_course(db, course_id)
    started = repository.progress(db, course_id, member_id) if course else None
    # A retired course stays readable to those who started it.
    if course is None or (course.state != "published" and not (course.state == "retired" and started)):
        raise CourseNotFound()
    return CourseView(course, repository.lessons(db, course_id), started)


def _lesson(view_: CourseView, lesson_id: uuid.UUID) -> Lesson:
    found = next((lesson for lesson in view_.lessons if lesson.id == lesson_id), None)
    if found is None:
        raise CourseNotFound()
    return found


def complete_lesson(db: Session, member_id: uuid.UUID, course_id: uuid.UUID, lesson_id: uuid.UUID, ip: str) -> CourseView:
    """FR-LRN-002: the only action that records progress."""
    current = view(db, member_id, course_id)
    lesson = _lesson(current, lesson_id)
    repository.start(db, course_id, member_id)
    repository.complete_lesson(db, lesson.id, member_id)
    after = repository.progress(db, course_id, member_id)
    assert after is not None
    remaining = [l for l in current.lessons if l.id not in after.completed_lessons]
    finished = not remaining
    repository.set_progress(db, course_id, member_id, remaining[0].position if remaining else lesson.position, finished)
    if finished and (current.progress is None or current.progress.completed_at is None):
        audit.record(db, actor_id=member_id, action="course.completed", target_type="course", target_id=str(course_id), ip=ip)
    db.commit()
    return view(db, member_id, course_id)


def save_and_exit(db: Session, member_id: uuid.UUID, course_id: uuid.UUID, lesson_id: uuid.UUID) -> CourseView:
    """FR-LRN-003: remembers where to resume; nothing is marked complete."""
    current = view(db, member_id, course_id)
    lesson = _lesson(current, lesson_id)
    repository.start(db, course_id, member_id)
    after = repository.progress(db, course_id, member_id)
    assert after is not None
    repository.set_progress(db, course_id, member_id, lesson.position, after.completed_at is not None)
    db.commit()
    return view(db, member_id, course_id)


# --- Course authors --------------------------------------------------------------------------------------


def _require(staff: Staff) -> None:
    if not access_rules.holds(staff.rule_assignments(), PUBLISH):
        raise AccessRefused("forbidden")


def managed(db: Session, staff: Staff) -> list[Course]:
    _require(staff)
    return repository.courses(db, ("draft", "published", "retired"))


def managed_course(db: Session, staff: Staff, course_id: uuid.UUID) -> tuple[Course, list[Lesson]]:
    _require(staff)
    course = repository.find_course(db, course_id)
    if course is None:
        raise CourseNotFound()
    return course, repository.lessons(db, course_id)


def save_course(db: Session, staff: Staff, course_id: uuid.UUID | None, values: dict[str, Any],
                lessons: list[dict[str, Any]], ip: str) -> Course:
    """Create a draft, or replace a draft's text and lessons. A published course is retired and
    replaced by a new one rather than changed under the people taking it."""
    _require(staff)
    if course_id is None:
        course_id = repository.insert_course(db, values, staff.member_id)
        action = "course.created"
    else:
        course = repository.find_course(db, course_id)
        if course is None:
            raise CourseNotFound()
        if course.state != "draft":
            raise LearningRefused("only_drafts_change")
        repository.update_course(db, course_id, values)
        action = "course.updated"
    repository.replace_lessons(db, course_id, lessons)
    audit.record(db, actor_id=staff.member_id, action=action, target_type="course", target_id=str(course_id), ip=ip)
    db.commit()
    saved = repository.find_course(db, course_id)
    assert saved is not None
    return saved


def move_course(db: Session, staff: Staff, course_id: uuid.UUID, state: str, ip: str) -> Course:
    _require(staff)
    course = repository.find_course(db, course_id)
    if course is None:
        raise CourseNotFound()
    allowed = {"draft": {"published"}, "published": {"retired"}, "retired": set()}
    if state not in allowed[course.state]:
        raise LearningRefused(f"not_allowed_from:{course.state}")
    if state == "published" and course.lessons == 0:
        raise LearningRefused("lessons_required")
    values: dict[str, Any] = {"state": state}
    if state == "published":
        values["published_at"] = datetime.now(UTC)
    repository.update_course(db, course_id, values)
    audit.record(db, actor_id=staff.member_id, action=f"course.{state}", target_type="course", target_id=str(course_id), ip=ip)
    db.commit()
    moved = repository.find_course(db, course_id)
    assert moved is not None
    return moved
