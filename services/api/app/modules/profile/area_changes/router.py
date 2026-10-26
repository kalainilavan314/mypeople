import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.identity.documents.dependencies import Image, Vault
from app.modules.identity.documents.router import EVIDENCE_HEADERS, IMAGE_BODY
from app.modules.identity.documents.vault import EvidenceUnreadable
from app.modules.profile.area_changes import service
from app.modules.profile.schemas import AreaChangeIn, AreaChangeOut, AreaDecisionIn, QueuedAreaChangeOut

router = APIRouter(prefix="/v1/profile/area-changes", tags=["profile"])

Db = Annotated[Session, Depends(get_db)]
CanReview = Annotated[Staff, Depends(require_permission(service.REVIEW))]

NOT_FOUND = {404: {"description": "not_found"}}
NOT_CONFIGURED = {503: {"description": "evidence_storage_not_configured"}}


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


def _conflict(error: service.ChangeRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


# --- The member (P02) ---------------------------------------------------------------------------------


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses={409: {"description": "request_open, same_area or unknown_area"}},
)
def request_area_change(body: AreaChangeIn, member: CurrentMember, request: Request, db: Db) -> AreaChangeOut:
    """Ask to move to another GN division; upload proof of residence next. The current area stays
    until a reviewer approves (FR-PROF-005, BR-076)."""
    try:
        return AreaChangeOut.build(service.request_change(db, member.id, body.gn_code, client_ip(request)))
    except service.ChangeRefused as error:
        raise _conflict(error) from None


@router.get("/mine")
def list_my_area_changes(member: CurrentMember, db: Db) -> list[AreaChangeOut]:
    return [AreaChangeOut.build(change) for change in service.my_changes(db, member.id)]


@router.put(
    "/{change_id}/proof",
    openapi_extra=IMAGE_BODY,
    responses={
        **NOT_FOUND,
        409: {"description": "not_awaiting_proof"},
        413: {"description": "too_large"},
        415: {"description": "unsupported_type (JPEG, PNG or HEIC)"},
        **NOT_CONFIGURED,
    },
)
def attach_proof(
    change_id: uuid.UUID, image: Image, vault: Vault, member: CurrentMember, request: Request, db: Db
) -> AreaChangeOut:
    """Proof of residence, kept encrypted; this sends the request for review."""
    try:
        return AreaChangeOut.build(service.attach_proof(db, vault, member.id, change_id, image, client_ip(request)))
    except service.ChangeNotFound:
        raise _not_found() from None
    except service.ChangeRefused as error:
        raise _conflict(error) from None


@router.post("/{change_id}/withdraw", responses={**NOT_FOUND, 409: {"description": "not_open"}})
def withdraw(change_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> AreaChangeOut:
    try:
        return AreaChangeOut.build(service.withdraw(db, member.id, change_id, client_ip(request)))
    except service.ChangeNotFound:
        raise _not_found() from None
    except service.ChangeRefused as error:
        raise _conflict(error) from None


# --- Reviewers ------------------------------------------------------------------------------------------


@router.get("")
def list_area_changes(
    staff: CanReview,
    db: Db,
    state: Annotated[list[Literal["submitted", "awaiting_proof", "approved", "declined", "withdrawn"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[QueuedAreaChangeOut]:
    """Requests to move into the caller's areas, oldest submitted first. Needs members.verify."""
    states = list(state) if state else ["submitted"]
    return [QueuedAreaChangeOut.queued(change) for change in service.queue(db, staff, states, limit)]


@router.get(
    "/{change_id}/proof",
    response_class=Response,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}, "image/heic": {}}}, 403: {"description": "own_record or outside_your_area"}, **NOT_FOUND, **NOT_CONFIGURED},
)
def read_proof(change_id: uuid.UUID, staff: CanReview, vault: Vault, request: Request, db: Db) -> Response:
    """The proof of residence, shown to a reviewer over the requested area; every opening is logged."""
    try:
        data, media_type = service.open_proof(db, vault, staff, change_id, client_ip(request))
    except (service.ChangeNotFound, EvidenceUnreadable):
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return Response(content=data, media_type=media_type, headers=EVIDENCE_HEADERS)


@router.post(
    "/{change_id}/decision",
    responses={403: {"description": "own_record or outside_your_area"}, **NOT_FOUND, 409: {"description": "not_submitted"}},
)
def decide(change_id: uuid.UUID, body: AreaDecisionIn, staff: CanReview, request: Request, db: Db) -> AreaChangeOut:
    """Approve (the member's area changes now) or decline, with a reason the member sees."""
    try:
        return AreaChangeOut.build(service.decide(db, staff, change_id, body.decision, body.reason, client_ip(request)))
    except service.ChangeNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ChangeRefused as error:
        raise _conflict(error) from None
