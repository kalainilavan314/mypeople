"""Surveys (BRD H14, H21, FR-SRV-001 to 006): /v1/surveys."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.surveys import rules, service
from app.modules.community.surveys.schemas import (
    ManagedSurveyOut,
    SurveyResponseIn,
    SurveyDetailOut,
    SurveyIn,
    SurveyResultsOut,
    SurveyStateIn,
    SurveySummaryOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Manager = Annotated[Staff, Depends(require_permission(rules.PERMISSION))]

router = APIRouter(prefix="/v1/surveys", tags=["surveys"], dependencies=[Depends(require_feature("ideas_surveys"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.SurveyNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.SurveyRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "survey_refused", "problems": error.problems}
        ) from None


def _split(body: SurveyIn) -> tuple[dict, list[dict]]:  # type: ignore[type-arg]
    values = body.model_dump(exclude={"area", "questions"})
    questions = [q.model_dump() for q in body.questions]
    return values, questions


@router.get("", response_model=list[SurveySummaryOut])
def list_surveys(member: CurrentMember, db: Db) -> list[SurveySummaryOut]:
    """Open surveys for the member's area, with their receipt where they have answered."""
    return [SurveySummaryOut(**SurveySummaryOut.fields(s, receipt)) for s, receipt in service.open_surveys(db, member.id)]


@router.get("/manage", response_model=list[ManagedSurveyOut])
def list_managed(staff: Manager, db: Db) -> list[ManagedSurveyOut]:
    return [ManagedSurveyOut.build(s) for s in service.managed(db, staff)]


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=ManagedSurveyOut)
def create_survey(body: SurveyIn, staff: Manager, request: Request, db: Db) -> ManagedSurveyOut:
    values, questions = _split(body)
    with _answers():
        return ManagedSurveyOut.build(
            service.create(db, staff, values, questions, Area(body.area.level, body.area.code), client_ip(request))
        )


@router.put("/manage/{survey_id}", response_model=ManagedSurveyOut)
def update_survey(survey_id: uuid.UUID, body: SurveyIn, staff: Manager, request: Request, db: Db) -> ManagedSurveyOut:
    """Drafts only; once open, a survey's questions never change under the people answering it."""
    values, questions = _split(body)
    with _answers():
        return ManagedSurveyOut.build(service.update_draft(db, staff, survey_id, values, questions, client_ip(request)))


@router.post("/manage/{survey_id}/state", response_model=ManagedSurveyOut)
def move_survey(survey_id: uuid.UUID, body: SurveyStateIn, staff: Manager, request: Request, db: Db) -> ManagedSurveyOut:
    with _answers():
        return ManagedSurveyOut.build(service.move(db, staff, survey_id, body.state, client_ip(request)))


@router.get("/manage/{survey_id}/results", response_model=SurveyResultsOut)
def read_results(survey_id: uuid.UUID, staff: Manager, request: Request, db: Db) -> SurveyResultsOut:
    """Counts only; groups of 1 to 9 are hidden."""
    with _answers():
        return SurveyResultsOut.build(service.results(db, staff, survey_id, client_ip(request)))


@router.get("/{survey_id}", response_model=SurveyDetailOut)
def read_survey(survey_id: uuid.UUID, member: CurrentMember, db: Db) -> SurveyDetailOut:
    """H14: the questions, audience and privacy statement; or the receipt once answered (H21)."""
    with _answers():
        return SurveyDetailOut.build(service.view(db, member.id, survey_id))


@router.post("/{survey_id}/responses", response_model=SurveyDetailOut)
def respond(survey_id: uuid.UUID, body: SurveyResponseIn, member: CurrentMember, request: Request, db: Db) -> SurveyDetailOut:
    """FR-SRV-005, 006: one response per member; the receipt and "What happens next" come back."""
    with _answers():
        return SurveyDetailOut.build(service.respond(db, member.id, survey_id, body.answers, client_ip(request)))
