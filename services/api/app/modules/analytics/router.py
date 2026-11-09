from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.analytics import service
from app.modules.analytics.schemas import OperationsOut

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])

Db = Annotated[Session, Depends(get_db)]
CanView = Annotated[Staff, Depends(require_permission(service.VIEW))]


@router.get("/operations")
def read_operations(
    staff: CanView,
    db: Db,
    period_days: Annotated[Literal[7, 30, 90], Query(alias="periodDays")] = 30,
) -> OperationsOut:
    """D32: registration completion, verification turnaround, the review queue and event attendance in
    the viewer's areas (needs analytics.view, PRM-24). Counts only; groups of 1 to 9 people are hidden."""
    return OperationsOut.build(service.operations(db, staff, period_days=period_days))
