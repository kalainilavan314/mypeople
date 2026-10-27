import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.reviews import service
from app.modules.access.reviews.schemas import DueGrantOut, DueReviewsOut, ReviewInput
from app.modules.access.schemas import AssignmentOut
from app.modules.access.service import AccessRefused, Staff

router = APIRouter(prefix="/v1/access/reviews", tags=["access"])

Db = Annotated[Session, Depends(get_db)]
CanReview = Annotated[Staff, Depends(require_permission(service.PERMISSION))]


@router.get("")
def list_due_reviews(staff: CanReview, db: Db, limit: Annotated[int, Query(ge=1, le=200)] = 100) -> DueReviewsOut:
    """Grants in the caller's areas, below their tier, due for review by the end of this quarter,
    the most overdue first (FR-AUTH-027, D31). Needs audit.view."""
    due = service.due(db, staff, limit)
    now = datetime.now(UTC)
    return DueReviewsOut(
        quarter=due.quarter,
        quarter_ends_at=due.quarter_ends_at,
        reviewed_this_quarter=due.reviewed_this_quarter,
        items=[
            DueGrantOut(
                **AssignmentOut.from_stored(item.assignment).model_dump(),
                member_code=item.member_code,
                full_name=item.full_name,
                overdue=item.assignment.review_due_at is not None and item.assignment.review_due_at <= now,
                last_reviewed_at=item.last_reviewed_at,
            )
            for item in due.items
        ],
    )


@router.post(
    "/{assignment_id}",
    responses={
        403: {"description": "forbidden, own_assignment, outside_your_area, tier_not_below_yours or tier_5_by_bootstrap_only"},
        404: {"description": "not_found"},
        409: {"description": "not_due"},
    },
)
def review_assignment(
    assignment_id: uuid.UUID, body: ReviewInput, request: Request, staff: CanReview, db: Db
) -> AssignmentOut:
    """Confirm a grant for another quarter, or revoke it. A confirmed grant that had lapsed
    counts again at once."""
    try:
        decided = service.decide(db, staff, assignment_id, body.decision, body.reason, client_ip(request))
    except service.ReviewNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ReviewNotDue:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="not_due") from None
    return AssignmentOut.from_stored(decided)
