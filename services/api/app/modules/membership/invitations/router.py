"""Invite a member and My referrals (BRD H19, H20, FR-REF-001 to 006): /v1/invitations."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.membership.invitations import service

Db = Annotated[Session, Depends(get_db)]

router = APIRouter(prefix="/v1/invitations", tags=["invitations"], dependencies=[Depends(require_feature("invitations"))])


class InvitationOut(CamelModel):
    number: int = Field(description="Shown as a neutral label, \"Invitation 01\" (OD-24)")
    status: service.Status
    created_at: datetime


class MyReferralsOut(CamelModel):
    referral_code: str = Field(description="The member's own code, for one-tap copy (FR-REF-001)")
    invitations: list[InvitationOut]


class InvitationIn(CamelModel):
    language: Literal["ta", "en"]


class NewInvitationOut(CamelModel):
    number: int
    url: str = Field(description="Carries only the opaque token (FR-REF-004)")
    preview: str = Field(description="The full invitation text in the chosen language (FR-REF-003)")


class InvitationPreviewOut(CamelModel):
    preview: str = Field(description="The full invitation text; its link's token is made only on sharing")


@router.get("/preview", response_model=InvitationPreviewOut, responses={422: {"description": "membership_not_active"}})
def preview_invitation(language: Literal["ta", "en"], member: CurrentMember, request: Request, db: Db) -> InvitationPreviewOut:
    """H19 "preview, then share": the invitation text before sharing. Creates nothing, so a preview is
    never listed under My referrals."""
    try:
        wording = service.preview(db, member.id, language, request.app.state.settings.member_app_url)
    except service.InvitationRefused as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=error.code) from None
    return InvitationPreviewOut(preview=wording)


@router.get("/mine", response_model=MyReferralsOut)
def my_referrals(member: CurrentMember, db: Db) -> MyReferralsOut:
    """H20: invitations with the statuses Shared, Pending or Active only; never who joined."""
    found = service.my_referrals(db, member.id)
    return MyReferralsOut(
        referral_code=found.referral_code,
        invitations=[InvitationOut(number=i.number, status=service.status_of(i), created_at=i.created_at)
                     for i in found.invitations],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=NewInvitationOut,
             responses={422: {"description": "membership_not_active, too_many_invitations_today"}})
def create_invitation(body: InvitationIn, member: CurrentMember, request: Request, db: Db) -> NewInvitationOut:
    """H19: a new invitation link and its text, made as the member shares through the phone's share
    sheet; from now on it is listed as Shared."""
    try:
        created = service.create(db, member.id, body.language, request.app.state.settings.member_app_url, client_ip(request))
    except service.InvitationRefused as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=error.code) from None
    return NewInvitationOut(number=created.number, url=created.url, preview=created.preview)


@router.post("/{number}/cancel", status_code=status.HTTP_204_NO_CONTENT, responses={404: {"description": "not_found"}})
def cancel_invitation(number: int, member: CurrentMember, request: Request, db: Db) -> None:
    """The share sheet was closed without sharing: takes back the unused invitation made a few
    minutes ago, so it is not listed as Shared."""
    try:
        service.cancel(db, member.id, number, client_ip(request))
    except service.InvitationNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
