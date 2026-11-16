import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.community.reports import service
from app.modules.community.reports.schemas import (
    CommunityReportListOut,
    CommunityReportsQueueCount,
    CommunityReportSummaryOut,
)
from app.modules.community.reports.service import InvalidReportState

router = APIRouter(prefix="/v1/community/reports", tags=["community-reports"])

Db = Annotated[Session, Depends(get_db)]
CanViewReports = Annotated[Staff, Depends(require_permission("reports.view"))]


@router.get("/counts", response_model=CommunityReportsQueueCount)
def get_report_counts(
    staff: CanViewReports,
    db: Db,
) -> CommunityReportsQueueCount:
    """Lightweight aggregate actionable report counts for D01 operational work queues."""
    try:
        return service.queue_counts(db, staff)
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


@router.get("", response_model=CommunityReportListOut)
def list_reports(
    staff: CanViewReports,
    request: Request,
    db: Db,
    report_status: str | None = Query(default=None, alias="status", max_length=40),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=100000),
) -> CommunityReportListOut:
    """Bounded, paginated list of area-scoped community reports."""
    ip = client_ip(request)
    try:
        items, total = service.list_reports(
            db,
            staff,
            status=report_status,
            limit=limit,
            offset=offset,
            ip=ip,
        )
        return CommunityReportListOut(
            items=[
                CommunityReportSummaryOut(
                    id=item.id,
                    category=item.category,
                    title=item.title,
                    description=item.description,
                    district_code=item.district_code,
                    ds_code=item.ds_code,
                    gs_code=item.gs_code,
                    area_path=item.area_path,
                    priority=item.priority,
                    status=item.status,  # type: ignore[arg-type]
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total=total,
            limit=limit,
            offset=offset,
        )
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)
    except InvalidReportState:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_state")


@router.get("/{report_id}", response_model=CommunityReportSummaryOut, responses={404: {"description": "not_found"}})
def get_report(report_id: uuid.UUID, staff: CanViewReports, request: Request, db: Db) -> CommunityReportSummaryOut:
    """One area-scoped report, audited without returning reporter identity or contact data."""
    try:
        item = service.get_report(db, staff, report_id, client_ip(request))
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ReportNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    return CommunityReportSummaryOut(
        id=item.id,
        category=item.category,
        title=item.title,
        description=item.description,
        district_code=item.district_code,
        ds_code=item.ds_code,
        gs_code=item.gs_code,
        area_path=item.area_path,
        priority=item.priority,
        status=item.status,  # type: ignore[arg-type]
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
