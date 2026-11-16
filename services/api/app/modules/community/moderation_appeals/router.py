"""One appeal against a moderation decision (D12): /v1/moderation-appeals.

There is no module switch on the router itself: an appeal about an idea needs ideas_surveys and one
about added information needs community_issues, so the service checks the item's own module and
answers 404 feature_unavailable while it is off, as the switch would.
"""

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
from app.modules.community.moderation_appeals import service
from app.modules.community.moderation_appeals.schemas import (
    AppealItemKind,
    ModerationAppealDecisionIn,
    ModerationAppealIn,
    ModerationAppealOut,
    MyModerationAppealOut,
    StaffModerationAppealOut,
)

Db = Annotated[Session, Depends(get_db)]
Moderator = Annotated[Staff, Depends(require_permission(service.MODERATE))]

router = APIRouter(prefix="/v1/moderation-appeals", tags=["moderation-appeals"])

ANSWERS = {
    403: {"description": "forbidden, own_record, outside_your_area, original_moderator"},
    404: {"description": "not_found, or feature_unavailable while the item's module is off"},
    422: {
        "description": "appeal_refused with problems: not_rejected, already_appealed, appeal_too_short, already_decided, "
        "reason_required"
    },
}


def _enforced(request: Request) -> bool:
    return bool(request.app.state.settings.feature_flags_enforced)


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except service.FeatureUnavailable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="feature_unavailable") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.AppealNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.AppealRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "appeal_refused", "problems": error.problems}
        ) from None


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ModerationAppealOut, responses=ANSWERS)
def appeal(body: ModerationAppealIn, member: CurrentMember, request: Request, db: Db) -> ModerationAppealOut:
    """The author of a rejected idea or added information appeals the decision, once."""
    with _answers():
        found = service.appeal(
            db, member.id, body.item_kind, body.item_id, body.body, client_ip(request), enforced=_enforced(request)
        )
    return ModerationAppealOut.build(found)


@router.get("/mine", response_model=MyModerationAppealOut, responses=ANSWERS)
def read_my_appeal(
    member: CurrentMember,
    request: Request,
    db: Db,
    item_kind: Annotated[AppealItemKind, Query(alias="itemKind")],
    item_id: Annotated[uuid.UUID, Query(alias="itemId")],
) -> MyModerationAppealOut:
    """The member's appeal on one of their own items, or none."""
    with _answers():
        found = service.mine(db, member.id, item_kind, item_id, enforced=_enforced(request))
    return MyModerationAppealOut(appeal=ModerationAppealOut.build(found) if found else None)


@router.get("/manage", response_model=list[StaffModerationAppealOut])
def list_appeals(staff: Moderator, request: Request, db: Db) -> list[StaffModerationAppealOut]:
    """D12: appeals in the moderator's areas, open ones first, oldest first."""
    return [StaffModerationAppealOut.from_managed(row) for row in service.manage_list(db, staff, enforced=_enforced(request))]


@router.post("/manage/{appeal_id}/decision", response_model=StaffModerationAppealOut, responses=ANSWERS)
def decide_appeal(
    appeal_id: uuid.UUID, body: ModerationAppealDecisionIn, staff: Moderator, request: Request, db: Db
) -> StaffModerationAppealOut:
    """Decided by a moderator over the area who is neither the first moderator nor the author."""
    with _answers():
        found = service.decide(
            db, staff, appeal_id, body.change, body.reason, client_ip(request), enforced=_enforced(request)
        )
    return StaffModerationAppealOut.from_managed(found)
