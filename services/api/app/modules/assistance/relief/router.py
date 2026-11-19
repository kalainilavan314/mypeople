"""Relief logistics (BRD S16, D26, FR-DIS-005): /v1/relief, for relief.logistics holders (PRM-54)."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.assistance.relief import rules, service
from app.modules.assistance.relief.schemas import (
    ReliefDistributionIn,
    ReliefDistributionOut,
    ReliefOverviewOut,
    ReliefStockOut,
    ReliefSupplyIn,
    ReliefSupplyOut,
    items,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Officer = Annotated[Staff, Depends(require_permission(rules.PERMISSION))]

# Relief belongs to the disaster module (FR-DIS-005), so it follows the same switch.
router = APIRouter(prefix="/v1/relief", tags=["relief"], dependencies=[Depends(require_feature("disaster_alerts"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ReliefNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.ReliefRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "relief_refused", "problems": error.problems}
        ) from None


@router.get("", response_model=ReliefOverviewOut)
def overview(staff: Officer, db: Db) -> ReliefOverviewOut:
    """The items and the stock of every store in the officer's areas."""
    with _answers():
        return ReliefOverviewOut(items=items(), stock=[ReliefStockOut.build(line) for line in service.stock(db, staff)])


@router.get("/supplies", response_model=list[ReliefSupplyOut])
def list_supplies(staff: Officer, db: Db) -> list[ReliefSupplyOut]:
    with _answers():
        return [ReliefSupplyOut.build(s) for s in service.supplies(db, staff)]


@router.post("/supplies", status_code=status.HTTP_201_CREATED, response_model=ReliefSupplyOut)
def record_supply(body: ReliefSupplyIn, staff: Officer, request: Request, db: Db) -> ReliefSupplyOut:
    with _answers():
        return ReliefSupplyOut.build(service.record_supply(
            db, staff, store=Area(body.store.level, body.store.code), item=body.item, quantity=body.quantity,
            supplier=body.supplier, received_on=body.received_on, alert_id=body.alert_id, ip=client_ip(request),
            now=datetime.now(UTC),
        ))


@router.get("/distributions", response_model=list[ReliefDistributionOut])
def list_distributions(staff: Officer, db: Db) -> list[ReliefDistributionOut]:
    with _answers():
        found = service.distributions(db, staff)
        refs = service.case_refs(db, found)
    return [ReliefDistributionOut.build(d, refs.get(d.case_id) if d.case_id else None) for d in found]


@router.post("/distributions", status_code=status.HTTP_201_CREATED, response_model=ReliefDistributionOut)
def record_distribution(body: ReliefDistributionIn, staff: Officer, request: Request, db: Db) -> ReliefDistributionOut:
    """S16: 422 more_than_in_stock when the store does not hold that much; case_not_found for a reference that
    is not an open case in the officer's area (create one through S11 first)."""
    with _answers():
        recorded = service.record_distribution(
            db, staff, store_key=body.store_key, area=Area(body.area.level, body.area.code), item=body.item,
            quantity=body.quantity,
            recipient=service.Recipient(kind=body.recipient_kind, case_ref=body.case_ref, group_site=body.group_site,
                                        households=body.households),
            evidence=body.evidence, delivered_on=body.delivered_on, alert_id=body.alert_id, ip=client_ip(request),
            now=datetime.now(UTC),
        )
        refs = service.case_refs(db, [recorded])
    return ReliefDistributionOut.build(recorded, refs.get(recorded.case_id) if recorded.case_id else None)
