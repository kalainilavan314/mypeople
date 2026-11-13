"""Misinformation reports and the fact-check queue (BRD M48 reporting part, D12, FR-AUT-006 to 009): /v1/fact-checks."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.factchecks import service
from app.modules.community.factchecks.repository import Report
from app.modules.community.issues.evidence import IssueVault
from app.modules.content.gallery.dependencies import PhotoBody
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
FactChecker = Annotated[Staff, Depends(require_permission(service.FACT_CHECK))]
Outcome = Literal["false", "misleading", "accurate", "not_actionable"]

router = APIRouter(prefix="/v1/fact-checks", tags=["fact-checks"], dependencies=[Depends(require_feature("fact_checks"))])


class ScreenshotOut(CamelModel):
    id: uuid.UUID
    width: int
    height: int


class MisinfoReportIn(CamelModel):
    link: str | None = Field(default=None, pattern=r"^https?://", max_length=1000)
    description: str = Field(min_length=10, max_length=1000)
    screenshot_id: uuid.UUID | None = None


class MisinfoReportOut(CamelModel):
    id: uuid.UUID
    report_ref: str
    link: str | None
    description: str
    has_screenshot: bool
    state: Literal["pending", "decided"]
    outcome: Outcome | None = Field(description="Decided by a person; never an automatic score (BR-149)")
    reason: str | None
    decided_at: datetime | None
    appeal_state: Literal["none", "open", "upheld", "changed"]
    appeal_outcome: Outcome | None
    appeal_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, r: Report) -> "MisinfoReportOut":
        return cls(id=r.id, report_ref=r.report_ref, link=r.link, description=r.description,
                   has_screenshot=r.screenshot_id is not None, state=r.state, outcome=r.outcome,  # type: ignore[arg-type]
                   reason=r.reason, decided_at=r.decided_at, appeal_state=r.appeal_state,  # type: ignore[arg-type]
                   appeal_outcome=r.appeal_outcome, appeal_reason=r.appeal_reason, created_at=r.created_at)  # type: ignore[arg-type]


class StaffMisinfoReportOut(MisinfoReportOut):
    appeal_body: str | None


class FactCheckAppealIn(CamelModel):
    body: str = Field(min_length=10, max_length=1000)


class FactCheckDecisionIn(CamelModel):
    outcome: Outcome
    reason: str = Field(min_length=10, max_length=2000)


class FactCheckAppealDecisionIn(CamelModel):
    change: bool
    outcome: Outcome | None = None
    reason: str = Field(min_length=10, max_length=2000)


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ReportNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.FactCheckRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "factcheck_refused", "problems": error.problems}
        ) from None


def _staff(r: Report) -> StaffMisinfoReportOut:
    return StaffMisinfoReportOut(**MisinfoReportOut.build(r).model_dump(), appeal_body=r.appeal_body)


@router.post("/screenshots", status_code=status.HTTP_201_CREATED, response_model=ScreenshotOut)
def upload_screenshot(member: CurrentMember, photo: PhotoBody, vault: IssueVault, db: Db) -> ScreenshotOut:
    """Re-encoded without metadata and sealed; attach it to a report by id."""
    with _answers():
        shot = service.save_screenshot(db, vault, member.id, photo)
    return ScreenshotOut(id=shot.id, width=shot.width, height=shot.height)


@router.post("/reports", status_code=status.HTTP_201_CREATED, response_model=MisinfoReportOut)
def report(body: MisinfoReportIn, member: CurrentMember, request: Request, db: Db) -> MisinfoReportOut:
    """M48: report suspected misinformation with a link or a screenshot."""
    with _answers():
        return MisinfoReportOut.build(service.report(db, member.id, body.link, body.description, body.screenshot_id,
                                                     client_ip(request)))


@router.get("/reports/mine", response_model=list[MisinfoReportOut])
def my_reports(member: CurrentMember, db: Db) -> list[MisinfoReportOut]:
    return [MisinfoReportOut.build(r) for r in service.my_reports(db, member.id)]


@router.post("/reports/{report_id}/appeal", response_model=MisinfoReportOut)
def appeal(report_id: uuid.UUID, body: FactCheckAppealIn, member: CurrentMember, request: Request, db: Db) -> MisinfoReportOut:
    with _answers():
        return MisinfoReportOut.build(service.appeal(db, member.id, report_id, body.body, client_ip(request)))


@router.get("/manage", response_model=list[StaffMisinfoReportOut])
def queue(staff: FactChecker, db: Db, open_only: bool = True) -> list[StaffMisinfoReportOut]:
    """D12: reports waiting for a decision and appeals waiting for a second person, oldest first."""
    with _answers():
        return [_staff(r) for r in service.queue(db, staff, open_only)]


@router.get("/manage/{report_id}/screenshot", response_class=Response,
            responses={200: {"content": {"image/webp": {}}, "description": "The screenshot, without metadata"}})
def read_screenshot(report_id: uuid.UUID, staff: FactChecker, vault: IssueVault, request: Request, db: Db) -> Response:
    with _answers():
        data = service.screenshot(db, vault, staff, report_id, client_ip(request))
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": "no-store"})


@router.post("/manage/{report_id}/decision", response_model=StaffMisinfoReportOut)
def decide(report_id: uuid.UUID, body: FactCheckDecisionIn, staff: FactChecker, request: Request, db: Db) -> StaffMisinfoReportOut:
    with _answers():
        return _staff(service.decide(db, staff, report_id, body.outcome, body.reason, client_ip(request)))


@router.post("/manage/{report_id}/appeal-decision", response_model=StaffMisinfoReportOut)
def decide_appeal(report_id: uuid.UUID, body: FactCheckAppealDecisionIn, staff: FactChecker, request: Request,
                  db: Db) -> StaffMisinfoReportOut:
    """Never by the first fact-checker (403 original_decider)."""
    with _answers():
        return _staff(service.decide_appeal(db, staff, report_id, body.change, body.outcome, body.reason, client_ip(request)))
