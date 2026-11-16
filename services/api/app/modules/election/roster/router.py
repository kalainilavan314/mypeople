"""The election duty roster (BRD M30, S15, FR-ELX-005 to 007, 009): /v1/election/roster."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.election.roster import service
from app.modules.election.roster.repository import Assignment, ReportEntry, SentMessage, Shift
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Coordinator = Annotated[Staff, Depends(require_permission(service.PERMISSION))]
ElectionLead = Annotated[Staff, Depends(require_permission(service.REPORT))]

router = APIRouter(prefix="/v1/election/roster", tags=["election-roster"], dependencies=[Depends(require_feature("election_roster"))])


class ShiftOut(CamelModel):
    id: uuid.UUID
    period_id: uuid.UUID
    period_ref: str
    role_en: str
    role_ta: str
    site_en: str
    site_ta: str
    area_key: str
    starts_at: datetime
    ends_at: datetime
    places: int
    accepted: int
    offered: int
    state: Literal["open", "cancelled"]

    @classmethod
    def build(cls, s: Shift) -> "ShiftOut":
        return cls(id=s.id, period_id=s.period_id, period_ref=s.period_ref, role_en=s.role_en, role_ta=s.role_ta,
                   site_en=s.site_en, site_ta=s.site_ta, area_key=s.area_key, starts_at=s.starts_at, ends_at=s.ends_at,
                   places=s.places, accepted=s.accepted, offered=s.offered, state=s.state)  # type: ignore[arg-type]


class RosterAssignmentOut(CamelModel):
    id: uuid.UUID
    volunteer_name: str
    member_code: str
    state: Literal["offered", "accepted", "declined", "cancelled"]
    responded_at: datetime | None
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    site_confirmed: bool | None

    @classmethod
    def build(cls, a: Assignment) -> "RosterAssignmentOut":
        return cls(id=a.id, volunteer_name=a.volunteer_name, member_code=a.member_code, state=a.state,  # type: ignore[arg-type]
                   responded_at=a.responded_at, checked_in_at=a.checked_in_at, checked_out_at=a.checked_out_at,
                   site_confirmed=a.site_confirmed)


class RosterMessageOut(CamelModel):
    """S15: an operational message already sent to the volunteers rostered on a shift."""

    id: uuid.UUID
    body_en: str
    body_ta: str
    sent_by_name: str
    recipients: int
    created_at: datetime

    @classmethod
    def build(cls, m: SentMessage) -> "RosterMessageOut":
        return cls(id=m.id, body_en=m.body_en, body_ta=m.body_ta, sent_by_name=m.sent_by_name, recipients=m.recipients,
                   created_at=m.created_at)


class ShiftFileOut(ShiftOut):
    assignments: list[RosterAssignmentOut]
    messages: list[RosterMessageOut] = Field(description="Messages already sent to the shift, newest first")


class MyShiftOut(CamelModel):
    """M30: a shift the member was offered, with their answer and check-in times."""

    assignment_id: uuid.UUID
    state: Literal["offered", "accepted", "declined", "cancelled"]
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    site_confirmed: bool | None
    shift: ShiftOut

    @classmethod
    def build(cls, item: service.MyShift) -> "MyShiftOut":
        a = item.assignment
        return cls(assignment_id=a.id, state=a.state, checked_in_at=a.checked_in_at,  # type: ignore[arg-type]
                   checked_out_at=a.checked_out_at, site_confirmed=a.site_confirmed, shift=ShiftOut.build(item.shift))


class ShiftAreaIn(CamelModel):
    level: Literal["province", "district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class ShiftIn(CamelModel):
    period_id: uuid.UUID
    role_en: str = Field(min_length=3, max_length=120)
    role_ta: str = Field(min_length=3, max_length=160)
    site_en: str = Field(min_length=3, max_length=200)
    site_ta: str = Field(min_length=3, max_length=300)
    area: ShiftAreaIn
    starts_at: datetime
    ends_at: datetime
    places: int = Field(ge=1, le=200)


class OfferIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=30)


class ReasonIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class RosterMessageIn(CamelModel):
    body_en: str = Field(min_length=3, max_length=500)
    body_ta: str = Field(min_length=3, max_length=800)


class SentOut(CamelModel):
    recipients: int


class ShiftAnswerIn(CamelModel):
    accept: bool


class CheckInIn(CamelModel):
    site_confirmed: bool | None = Field(default=None, description="Optional; no location is ever recorded")


class PeriodReportEntryOut(CamelModel):
    """One audit entry behind the period report: what happened, to which record and when; ids only."""

    action: str
    target_type: str | None
    target_id: str | None
    occurred_at: datetime

    @classmethod
    def build(cls, e: ReportEntry) -> "PeriodReportEntryOut":
        return cls(action=e.action, target_type=e.target_type, target_id=e.target_id, occurred_at=e.occurred_at)


class PeriodReportOut(CamelModel):
    shifts: int
    roster_assignments: int
    roster_changes: int
    roster_messages: int
    broadcasts_sent: int
    content_published: int
    silence_blocks: int


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.RosterNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.RosterRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "roster_refused", "problems": error.problems}
        ) from None


def _file(f: service.ShiftFile) -> ShiftFileOut:
    return ShiftFileOut(**ShiftOut.build(f.shift).model_dump(), assignments=[RosterAssignmentOut.build(a) for a in f.assignments],
                        messages=[RosterMessageOut.build(m) for m in f.messages])


@router.get("/mine", response_model=list[MyShiftOut])
def my_shifts(member: CurrentMember, db: Db) -> list[MyShiftOut]:
    return [MyShiftOut.build(item) for item in service.my_shifts(db, member.id)]


@router.post("/assignments/{assignment_id}/answer", response_model=MyShiftOut)
def answer(assignment_id: uuid.UUID, body: ShiftAnswerIn, member: CurrentMember, request: Request, db: Db) -> MyShiftOut:
    with _answers():
        return MyShiftOut.build(service.respond(db, member.id, assignment_id, body.accept, client_ip(request)))


@router.post("/assignments/{assignment_id}/check-in", response_model=MyShiftOut)
def check_in(assignment_id: uuid.UUID, body: CheckInIn, member: CurrentMember, request: Request, db: Db) -> MyShiftOut:
    with _answers():
        return MyShiftOut.build(service.check_in(db, member.id, assignment_id, body.site_confirmed, client_ip(request)))


@router.post("/assignments/{assignment_id}/check-out", response_model=MyShiftOut)
def check_out(assignment_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> MyShiftOut:
    with _answers():
        return MyShiftOut.build(service.check_out(db, member.id, assignment_id, client_ip(request)))


class OpenPeriodOut(CamelModel):
    id: uuid.UUID
    period_ref: str
    title_en: str
    title_ta: str
    area_key: str
    starts_at: datetime
    ends_at: datetime


@router.get("/manage/periods", response_model=list[OpenPeriodOut])
def list_periods(staff: Coordinator, db: Db) -> list[OpenPeriodOut]:
    """Declared election periods covering the coordinator's areas, to schedule shifts in."""
    with _answers():
        return [OpenPeriodOut(id=p.id, period_ref=p.period_ref, title_en=p.title_en, title_ta=p.title_ta,
                              area_key=p.area_key, starts_at=p.starts_at, ends_at=p.ends_at) for p in service.periods(db, staff)]


@router.get("/manage/shifts", response_model=list[ShiftOut])
def list_shifts(staff: Coordinator, db: Db, period_id: uuid.UUID | None = None) -> list[ShiftOut]:
    with _answers():
        return [ShiftOut.build(s) for s in service.shifts(db, staff, period_id)]


@router.post("/manage/shifts", status_code=status.HTTP_201_CREATED, response_model=ShiftOut)
def create_shift(body: ShiftIn, staff: Coordinator, request: Request, db: Db) -> ShiftOut:
    values = body.model_dump(exclude={"area", "period_id"})
    with _answers():
        return ShiftOut.build(service.create_shift(db, staff, body.period_id, Area(body.area.level, body.area.code), values,
                                                   client_ip(request)))


@router.get("/manage/shifts/{shift_id}", response_model=ShiftFileOut)
def read_shift(shift_id: uuid.UUID, staff: Coordinator, request: Request, db: Db) -> ShiftFileOut:
    with _answers():
        return _file(service.shift_file(db, staff, shift_id, client_ip(request)))


@router.post("/manage/shifts/{shift_id}/offers", response_model=ShiftFileOut)
def offer(shift_id: uuid.UUID, body: OfferIn, staff: Coordinator, request: Request, db: Db) -> ShiftFileOut:
    with _answers():
        return _file(service.offer(db, staff, shift_id, body.member_code, client_ip(request)))


@router.post("/manage/shifts/{shift_id}/cancel", response_model=ShiftFileOut)
def cancel(shift_id: uuid.UUID, body: ReasonIn, staff: Coordinator, request: Request, db: Db) -> ShiftFileOut:
    with _answers():
        return _file(service.cancel(db, staff, shift_id, body.reason, client_ip(request)))


@router.post("/manage/shifts/{shift_id}/messages", response_model=SentOut)
def message(shift_id: uuid.UUID, body: RosterMessageIn, staff: Coordinator, request: Request, db: Db) -> SentOut:
    """FR-ELX-007: an operational message to the volunteers who accepted this shift."""
    with _answers():
        return SentOut(recipients=service.message(db, staff, shift_id, body.body_en, body.body_ta, client_ip(request)))


@router.get("/periods/{period_id}/report", response_model=PeriodReportOut)
def period_report(period_id: uuid.UUID, staff: ElectionLead, request: Request, db: Db) -> PeriodReportOut:
    """FR-ELX-009: messages sent, roster changes and content published during the period, in its area."""
    with _answers():
        return PeriodReportOut(**service.report(db, staff, period_id, client_ip(request)))


@router.get("/periods/{period_id}/report/entries", response_model=list[PeriodReportEntryOut])
def period_report_entries(period_id: uuid.UUID, staff: ElectionLead, request: Request, db: Db) -> list[PeriodReportEntryOut]:
    """FR-ELX-009: the audit entries behind the report, newest first (at most 500): broadcasts, content
    published and silence blocks in the period's time and area, and every roster change for its shifts."""
    with _answers():
        return [PeriodReportEntryOut.build(e) for e in service.report_entries(db, staff, period_id, client_ip(request))]
