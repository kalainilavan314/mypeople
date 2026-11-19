"""Assisted identity verification (BRD M05, S04, FR-IDV-014, FR-STF-004): /v1/identity/assisted. Answers 404
while the assisted_verification module is off."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.identity.assisted import service
from app.modules.identity.assisted.rules import OPEN_STATES, STAFF_PERMISSIONS, VERIFY, State
from app.modules.identity.assisted.schemas import (
    AssistedAbandonIn,
    AssistedHelpRequestIn,
    AssistedHelpRequestOut,
    AssistedCloseIn,
    AssistedCompleteIn,
    MyAssistedOut,
    AssistedQueueItemOut,
    AssistedRequestFileOut,
    AssistedReviewSessionOut,
    AssistedScheduleIn,
    AssistedSessionOut,
    AssistedStartIn,
)

Db = Annotated[Session, Depends(get_db)]
Assister = Annotated[Staff, Depends(require_permission(*STAFF_PERMISSIONS))]
Reviewer = Annotated[Staff, Depends(require_permission(VERIFY))]
REFUSED = {
    403: {"description": "forbidden, own_record or outside_your_area"},
    404: {"description": "not_found"},
    409: {"description": "not_your_session"},
    422: {"description": '{"code": "assisted_refused", "problems": [...]}'},
}

router = APIRouter(prefix="/v1/identity/assisted", tags=["assisted verification"],
                   dependencies=[Depends(require_feature("assisted_verification"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.AssistedNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.AssistedConflict as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    except service.AssistedRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "assisted_refused", "problems": error.problems},
        ) from None


# --- The member (M05) ----------------------------------------------------------------------------------------


@router.get("/me")
def read_my_request(member: CurrentMember, db: Db) -> MyAssistedOut:
    """M05: the member's latest request for help, and what they need before asking."""
    return MyAssistedOut.build(service.my_assisted(db, member.id))


@router.post("/me", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def request_help(body: AssistedHelpRequestIn, member: CurrentMember, request: Request, db: Db) -> AssistedHelpRequestOut:
    """FR-IDV-014: no camera, three failed checks, or the member asks. Problems: already_verified, review_open,
    contact_not_confirmed, preferred_date_out_of_range. An open request is returned again, not duplicated."""
    with _answers():
        return AssistedHelpRequestOut.build(service.request_help(
            db, member.id, reason=body.reason, route=body.route, preferred_date=body.preferred_date,
            preferred_time=body.preferred_time, ip=client_ip(request),
        ))


@router.post("/me/cancel", responses=REFUSED)
def cancel_my_request(member: CurrentMember, request: Request, db: Db) -> AssistedHelpRequestOut:
    """Before a session has started."""
    with _answers():
        return AssistedHelpRequestOut.build(service.cancel(db, member.id, client_ip(request)))


# --- Staff (S04) -----------------------------------------------------------------------------------------------


@router.get("/manage", responses=REFUSED)
def list_requests(
    staff: Assister,
    db: Db,
    state: Annotated[list[State] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AssistedQueueItemOut]:
    """S04 queue: requests in the caller's areas, open ones by default, longest waiting first."""
    states = list(state) if state else list(OPEN_STATES)
    return [AssistedQueueItemOut(**AssistedHelpRequestOut.build(r).model_dump()) for r in service.queue(db, staff, states, limit)]


@router.get("/manage/{request_id}", responses=REFUSED)
def read_request(request_id: uuid.UUID, staff: Assister, request: Request, db: Db) -> AssistedRequestFileOut:
    """The member to meet, their confirmed number while the request is open (each opening is recorded),
    which images the server holds (kinds and times only) and the sessions so far."""
    with _answers():
        return AssistedRequestFileOut.from_file(service.request_file(db, staff, request_id, client_ip(request)), staff.member_id)


@router.post("/manage/{request_id}/schedule", responses=REFUSED)
def schedule(request_id: uuid.UUID, body: AssistedScheduleIn, staff: Assister, request: Request, db: Db) -> AssistedRequestFileOut:
    with _answers():
        service.schedule(db, staff, request_id, body.scheduled_for, body.meeting_place, client_ip(request))
        return AssistedRequestFileOut.from_file(service.request_file(db, staff, request_id, client_ip(request)), staff.member_id)


@router.post("/manage/{request_id}/sessions", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def start_session(request_id: uuid.UUID, body: AssistedStartIn, staff: Assister, request: Request,
                  db: Db) -> AssistedSessionOut:
    """Start: the caller becomes the witness. The member then takes the photos in their own app."""
    with _answers():
        return AssistedSessionOut.build(service.start_session(db, staff, request_id, body.device, client_ip(request)),
                                staff.member_id)


@router.post("/manage/{request_id}/sessions/{session_id}/complete", responses=REFUSED)
def complete_session(request_id: uuid.UUID, session_id: uuid.UUID, body: AssistedCompleteIn, staff: Assister,
                     request: Request, db: Db) -> AssistedRequestFileOut:
    """FR-STF-004: refused (checklist_incomplete:<item>, missing:<kind>, consent_required) until everything
    is in place; then the images go to the normal identity review, which someone else decides."""
    with _answers():
        file = service.complete_session(db, staff, request_id, session_id, list(body.checklist), body.notes,
                                        client_ip(request))
        return AssistedRequestFileOut.from_file(file, staff.member_id)


@router.post("/manage/{request_id}/sessions/{session_id}/abandon", responses=REFUSED)
def abandon_session(request_id: uuid.UUID, session_id: uuid.UUID, body: AssistedAbandonIn, staff: Assister,
                    request: Request, db: Db) -> AssistedRequestFileOut:
    """A camera that fails moves the member to the office-visit route; a member who declines closes the request."""
    with _answers():
        service.abandon_session(db, staff, request_id, session_id, body.reason, body.notes, client_ip(request))
        return AssistedRequestFileOut.from_file(service.request_file(db, staff, request_id, client_ip(request)), staff.member_id)


@router.post("/manage/{request_id}/close", responses=REFUSED)
def close_request(request_id: uuid.UUID, body: AssistedCloseIn, staff: Assister, request: Request, db: Db) -> AssistedRequestFileOut:
    with _answers():
        service.close(db, staff, request_id, body.reason, client_ip(request))
        return AssistedRequestFileOut.from_file(service.request_file(db, staff, request_id, client_ip(request)), staff.member_id)


@router.get("/reviews/{review_id}", responses=REFUSED)
def read_review_sessions(review_id: uuid.UUID, staff: Reviewer, request: Request, db: Db) -> list[AssistedReviewSessionOut]:
    """W02: how the images in this review were captured, for the reviewer deciding it."""
    with _answers():
        return [
            AssistedReviewSessionOut(**AssistedSessionOut.build(s).model_dump(), request_ref=ref)
            for s, ref in service.sessions_for_review(db, staff, review_id, client_ip(request))
        ]
