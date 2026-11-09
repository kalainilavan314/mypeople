from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.analytics import service
from app.modules.analytics.schemas import OperationsOut

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])

Db = Annotated[Session, Depends(get_db)]
CanView = Annotated[Staff, Depends(require_permission(service.VIEW))]


@router.get("/operations", responses={422: {"description": "period_days_must_be_7_30_or_90"}})
def read_operations(
    staff: CanView,
    db: Db,
    period_days: Annotated[int, Query(alias="periodDays", description="7, 30 or 90")] = 30,
) -> OperationsOut:
    """D32: registration completion, verification turnaround, the review queue and event attendance in
    the viewer's areas (needs analytics.view, PRM-24). Counts only; groups of 1 to 9 people are hidden."""
    # A query value arrives as text, so it is read as a number and then held to the three periods.
    if period_days not in service.PERIODS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="period_days_must_be_7_30_or_90")
    return OperationsOut.build(service.operations(db, staff, period_days=period_days))
