import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.membership import service
from app.modules.membership.repository import find_member_profile
from app.modules.membership.rules import ACTIVATE, VIEW_PROFILE
from app.modules.membership.schemas import (
    AwaitingMemberOut,
    MemberLookupOut,
    MemberProfile,
    MembershipChangeInput,
    MembershipChangeOut,
    MembershipFileOut,
    MyMembershipOut,
)

router = APIRouter(prefix="/v1/members", tags=["members"])
membership_router = APIRouter(prefix="/v1/membership", tags=["membership"])

Db = Annotated[Session, Depends(get_db)]
CanActivate = Annotated[Staff, Depends(require_permission(ACTIVATE))]
CanViewProfile = Annotated[Staff, Depends(require_permission(VIEW_PROFILE))]
REFUSED = {403: {"description": "forbidden, own_record or outside_your_area"}, 404: {"description": "not_found"}}


@router.get("/me")
def read_my_profile(member: CurrentMember, db: Annotated[Session, Depends(get_db)]) -> MemberProfile:
    """The signed-in member's profile."""
    profile = find_member_profile(db, member.id)
    if profile is None:
        # The member was deleted between the session check and this read.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return MemberProfile.model_validate(dict(profile))


@membership_router.get("/me")
def read_my_membership(member: CurrentMember, db: Db) -> MyMembershipOut:
    """The member's membership state: pending, active, suspended or inactive, with the reason
    code (A12, C06). The card is available only when it is active (BR-065)."""
    return MyMembershipOut.from_state(service.my_membership(db, member.id))


@membership_router.get("/lookup", responses={403: {"description": "forbidden"}, 404: {"description": "not_found"}})
def lookup_member(
    staff: CanViewProfile, request: Request, db: Db, code: Annotated[str, Query(min_length=3, max_length=40)]
) -> MemberLookupOut:
    """S03: a member in the caller's areas by exact member ID, with minimal fields (FR-STF-003).
    Needs members.view_profile. Outside the caller's areas the answer is the same 404 as an
    unknown ID; there is no partial match and no list."""
    try:
        found = service.lookup(db, staff, code, client_ip(request))
    except service.MemberNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    return MemberLookupOut(
        member_id=found.id,
        member_code=found.member_code,
        full_name=found.full_name,
        district_name=found.district_name,
        gn_name=found.gn_name,
        identity_verified=found.identity_verified,
        membership_state=found.membership_state,  # type: ignore[arg-type]
    )


@membership_router.get("/awaiting-activation")
def list_awaiting_activation(
    staff: CanActivate, db: Db, limit: Annotated[int, Query(ge=1, le=100)] = 50
) -> list[AwaitingMemberOut]:
    """Members whose identity is confirmed and whose membership is still pending, in the caller's areas."""
    return [
        AwaitingMemberOut(id=m.id, member_code=m.member_code, full_name=m.full_name, verified_at=m.verified_at, area=m.area)
        for m in service.awaiting_activation(db, staff, limit)
    ]


def _file(db: Session, staff: Staff, member_id: uuid.UUID, request: Request) -> MembershipFileOut:
    try:
        file = service.membership_file(db, staff, member_id, client_ip(request))
    except service.MemberNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return MembershipFileOut(
        member_id=file.member_id,
        identity_verified=file.identity_verified,
        state=file.current.state,  # type: ignore[arg-type]
        reason_code=file.current.reason_code,
        changed_at=file.current.changed_at,
        history=[MembershipChangeOut.from_change(change) for change in file.history],
    )


@membership_router.get("/members/{member_id}", responses=REFUSED)
def read_membership(member_id: uuid.UUID, staff: CanActivate, request: Request, db: Db) -> MembershipFileOut:
    """A member's membership state and every change to it. Needs members.activate over their area."""
    return _file(db, staff, member_id, request)


@membership_router.post(
    "/members/{member_id}/changes",
    responses={**REFUSED, 422: {"description": '{"code": "change_refused", "problems": [...]}'}},
)
def change_membership(
    member_id: uuid.UUID, body: MembershipChangeInput, staff: CanActivate, request: Request, db: Db
) -> MembershipFileOut:
    """Activate, suspend, reinstate or inactivate a membership, with a reason (FR-ADM-003, BR-015).

    Activation needs a confirmed identity. Suspending or inactivating also
    stops any staff rights the member holds, on their next request (BR-097).
    """
    try:
        service.change(db, staff, member_id, body.action, body.reason_code, body.note, client_ip(request))
    except service.MemberNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ChangeRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "change_refused", "problems": error.problems},
        ) from None
    return _file(db, staff, member_id, request)
