import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.election import service
from app.modules.election.rules import MANAGE
from app.modules.election.schemas import (
    CloseIn,
    DeclaredOut,
    ElectionBannerOut,
    ElectionNoticeOut,
    NoticeIn,
    PeriodFileOut,
    PeriodIn,
    PeriodOut,
    PeriodState,
)
from app.modules.features.dependencies import require_feature

# Declaring periods and their silence windows is Phase 1 (NFR-ELC-01, 03); what members see is the
# election_mode feature (FR-ELX, Phase 2), off in production until its gate is recorded.
router = APIRouter(prefix="/v1/election", tags=["election"])
member_router = APIRouter(
    prefix="/v1/election", tags=["election"], dependencies=[Depends(require_feature("election_mode"))]
)

Db = Annotated[Session, Depends(get_db)]
CanManage = Annotated[Staff, Depends(require_permission(MANAGE))]

REFUSED = {
    403: {"description": "forbidden or outside_your_area"},
    404: {"description": "not_found"},
    409: {"description": "not_allowed_from:<state> or already_withdrawn"},
}


def _errors(error: Exception) -> HTTPException:
    if isinstance(error, service.PeriodNotFound):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if isinstance(error, AccessRefused):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)
    if isinstance(error, service.ElectionRefused):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)
    assert isinstance(error, service.ElectionInvalid)
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "election_invalid", "problems": error.problems}
    )


HANDLED = (service.PeriodNotFound, AccessRefused, service.ElectionRefused, service.ElectionInvalid)


@member_router.get("/current")
def read_current_elections(member: CurrentMember, db: Db) -> list[ElectionBannerOut]:
    """Elections running for the member's area: date, countdown, official source and notices (FR-ELX-001, 004)."""
    return [ElectionBannerOut.build(current) for current in service.current_for_member(db, member.id)]


@router.get("/periods")
def list_periods(
    staff: CanManage,
    db: Db,
    state: Annotated[list[PeriodState] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[PeriodOut]:
    """Declared periods by default, latest start first. Needs election.mode.manage."""
    return [PeriodOut.build(p) for p in service.managed_periods(db, staff, list(state) if state else ["declared"], limit)]


@router.post("/periods", status_code=status.HTTP_201_CREATED, responses={**REFUSED, 422: {"description": "election_invalid"}})
def declare_period(body: PeriodIn, staff: CanManage, request: Request, db: Db) -> DeclaredOut:
    """Declare a period with its own silence window from an Election Commission publication (NFR-ELC-01).
    Overlapping periods are allowed (NFR-ELC-05) and listed as a warning."""
    try:
        declared = service.declare(
            db, staff, body.model_dump(exclude={"area"}), Area(body.area.level, body.area.code), client_ip(request)
        )
    except HANDLED as error:
        raise _errors(error) from None
    return DeclaredOut.from_declared(declared)


@router.get("/periods/{period_id}", responses=REFUSED)
def read_period(period_id: uuid.UUID, staff: CanManage, request: Request, db: Db) -> PeriodFileOut:
    """The period and every notice published for it, withdrawn ones included."""
    try:
        return PeriodFileOut.from_file(service.period_file(db, staff, period_id, client_ip(request)))
    except HANDLED as error:
        raise _errors(error) from None


@router.post("/periods/{period_id}/close", responses=REFUSED)
def close_period(period_id: uuid.UUID, body: CloseIn, staff: CanManage, request: Request, db: Db) -> PeriodOut:
    """End the period, or withdraw it if declared in error; its silence controls stop at once."""
    try:
        return PeriodOut.build(service.close(db, staff, period_id, body.action, body.reason, client_ip(request)))
    except HANDLED as error:
        raise _errors(error) from None


@router.post(
    "/periods/{period_id}/notices",
    status_code=status.HTTP_201_CREATED,
    responses={**REFUSED, 422: {"description": "election_invalid: official_source_required"}},
)
def publish_notice(period_id: uuid.UUID, body: NoticeIn, staff: CanManage, request: Request, db: Db) -> ElectionNoticeOut:
    """Election Commission information needs its link, document reference and publication time (NFR-ELC-06)."""
    try:
        return ElectionNoticeOut.build(
            service.publish_notice(db, staff, period_id, body.model_dump(), client_ip(request))
        )
    except HANDLED as error:
        raise _errors(error) from None


@router.post("/notices/{notice_id}/withdraw", responses=REFUSED)
def withdraw_notice(notice_id: uuid.UUID, staff: CanManage, request: Request, db: Db) -> ElectionNoticeOut:
    """When the source is superseded (NFR-ELC-06)."""
    try:
        return ElectionNoticeOut.build(service.withdraw_notice(db, staff, notice_id, client_ip(request)))
    except HANDLED as error:
        raise _errors(error) from None
