"""Ask the Leader / Live Town Hall (BRD M21 to M23, D18, FR-THL-001 to 009): /v1/town-halls."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.townhalls import service
from app.modules.community.townhalls.schemas import (
    TownHallAnswerIn,
    ArchiveIn,
    TownHallModerationIn,
    QuestionIn,
    QuestionOut,
    ReminderIn,
    TownHallSessionOut,
    StaffSessionOut,
    TownHallIn,
    TownHallOut,
    TownHallStateIn,
)
from app.modules.election.service import SilencePeriod
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Producer = Annotated[Staff, Depends(require_permission(service.PRODUCE))]
Moderator = Annotated[Staff, Depends(require_permission(service.MODERATE))]
TownHallStaff = Annotated[Staff, Depends(require_permission(service.PRODUCE, service.MODERATE))]

router = APIRouter(prefix="/v1/town-halls", tags=["town-halls"], dependencies=[Depends(require_feature("town_halls"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.TownHallNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except SilencePeriod as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"code": "silence_period", "problems": error.period_refs}) from None
    except service.TownHallRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "townhall_refused", "problems": error.problems}
        ) from None


def _session(view: service.SessionView, member_id: uuid.UUID) -> TownHallSessionOut:
    return TownHallSessionOut(**TownHallOut.build(view.townhall).model_dump(),
                      questions=[QuestionOut.build(q, member_id) for q in view.questions], reminded=view.reminded)


@router.get("", response_model=list[TownHallOut])
def list_sessions(member: CurrentMember, db: Db) -> list[TownHallOut]:
    """Upcoming, live and past sessions for the member's area."""
    return [TownHallOut.build(t) for t in service.sessions(db, member.id)]


@router.get("/manage", response_model=list[TownHallOut])
def list_managed(staff: TownHallStaff, db: Db) -> list[TownHallOut]:
    with _answers():
        return [TownHallOut.build(t) for t in service.managed(db, staff)]


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=TownHallOut)
def create(body: TownHallIn, staff: Producer, request: Request, db: Db) -> TownHallOut:
    if body.area is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail={"code": "townhall_refused", "problems": ["area_required"]})
    area = Area(body.area.level, None if body.area.level == "platform" else body.area.code)
    with _answers():
        return TownHallOut.build(service.create(db, staff, body.model_dump(exclude={"area"}), area, client_ip(request)))


@router.get("/manage/{townhall_id}", response_model=StaffSessionOut)
def read_managed(townhall_id: uuid.UUID, staff: TownHallStaff, request: Request, db: Db) -> StaffSessionOut:
    with _answers():
        found, questions = service.staff_questions(db, staff, townhall_id, client_ip(request))
    return StaffSessionOut(**TownHallOut.build(found).model_dump(), legal_review_ref=found.legal_review_ref,
                           questions=[QuestionOut.build(q, staff.member_id, staff=True) for q in questions])


@router.put("/manage/{townhall_id}", response_model=TownHallOut)
def update(townhall_id: uuid.UUID, body: TownHallIn, staff: Producer, request: Request, db: Db) -> TownHallOut:
    with _answers():
        return TownHallOut.build(service.update(db, staff, townhall_id, body.model_dump(exclude={"area"}), client_ip(request)))


@router.post("/manage/{townhall_id}/state", response_model=TownHallOut)
def move(townhall_id: uuid.UUID, body: TownHallStateIn, staff: Producer, request: Request, db: Db) -> TownHallOut:
    """Schedule, go live, end or cancel; refused in a silence window (409 silence_period, FR-THL-008)."""
    with _answers():
        return TownHallOut.build(service.move(db, staff, townhall_id, body.state, body.reason, client_ip(request)))


@router.post("/manage/questions/{question_id}/moderation", response_model=QuestionOut)
def moderate(question_id: uuid.UUID, body: TownHallModerationIn, staff: Moderator, request: Request, db: Db) -> QuestionOut:
    with _answers():
        return QuestionOut.build(
            service.moderate(db, staff, question_id, body.decision, body.reason, body.merge_into, client_ip(request)),
            staff.member_id, staff=True,
        )


@router.post("/manage/questions/{question_id}/answer", response_model=QuestionOut)
def answer(question_id: uuid.UUID, body: TownHallAnswerIn, staff: Producer, request: Request, db: Db) -> QuestionOut:
    with _answers():
        return QuestionOut.build(
            service.answer(db, staff, question_id, body.mode, body.at_second, body.answer_en, body.answer_ta,
                           client_ip(request)),
            staff.member_id, staff=True,
        )


@router.post("/manage/{townhall_id}/archive", response_model=TownHallOut)
def archive(townhall_id: uuid.UUID, body: ArchiveIn, staff: Producer, request: Request, db: Db) -> TownHallOut:
    values = body.model_dump()
    values["outcomes"] = [o.model_dump(mode="json", by_alias=True) for o in body.outcomes]
    with _answers():
        return TownHallOut.build(service.archive(db, staff, townhall_id, values, client_ip(request)))


@router.get("/{townhall_id}", response_model=TownHallSessionOut)
def read(townhall_id: uuid.UUID, member: CurrentMember, db: Db,
         q: Annotated[str | None, Query(max_length=80, description="Search the question history (FR-THL-007)")] = None) -> TownHallSessionOut:
    """M21 to M23: the session, approved questions with vote totals, and the member's own."""
    with _answers():
        return _session(service.view(db, member.id, townhall_id, q.strip() if q else None), member.id)


@router.post("/{townhall_id}/questions", status_code=status.HTTP_201_CREATED, response_model=QuestionOut)
def ask(townhall_id: uuid.UUID, body: QuestionIn, member: CurrentMember, request: Request, db: Db) -> QuestionOut:
    with _answers():
        return QuestionOut.build(service.ask(db, member.id, townhall_id, body.body, client_ip(request)), member.id)


@router.post("/questions/{question_id}/vote", response_model=QuestionOut)
def vote(question_id: uuid.UUID, member: CurrentMember, db: Db) -> QuestionOut:
    with _answers():
        return QuestionOut.build(service.vote(db, member.id, question_id), member.id)


@router.put("/{townhall_id}/reminder", response_model=TownHallSessionOut)
def set_reminder(townhall_id: uuid.UUID, body: ReminderIn, member: CurrentMember, db: Db) -> TownHallSessionOut:
    """Remind me 24 hours and 15 minutes before (FR-THL-001)."""
    with _answers():
        return _session(service.set_reminder(db, member.id, townhall_id, body.remind), member.id)
