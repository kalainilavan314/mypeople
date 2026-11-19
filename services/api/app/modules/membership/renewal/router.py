"""Membership renewal (BRD M33, D25, FR-RNW-001 to 003, 009): /v1/membership/renewal. Answers 404 while
the renewal module is off."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.membership.renewal import service
from app.modules.membership.renewal.rules import MANAGE
from app.modules.membership.renewal.schemas import RenewalDueMemberOut, MyRenewalOut, RenewalConfirmIn, RenewalSummaryOut

Db = Annotated[Session, Depends(get_db)]
CanManage = Annotated[Staff, Depends(require_permission(MANAGE))]

router = APIRouter(prefix="/v1/membership/renewal", tags=["renewal"], dependencies=[Depends(require_feature("renewal"))])


@router.get("/me")
def read_my_renewal(member: CurrentMember, db: Db) -> MyRenewalOut:
    """M33: the yearly check, its due date and grace period, and the contact and area to confirm."""
    return MyRenewalOut.build(service.my_renewal(db, member.id))


@router.post(
    "/me/confirm",
    responses={422: {"description": '{"code": "renewal_refused", "problems": [...]}: not_due_yet, already_confirmed, '
                                     "contact_not_confirmed, contact_confirmation_required, area_confirmation_required, "
                                     "membership_<state>"}},
)
def confirm_renewal(body: RenewalConfirmIn, member: CurrentMember, request: Request, db: Db) -> MyRenewalOut:
    """FR-RNW-001, 003, 009: confirm contact and area; no document or selfie is ever asked for. A lapsed
    membership becomes Active again (OD-43)."""
    try:
        return MyRenewalOut.build(service.confirm(
            db, member.id, contact_confirmed=body.contact_confirmed, area_confirmed=body.area_confirmed,
            ip=client_ip(request),
        ))
    except service.RenewalRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "renewal_refused", "problems": error.problems},
        ) from None


@router.get("/manage", responses={403: {"description": "forbidden"}})
def list_due(
    staff: CanManage,
    db: Db,
    phase: Literal["upcoming", "due", "grace", "lapsed"] | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[RenewalDueMemberOut]:
    """D25: members in the caller's areas by renewal phase, soonest due first."""
    day = service.today()
    return [RenewalDueMemberOut.build(row, day) for row in service.due_list(db, staff, phase, limit)]


@router.get("/manage/summary", responses={403: {"description": "forbidden"}})
def read_summary(staff: CanManage, db: Db) -> RenewalSummaryOut:
    return RenewalSummaryOut(**service.summary(db, staff))
