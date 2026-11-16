"""FastAPI router for the My Household module (BRD v1.1 FR-HH-001 to 010, screens M06 to M10, D02)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.households import service
from app.modules.households.schemas import (
    ConsentNoticeOut,
    HouseholdCreateIn,
    HouseholdInvitationOut,
    HouseholdOut,
    HouseholdUpdateIn,
    InvitationRespondIn,
    InvitationsListOut,
    InviteAdultIn,
    StaffHouseholdViewOut,
)

Db = Annotated[Session, Depends(get_db)]
CanViewForCase = Annotated[Staff, Depends(require_permission("household.view_for_case"))]

router = APIRouter(
    prefix="/v1/households",
    tags=["households"],
    dependencies=[Depends(require_feature("households"))],
)


@router.get("/mine", response_model=HouseholdOut | None)
def read_my_household(member: CurrentMember, db: Db) -> HouseholdOut | None:
    return service.get_my_household(db, member.id)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=HouseholdOut)
def create_household(body: HouseholdCreateIn, member: CurrentMember, db: Db) -> HouseholdOut:
    return service.create_household(db, member, body)


@router.patch("/mine", response_model=HouseholdOut)
def update_household(body: HouseholdUpdateIn, member: CurrentMember, db: Db) -> HouseholdOut:
    return service.update_household(db, member, body)


@router.get("/invitations/mine", response_model=InvitationsListOut)
def list_my_invitations(member: CurrentMember, db: Db) -> InvitationsListOut:
    return service.list_invitations(db, member.id)


@router.post("/invitations", status_code=status.HTTP_201_CREATED, response_model=HouseholdInvitationOut)
def invite_adult(body: InviteAdultIn, member: CurrentMember, db: Db) -> HouseholdInvitationOut:
    return service.invite_adult(db, member, body)


@router.post("/invitations/{invitation_id}/respond", response_model=HouseholdOut | None)
def respond_invitation(
    invitation_id: uuid.UUID,
    body: InvitationRespondIn,
    member: CurrentMember,
    db: Db,
) -> HouseholdOut | None:
    return service.respond_invitation(db, member, invitation_id, body)


@router.post("/invitations/{invitation_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(invitation_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    service.revoke_invitation(db, member, invitation_id)


@router.post("/members/{member_record_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(member_record_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    service.remove_member(db, member, member_record_id)


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_household(member: CurrentMember, db: Db) -> None:
    service.leave_household(db, member)


@router.get("/privacy", response_model=ConsentNoticeOut)
def read_privacy_notice() -> ConsentNoticeOut:
    return service.get_privacy_notice()


@router.get("/staff/{target_member_id}", response_model=StaffHouseholdViewOut)
def staff_view_household(
    target_member_id: str,
    staff: CanViewForCase,
    db: Db,
) -> StaffHouseholdViewOut:
    return service.staff_view_household(db, staff, target_member_id)
