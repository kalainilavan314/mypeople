import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.reviews import service as verification
from app.modules.identity.reviews.schemas import DecisionOut, MyReviewOut, ReviewMemberOut, ReviewSummaryOut
from app.modules.identity.appeals import service
from app.modules.identity.appeals.rules import APPEAL_DECIDE, AppealState
from app.modules.identity.appeals.schemas import (
    AppealDecisionInput,
    AppealFileOut,
    AppealInput,
    AppealSummaryOut,
)

router = APIRouter(
    prefix="/v1/identity", tags=["verification appeals"], dependencies=[Depends(require_feature("identity_appeals"))]
)

Db = Annotated[Session, Depends(get_db)]
CanDecideAppeals = Annotated[Staff, Depends(require_permission(APPEAL_DECIDE))]

OPEN_STATES: list[AppealState] = ["submitted", "in_review"]
REFUSED = {
    403: {"description": "forbidden, own_record or outside_your_area"},
    404: {"description": "not_found"},
    409: {"description": "not_open, original_reviewer, claimed_by_another or not_claimed_by_you"},
}


def _refused(error: AccessRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


def _conflict(error: service.AppealConflict) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


@router.post(
    "/me/review/appeal",
    responses={409: {"description": '{"code": "appeal_refused", "problems": ["nothing_to_appeal" | "appeal_used"]}'}},
)
def appeal_my_decision(body: AppealInput, member: CurrentMember, request: Request, db: Db) -> MyReviewOut:
    """Appeal the latest Request-update or Unable-to-verify decision, once (M04, FR-IDV-013).

    Someone other than the original reviewer decides. Until then the member
    cannot submit again.
    """
    try:
        service.submit(db, member.id, body.statement, client_ip(request))
    except service.AppealRefused as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail={"code": "appeal_refused", "problems": error.problems}
        ) from None
    mine = verification.my_review(db, member.id)
    assert mine is not None
    return MyReviewOut.from_stored(*mine)


@router.get("/appeals")
def list_appeals(
    staff: CanDecideAppeals,
    db: Db,
    state: Annotated[list[AppealState] | None, Query()] = None,
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[AppealSummaryOut]:
    """D05: appeals in the caller's areas, oldest first. Open appeals unless states are given."""
    appeals = service.queue(db, staff, states=list(state or OPEN_STATES), mine=mine, limit=limit)
    return [AppealSummaryOut.from_stored(appeal) for appeal in appeals]


def _file(db: Session, staff: Staff, appeal_id: uuid.UUID, request: Request) -> AppealFileOut:
    try:
        appeal_file = service.appeal_file(db, staff, appeal_id, client_ip(request))
    except service.AppealNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    appeal = appeal_file.appeal
    return AppealFileOut(
        **AppealSummaryOut.from_stored(appeal).model_dump(),
        statement=appeal.statement,
        decided_by=appeal.decided_by,
        decider_tier=appeal.decider_tier,  # type: ignore[arg-type]
        outcome_reason=appeal.outcome_reason,
        decision=DecisionOut.from_stored(appeal_file.decision, [appeal]),
        review=ReviewSummaryOut.from_stored(appeal_file.review),
        member=ReviewMemberOut.from_stored(appeal_file.member),
        documents=[DocumentOut.from_stored(d) for d in appeal_file.documents],
    )


@router.get("/appeals/{appeal_id}", responses=REFUSED)
def read_appeal(appeal_id: uuid.UUID, staff: CanDecideAppeals, request: Request, db: Db) -> AppealFileOut:
    """One appeal for D05: the member's statement, the decision under appeal and the image records."""
    return _file(db, staff, appeal_id, request)


@router.post("/appeals/{appeal_id}/claim", responses=REFUSED)
def claim_appeal(appeal_id: uuid.UUID, staff: CanDecideAppeals, request: Request, db: Db) -> AppealFileOut:
    """Take the appeal. Never the original reviewer (PRM-29). While held, its evidence opens to the caller."""
    try:
        service.claim(db, staff, appeal_id, client_ip(request))
    except service.AppealNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.AppealConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, appeal_id, request)


@router.post("/appeals/{appeal_id}/release", responses=REFUSED)
def release_appeal(appeal_id: uuid.UUID, staff: CanDecideAppeals, request: Request, db: Db) -> AppealFileOut:
    try:
        service.release(db, staff, appeal_id, client_ip(request))
    except service.AppealNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.AppealConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, appeal_id, request)


@router.post("/appeals/{appeal_id}/decision", responses=REFUSED)
def decide_appeal(
    appeal_id: uuid.UUID, body: AppealDecisionInput, staff: CanDecideAppeals, request: Request, db: Db
) -> AppealFileOut:
    """Uphold or overturn the decision, with a reason the member sees (FR-IDV-013). Final.

    Overturning sends the review back to the queue for a fresh decision by
    someone other than the original reviewer.
    """
    try:
        service.decide(db, staff, appeal_id, body.outcome, body.reason, client_ip(request))
    except service.AppealNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.AppealConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, appeal_id, request)
