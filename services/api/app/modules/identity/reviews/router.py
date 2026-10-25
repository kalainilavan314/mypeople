import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.reviews import service
from app.modules.identity.reviews.rules import VERIFY, ReviewState
from app.modules.identity.reviews.schemas import (
    DecisionInput,
    DecisionOut,
    DuplicateFlagOut,
    MyReviewOut,
    QueueCountsOut,
    ReviewFileOut,
    ReviewMemberOut,
    ReviewSummaryOut,
    SubmissionInput,
)

router = APIRouter(prefix="/v1/identity", tags=["verification"])

Db = Annotated[Session, Depends(get_db)]
CanVerify = Annotated[Staff, Depends(require_permission(VERIFY))]

OPEN_STATES: list[ReviewState] = ["submitted", "in_review", "needs_update"]
REFUSED = {
    403: {"description": "forbidden, own_record or outside_your_area"},
    404: {"description": "not_found"},
    409: {"description": "not_open, claimed_by_another or not_claimed_by_you"},
}


def _refused(error: AccessRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


def _conflict(error: service.ReviewConflict) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


@router.post(
    "/me/review",
    responses={409: {"description": '{"code": "submission_refused", "problems": [...]}'}},
)
def submit_my_review(body: SubmissionInput, member: CurrentMember, request: Request, db: Db) -> MyReviewOut:
    """Send the identity images for team review (A09), or a correction back to the same review (A11).

    Needs every image of the route already received (NIC: front, back and
    selfie; passport: photo page and selfie) and the declaration (BR-011).
    Sending again while the review is open returns the same review.
    """
    try:
        review = service.submit(db, member.id, body.route, client_ip(request))
    except service.SubmissionRefused as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail={"code": "submission_refused", "problems": error.problems}
        ) from None
    mine = service.my_review(db, member.id)
    assert mine is not None and mine[0].id == review.id
    return MyReviewOut.from_stored(*mine)


@router.get("/me/review")
def read_my_review(member: CurrentMember, db: Db) -> MyReviewOut | None:
    """The member's latest identity review: reference, state and decisions (A10, A11, C06, P03).
    null before the first submission. Reviewers are shown by tier only."""
    mine = service.my_review(db, member.id)
    return MyReviewOut.from_stored(*mine) if mine else None


@router.get("/reviews")
def list_reviews(
    staff: CanVerify,
    db: Db,
    state: Annotated[list[ReviewState] | None, Query()] = None,
    mine: bool = False,
    ref: Annotated[str | None, Query(max_length=20, description="A review reference, e.g. VR-00421")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[ReviewSummaryOut]:
    """W01: identity reviews in the caller's areas, oldest waiting first (FR-WEB-001, 002).
    Open reviews unless states are given; mine=true for the caller's claimed reviews."""
    reviews = service.queue(db, staff, states=list(state or OPEN_STATES), mine=mine, review_ref=ref, limit=limit)
    return [ReviewSummaryOut.from_stored(review) for review in reviews]


@router.get("/reviews/counts")
def count_reviews(staff: CanVerify, db: Db) -> QueueCountsOut:
    """The W01 counts: awaiting review, needs update, assigned to me (FR-WEB-001)."""
    counts = service.queue_counts(db, staff)
    return QueueCountsOut(
        awaiting_review=counts.awaiting_review, needs_update=counts.needs_update, assigned_to_me=counts.assigned_to_me
    )


def _file(db: Session, staff: Staff, review_id: uuid.UUID, request: Request) -> ReviewFileOut:
    try:
        review_file = service.review_file(db, staff, review_id, client_ip(request))
    except service.ReviewNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    return ReviewFileOut(
        **ReviewSummaryOut.from_stored(review_file.review).model_dump(),
        member=ReviewMemberOut.from_stored(review_file.member),
        documents=[DocumentOut.from_stored(d) for d in review_file.documents],
        decisions=[DecisionOut.from_stored(d, review_file.appeals) for d in review_file.decisions],
        duplicate_flags=[
            DuplicateFlagOut.from_case(case, review_file.review.member_id) for case in review_file.duplicate_cases
        ],
    )


@router.get("/reviews/{review_id}", responses=REFUSED)
def read_review(review_id: uuid.UUID, staff: CanVerify, request: Request, db: Db) -> ReviewFileOut:
    """One review for W02: the member's details, which images exist and every decision so far."""
    return _file(db, staff, review_id, request)


@router.post("/reviews/{review_id}/claim", responses=REFUSED)
def claim_review(review_id: uuid.UUID, staff: CanVerify, request: Request, db: Db) -> ReviewFileOut:
    """Take the review (FR-WEB-003). While the caller holds it in review, they can open its evidence (PRM-03)."""
    try:
        service.claim(db, staff, review_id, client_ip(request))
    except service.ReviewNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.ReviewConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, review_id, request)


@router.post("/reviews/{review_id}/release", responses=REFUSED)
def release_review(review_id: uuid.UUID, staff: CanVerify, request: Request, db: Db) -> ReviewFileOut:
    """Give a claimed review back to the queue; its evidence closes for the caller."""
    try:
        service.release(db, staff, review_id, client_ip(request))
    except service.ReviewNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.ReviewConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, review_id, request)


@router.post(
    "/reviews/{review_id}/decision",
    responses={**REFUSED, 422: {"description": '{"code": "decision_refused", "problems": [...]}'}},
)
def decide_review(
    review_id: uuid.UUID, body: DecisionInput, staff: CanVerify, request: Request, db: Db
) -> ReviewFileOut:
    """Approve identity, request an update or record unable to verify (FR-WEB-008 to 011).

    Only the reviewer holding the review decides. Approve needs every
    checklist item and every required image opened by this reviewer.
    Approval confirms identity only; membership is a separate decision (BR-014).
    """
    decision = service.DecisionInput(
        decision=body.decision,
        checklist=body.checklist,
        items=body.items,
        reason_category=body.reason_category,
        note=body.note,
    )
    try:
        service.decide(db, staff, review_id, decision, client_ip(request))
    except service.ReviewNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.ReviewConflict as error:
        raise _conflict(error) from None
    except service.DecisionRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "decision_refused", "problems": error.problems},
        ) from None
    return _file(db, staff, review_id, request)
