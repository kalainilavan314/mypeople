import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.messaging.broadcasts import service
from app.modules.messaging.broadcasts.rules import SEND
from app.modules.messaging.broadcasts.schemas import (
    BroadcastCreateIn,
    BroadcastOut,
    BroadcastPreviewOut,
    BroadcastSubmitIn,
    BroadcastUpdateIn,
)

router = APIRouter(prefix="/v1/notifications/broadcasts", tags=["notifications"])

Db = Annotated[Session, Depends(get_db)]
CanSend = Annotated[Staff, Depends(require_permission(SEND))]

REFUSED = {403: {"description": "forbidden or outside_your_area"}, 404: {"description": "not_found"}}


def _errors(error: Exception) -> HTTPException:
    if isinstance(error, service.BroadcastNotFound):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    if isinstance(error, AccessRefused):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)
    if isinstance(error, service.BroadcastRefused):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)
    assert isinstance(error, service.BroadcastInvalid)
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "broadcast_invalid", "problems": error.problems}
    )


HANDLED = (service.BroadcastNotFound, AccessRefused, service.BroadcastRefused, service.BroadcastInvalid)


@router.get("")
def list_broadcasts(
    staff: CanSend,
    db: Db,
    state: Annotated[list[Literal["draft", "pending_approval", "scheduled", "sent", "cancelled"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[BroadcastOut]:
    """Broadcasts in the caller's areas, newest first."""
    states = list(state) if state else ["draft", "pending_approval", "scheduled"]
    return [BroadcastOut.build(b) for b in service.managed(db, staff, states, limit)]


@router.post("", status_code=status.HTTP_201_CREATED, responses={**REFUSED, 422: {"description": "broadcast_invalid"}})
def create_broadcast(body: BroadcastCreateIn, staff: CanSend, request: Request, db: Db) -> BroadcastOut:
    """A bilingual draft for an area inside the caller's own scope (FR-ADM-007, BR-083)."""
    try:
        broadcast = service.create(
            db, staff, body.model_dump(exclude={"area"}), Area(body.area.level, body.area.code), client_ip(request)
        )
    except HANDLED as error:
        raise _errors(error) from None
    return BroadcastOut.build(broadcast)


@router.patch("/{broadcast_id}", responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}})
def update_broadcast(broadcast_id: uuid.UUID, body: BroadcastUpdateIn, staff: CanSend, request: Request, db: Db) -> BroadcastOut:
    try:
        broadcast = service.update(db, staff, broadcast_id, body.model_dump(exclude_unset=True), client_ip(request))
    except HANDLED as error:
        raise _errors(error) from None
    return BroadcastOut.build(broadcast)


@router.post("/{broadcast_id}/preview", responses=REFUSED)
def preview_broadcast(broadcast_id: uuid.UUID, staff: CanSend, request: Request, db: Db) -> BroadcastPreviewOut:
    """How many members it reaches and anything that would stop it, before sending."""
    try:
        return BroadcastPreviewOut.from_preview(service.preview(db, staff, broadcast_id, client_ip(request)))
    except HANDLED as error:
        raise _errors(error) from None


@router.post(
    "/{broadcast_id}/submit",
    responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}, 422: {"description": "broadcast_invalid"}},
)
def submit_broadcast(
    broadcast_id: uuid.UUID, body: BroadcastSubmitIn, staff: CanSend, request: Request, db: Db
) -> BroadcastOut:
    """Schedule it (now, or at sendAt). Wider than a district, it waits for approval first."""
    try:
        broadcast = service.submit(db, staff, broadcast_id, body.send_at, client_ip(request))
    except HANDLED as error:
        raise _errors(error) from None
    return BroadcastOut.build(broadcast)


@router.post(
    "/{broadcast_id}/approve",
    responses={**REFUSED, 409: {"description": "not_allowed_from:<state>, own_submission or approver_tier_too_low"}},
)
def approve_broadcast(broadcast_id: uuid.UUID, staff: CanSend, request: Request, db: Db) -> BroadcastOut:
    """By a Tier 4 or 5 holder over the area who did not submit it."""
    try:
        broadcast = service.approve(db, staff, broadcast_id, client_ip(request))
    except HANDLED as error:
        raise _errors(error) from None
    return BroadcastOut.build(broadcast)


@router.post("/{broadcast_id}/cancel", responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}})
def cancel_broadcast(broadcast_id: uuid.UUID, staff: CanSend, request: Request, db: Db) -> BroadcastOut:
    try:
        broadcast = service.cancel(db, staff, broadcast_id, client_ip(request))
    except HANDLED as error:
        raise _errors(error) from None
    return BroadcastOut.build(broadcast)
