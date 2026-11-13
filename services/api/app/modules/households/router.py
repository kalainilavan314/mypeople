"""FastAPI router for the My Household module (MP-FEA-002 §4.1: screens M06 to M10, D02)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.households import service
from app.modules.households.rules import PERMISSION_VIEW_FOR_CASE
from app.modules.households.schemas import (
    ConsentNoticeOut,
    DependantIn,
    DependantUpdateIn,
    HouseholdCreateIn,
    HouseholdInvitationSentOut,
    HouseholdLogEntryOut,
    HouseholdOut,
    HouseholdUpdateIn,
    InvitationRespondIn,
    InvitationsListOut,
    InviteAdultIn,
    MemberRelationshipIn,
    MyHouseholdDetailsIn,
    StaffHouseholdViewOut,
)

Db = Annotated[Session, Depends(get_db)]
CanViewForCase = Annotated[Staff, Depends(require_permission(PERMISSION_VIEW_FOR_CASE))]

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


@router.get("/mine/log", response_model=list[HouseholdLogEntryOut])
def read_household_log(member: CurrentMember, db: Db) -> list[HouseholdLogEntryOut]:
    """M10: the household's change log for its confirmed adults: what changed, who, and when."""
    return service.household_log(db, member.id)


@router.post("/mine/caseworker-consent", response_model=HouseholdOut)
def give_caseworker_consent(member: CurrentMember, db: Db) -> HouseholdOut:
    """The head lets a caseworker in the household's area open its record."""
    return service.give_caseworker_consent(db, member)


@router.delete("/mine/caseworker-consent", response_model=HouseholdOut)
def withdraw_caseworker_consent(member: CurrentMember, db: Db) -> HouseholdOut:
    """Any confirmed adult withdraws caseworker access."""
    return service.withdraw_caseworker_consent(db, member)


@router.get("/invitations/mine", response_model=InvitationsListOut)
def list_my_invitations(member: CurrentMember, db: Db) -> InvitationsListOut:
    return service.list_invitations(db, member.id)


@router.post("/invitations", status_code=status.HTTP_201_CREATED, response_model=HouseholdInvitationSentOut)
def invite_adult(body: InviteAdultIn, member: CurrentMember, db: Db) -> HouseholdInvitationSentOut:
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


@router.patch("/members/me", response_model=HouseholdOut)
def update_my_details(body: MyHouseholdDetailsIn, member: CurrentMember, db: Db) -> HouseholdOut:
    """An adult's own age band and occupation category (OD-30)."""
    return service.update_my_details(db, member, body)


@router.patch("/members/{member_record_id}", response_model=HouseholdOut)
def correct_relationship(
    member_record_id: uuid.UUID, body: MemberRelationshipIn, member: CurrentMember, db: Db
) -> HouseholdOut:
    """The head corrects an adult's relationship (M10)."""
    return service.correct_relationship(db, member, member_record_id, body)


@router.post("/members/{member_record_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(member_record_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    service.remove_member(db, member, member_record_id)


@router.post("/dependants", status_code=status.HTTP_201_CREATED, response_model=HouseholdOut)
def add_dependant(body: DependantIn, member: CurrentMember, db: Db) -> HouseholdOut:
    """M07: a child's minimum record, added by a verified adult of the household as guardian."""
    return service.add_dependant(db, member, body)


@router.patch("/dependants/{member_record_id}", response_model=HouseholdOut)
def update_dependant(
    member_record_id: uuid.UUID, body: DependantUpdateIn, member: CurrentMember, db: Db
) -> HouseholdOut:
    return service.update_dependant(db, member, member_record_id, body)


@router.delete("/dependants/{member_record_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_dependant(member_record_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    service.remove_dependant(db, member, member_record_id)


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_household(member: CurrentMember, db: Db) -> None:
    service.leave_household(db, member)


@router.get("/privacy", response_model=ConsentNoticeOut)
def read_privacy_notice() -> ConsentNoticeOut:
    return service.get_privacy_notice()


@router.get("/staff/{target_member_id}", response_model=StaffHouseholdViewOut)
def staff_view_household(
    target_member_id: str,
    request: Request,
    staff: CanViewForCase,
    db: Db,
) -> StaffHouseholdViewOut:
    """D02 read-only: refused `outside_your_area` or `no_caseworker_consent` (both audited)."""
    try:
        return service.staff_view_household(db, staff, target_member_id, client_ip(request))
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
