"""Public accountability scorecard (BRD M20, D17, FR-ACS-001 to 008): /v1/scorecards."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.scorecards import rules, service
from app.modules.community.scorecards.repository import Correction, Scorecard
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Reader = Annotated[Staff, Depends(require_permission(*service.READERS))]
Publisher = Annotated[Staff, Depends(require_permission(rules.PUBLISH))]

router = APIRouter(prefix="/v1/scorecards", tags=["scorecards"], dependencies=[Depends(require_feature("scorecards"))])


class AreaPeriodOut(CamelModel):
    period: str
    version: int
    published_at: datetime | None
    figures: dict[str, Any] = Field(description="{insufficient: true} under 10 accepted cases, else metrics with numerator and denominator")
    note_en: str | None
    note_ta: str | None


class AreaScorecardOut(CamelModel):
    area_key: str
    name_en: str | None
    name_ta: str | None
    periods: list[AreaPeriodOut]


class MyScorecardsOut(CamelModel):
    sla_version: str
    areas: list[AreaScorecardOut]


class ScorecardOut(CamelModel):
    id: uuid.UUID
    period: str
    version: int
    state: Literal["draft", "shared", "published", "superseded"]
    sla_version: str
    figures: dict[str, Any]
    notes: dict[str, Any]
    created_at: datetime
    shared_at: datetime | None
    publishable_at: datetime | None = Field(description="Publishing is possible from here (10 working days after sharing)")
    published_at: datetime | None
    correction_reason: str | None

    @classmethod
    def build(cls, card: Scorecard) -> "ScorecardOut":
        return cls(
            id=card.id, period=card.period, version=card.version, state=card.state,  # type: ignore[arg-type]
            sla_version=card.sla_version, figures=card.figures, notes=card.notes, created_at=card.created_at,
            shared_at=card.shared_at, publishable_at=card.publishable_at, published_at=card.published_at,
            correction_reason=card.correction_reason,
        )


class CorrectionOut(CamelModel):
    id: uuid.UUID
    area_key: str
    metric: str
    reason: str
    state: Literal["open", "accepted", "rejected"]
    decision_note: str | None
    created_at: datetime
    decided_at: datetime | None

    @classmethod
    def build(cls, c: Correction) -> "CorrectionOut":
        return cls(id=c.id, area_key=c.area_key, metric=c.metric, reason=c.reason, state=c.state,  # type: ignore[arg-type]
                   decision_note=c.decision_note, created_at=c.created_at, decided_at=c.decided_at)


class ScorecardFileOut(CamelModel):
    scorecard: ScorecardOut
    corrections: list[CorrectionOut]


class ScorecardDraftIn(CamelModel):
    period: str = Field(pattern=r"^[0-9]{4}-Q[1-4]$")


class ScorecardNoteIn(CamelModel):
    area_key: str = Field(max_length=40)
    note_en: str = Field(default="", max_length=500)
    note_ta: str = Field(default="", max_length=800)


class CorrectionIn(CamelModel):
    area_key: str = Field(max_length=40)
    metric: str = Field(max_length=40)
    reason: str = Field(min_length=5, max_length=1000)


class CorrectionDecisionIn(CamelModel):
    accept: bool
    note: str = Field(min_length=3, max_length=1000)


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ScorecardNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.ScorecardRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "scorecard_refused", "problems": error.problems}
        ) from None


@router.get("/area", response_model=MyScorecardsOut)
def my_area(member: CurrentMember, db: Db) -> MyScorecardsOut:
    """M20: the member's GN, DS division and district for the last four published periods."""
    return MyScorecardsOut(
        sla_version=rules.SLA_VERSION,
        areas=[
            AreaScorecardOut(
                area_key=card.area_key, name_en=card.name_en, name_ta=card.name_ta,
                periods=[AreaPeriodOut(period=p.period, version=p.version, published_at=p.published_at, figures=p.figures,
                                       note_en=p.note_en, note_ta=p.note_ta) for p in card.periods],
            )
            for card in service.my_area(db, member.id)
        ],
    )


@router.get("/manage", response_model=list[ScorecardOut])
def list_versions(staff: Reader, db: Db) -> list[ScorecardOut]:
    with _answers():
        return [ScorecardOut.build(c) for c in service.versions(db, staff)]


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=ScorecardOut)
def draft(body: ScorecardDraftIn, staff: Publisher, request: Request, db: Db) -> ScorecardOut:
    """Compute a draft for a finished quarter from the cases."""
    with _answers():
        return ScorecardOut.build(service.draft(db, staff, body.period, client_ip(request)))


@router.get("/manage/{scorecard_id}", response_model=ScorecardFileOut)
def read(scorecard_id: uuid.UUID, staff: Reader, db: Db) -> ScorecardFileOut:
    with _answers():
        card, corrections = service.view(db, staff, scorecard_id)
    return ScorecardFileOut(scorecard=ScorecardOut.build(card), corrections=[CorrectionOut.build(c) for c in corrections])


@router.post("/manage/{scorecard_id}/share", response_model=ScorecardOut)
def share(scorecard_id: uuid.UUID, staff: Publisher, request: Request, db: Db) -> ScorecardOut:
    with _answers():
        return ScorecardOut.build(service.share(db, staff, scorecard_id, client_ip(request)))


@router.put("/manage/{scorecard_id}/notes", response_model=ScorecardOut)
def set_note(scorecard_id: uuid.UUID, body: ScorecardNoteIn, staff: Publisher, request: Request, db: Db) -> ScorecardOut:
    with _answers():
        return ScorecardOut.build(service.set_note(db, staff, scorecard_id, body.area_key, body.note_en, body.note_ta,
                                                   client_ip(request)))


@router.post("/manage/{scorecard_id}/corrections", status_code=status.HTTP_201_CREATED, response_model=CorrectionOut)
def request_correction(scorecard_id: uuid.UUID, body: CorrectionIn, staff: Reader, request: Request, db: Db) -> CorrectionOut:
    """The responsible tiers ask for a correction, with the reason."""
    with _answers():
        return CorrectionOut.build(service.request_correction(db, staff, scorecard_id, body.area_key, body.metric,
                                                              body.reason, client_ip(request)))


@router.post("/manage/corrections/{correction_id}/decision", response_model=ScorecardOut)
def decide_correction(correction_id: uuid.UUID, body: CorrectionDecisionIn, staff: Publisher, request: Request,
                      db: Db) -> ScorecardOut:
    with _answers():
        return ScorecardOut.build(service.decide_correction(db, staff, correction_id, body.accept, body.note,
                                                            client_ip(request)))


@router.post("/manage/{scorecard_id}/publish", response_model=ScorecardOut)
def publish(scorecard_id: uuid.UUID, staff: Publisher, request: Request, db: Db) -> ScorecardOut:
    """FR-ACS-006: only with scorecard.publish, after the 10 working days."""
    with _answers():
        return ScorecardOut.build(service.publish(db, staff, scorecard_id, client_ip(request)))
