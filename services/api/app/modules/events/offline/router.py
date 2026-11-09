import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.events import service as events
from app.modules.events.offline import service
from app.modules.events.offline.schemas import (
    OfflineSyncIn,
    OfflineSyncOut,
    ScanDecisionIn,
    ScanExceptionOut,
    ScannerDeviceIn,
    ScanOutcomeOut,
)
from app.modules.events.rules import MANAGE, SCAN

router = APIRouter(prefix="/v1/events", tags=["events"])

Db = Annotated[Session, Depends(get_db)]
CanScan = Annotated[Staff, Depends(require_permission(SCAN))]
CanManage = Annotated[Staff, Depends(require_permission(MANAGE))]

REFUSED = {403: {"description": "forbidden, outside_your_area or device_not_registered"}, 404: {"description": "not_found"}}


def _secret(request: Request) -> str:
    return request.app.state.settings.jwt_secret.get_secret_value()


def _forbidden(code: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=code)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


@router.post("/scanner-devices", status_code=status.HTTP_204_NO_CONTENT, responses={403: {"description": "device_not_yours"}})
def register_scanner_device(body: ScannerDeviceIn, staff: CanScan, request: Request, db: Db) -> None:
    """Bind this staff phone for offline check-in (MP-DEC-001 4.4); needs events.checkin_scan."""
    try:
        service.register_device(db, staff, body.device_id, body.device_key, body.label, client_ip(request))
    except service.DeviceRefused as error:
        raise _forbidden(error.code) from None


@router.post("/{event_id}/checkin/offline", responses=REFUSED)
def sync_offline_scans(event_id: uuid.UUID, body: OfflineSyncIn, staff: CanScan, request: Request, db: Db) -> OfflineSyncOut:
    """Judge scans this phone queued without a connection, each as at the time it was recorded.
    Sending a scan again returns its first outcome; nothing the phone decided is final."""
    try:
        outcomes = service.sync(
            db, staff, event_id, body.device_id, body.device_key, [scan.queued() for scan in body.scans], _secret(request), client_ip(request)
        )
    except events.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error.code) from None
    except service.DeviceRefused as error:
        raise _forbidden(error.code) from None
    return OfflineSyncOut(outcomes=[ScanOutcomeOut.build(outcome) for outcome in outcomes])


@router.get("/{event_id}/checkin/exceptions", responses=REFUSED)
def read_scan_exceptions(event_id: uuid.UUID, staff: CanManage, request: Request, db: Db) -> list[ScanExceptionOut]:
    """Queued scans waiting for a person, oldest first; for the event managers who settle them (events.manage)."""
    try:
        return [ScanExceptionOut.build(scan) for scan in service.exceptions(db, staff, event_id, client_ip(request))]
    except events.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error.code) from None


@router.post(
    "/checkin/exceptions/{scan_event_id}/decision",
    responses={**REFUSED, 409: {"description": "already_settled, own_scan or pass_<reason>"}},
)
def decide_scan_exception(
    scan_event_id: uuid.UUID, body: ScanDecisionIn, staff: CanManage, request: Request, db: Db
) -> ScanOutcomeOut:
    """Accept or reject a waiting scan with a reason (needs events.manage; never the person who
    scanned it). Accepting still needs a genuine pass for the event as at the recorded time."""
    try:
        outcome = service.decide(db, staff, scan_event_id, body.decision, body.reason, _secret(request), client_ip(request))
    except (service.ScanNotFound, events.EventNotFound):
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error.code) from None
    except service.DecisionRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    return ScanOutcomeOut.build(outcome)
