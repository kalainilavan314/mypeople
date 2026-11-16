"""Learning and courses (BRD H15, H16, FR-LRN-001 to 004): /v1/learning."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.learning import service
from app.modules.community.learning.schemas import (
    CatalogueOut,
    CourseCardOut,
    CourseDetailOut,
    CourseIn,
    CourseStateIn,
    ManagedCourseOut,
    ManagedCourseSummaryOut,
    SaveExitIn,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Author = Annotated[Staff, Depends(require_permission(service.PUBLISH))]

router = APIRouter(prefix="/v1/learning", tags=["learning"], dependencies=[Depends(require_feature("learning"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.CourseNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.LearningRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "learning_refused", "problems": error.problems}
        ) from None


@router.get("/courses", response_model=CatalogueOut)
def read_catalogue(member: CurrentMember, db: Db) -> CatalogueOut:
    """H15: Available, My courses and completed history, with lessons and minutes."""
    found = service.catalogue(db, member.id)
    return CatalogueOut(
        available=[CourseCardOut.from_card(c) for c in found.available],
        mine=[CourseCardOut.from_card(c) for c in found.mine],
        completed=[CourseCardOut.from_card(c) for c in found.completed],
    )


@router.get("/manage/courses", response_model=list[ManagedCourseSummaryOut])
def list_managed(staff: Author, db: Db) -> list[ManagedCourseSummaryOut]:
    with _answers():
        return [ManagedCourseSummaryOut.build(c) for c in service.managed(db, staff)]


@router.post("/manage/courses", status_code=status.HTTP_201_CREATED, response_model=ManagedCourseOut)
def create_course(body: CourseIn, staff: Author, request: Request, db: Db) -> ManagedCourseOut:
    values = body.model_dump(exclude={"lessons"})
    with _answers():
        course = service.save_course(db, staff, None, values, [l.model_dump() for l in body.lessons], client_ip(request))
        found, lessons = service.managed_course(db, staff, course.id)
    return ManagedCourseOut.build(found, lessons)


@router.get("/manage/courses/{course_id}", response_model=ManagedCourseOut)
def read_managed(course_id: uuid.UUID, staff: Author, db: Db) -> ManagedCourseOut:
    with _answers():
        found, lessons = service.managed_course(db, staff, course_id)
    return ManagedCourseOut.build(found, lessons)


@router.put("/manage/courses/{course_id}", response_model=ManagedCourseOut)
def update_course(course_id: uuid.UUID, body: CourseIn, staff: Author, request: Request, db: Db) -> ManagedCourseOut:
    values = body.model_dump(exclude={"lessons"})
    with _answers():
        service.save_course(db, staff, course_id, values, [l.model_dump() for l in body.lessons], client_ip(request))
        found, lessons = service.managed_course(db, staff, course_id)
    return ManagedCourseOut.build(found, lessons)


@router.post("/manage/courses/{course_id}/state", response_model=ManagedCourseOut)
def move_course(course_id: uuid.UUID, body: CourseStateIn, staff: Author, request: Request, db: Db) -> ManagedCourseOut:
    with _answers():
        service.move_course(db, staff, course_id, body.state, client_ip(request))
        found, lessons = service.managed_course(db, staff, course_id)
    return ManagedCourseOut.build(found, lessons)


@router.get("/courses/{course_id}", response_model=CourseDetailOut)
def read_course(course_id: uuid.UUID, member: CurrentMember, db: Db) -> CourseDetailOut:
    """H16: the lessons, which are complete, and the lesson to resume."""
    with _answers():
        return CourseDetailOut.from_view(service.view(db, member.id, course_id))


@router.post("/courses/{course_id}/lessons/{lesson_id}/complete", response_model=CourseDetailOut)
def complete_lesson(course_id: uuid.UUID, lesson_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> CourseDetailOut:
    """FR-LRN-002: progress is recorded only here."""
    with _answers():
        return CourseDetailOut.from_view(service.complete_lesson(db, member.id, course_id, lesson_id, client_ip(request)))


@router.post("/courses/{course_id}/save-exit", response_model=CourseDetailOut)
def save_and_exit(course_id: uuid.UUID, body: SaveExitIn, member: CurrentMember, db: Db) -> CourseDetailOut:
    """FR-LRN-003: remember the lesson to resume at; nothing is marked complete."""
    with _answers():
        return CourseDetailOut.from_view(service.save_and_exit(db, member.id, course_id, body.lesson_id))
