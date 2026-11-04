"""Schemas for the My Household module (BRD v1.1 FR-HH-001 to 010, screens M06 to M10, D02)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel

Role = Literal["head", "adult"]
Relationship = Literal["head", "spouse", "parent", "sibling", "other"]
InvitationRelationship = Literal["spouse", "parent", "sibling", "other"]
InvitationStatus = Literal["pending", "accepted", "declined", "revoked", "expired"]
MemberStatus = Literal["active", "removed"]


class HouseholdCreateIn(CamelModel):
    name: str | None = Field(default=None, max_length=100)


class HouseholdUpdateIn(CamelModel):
    name: str | None = Field(default=None, max_length=100)


class InviteAdultIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)
    relationship: InvitationRelationship


class InvitationRespondIn(CamelModel):
    action: Literal["accept", "decline"]


class HouseholdMemberOut(CamelModel):
    id: uuid.UUID
    household_id: uuid.UUID
    member_id: uuid.UUID | None = None
    member_code: str | None = None
    role: Role
    display_name: str
    relationship: Relationship
    status: MemberStatus
    joined_at: datetime
    removed_at: datetime | None = None


class HouseholdInvitationOut(CamelModel):
    id: uuid.UUID
    household_id: uuid.UUID
    household_name: str | None = None
    inviter_member_id: uuid.UUID
    inviter_name: str
    invitee_member_id: uuid.UUID
    invitee_name: str
    invitee_code: str | None = None
    relationship: str
    status: InvitationStatus
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None = None


class HouseholdOut(CamelModel):
    id: uuid.UUID
    created_by: uuid.UUID
    name: str | None = None
    created_at: datetime
    updated_at: datetime
    dissolved_at: datetime | None = None
    members: list[HouseholdMemberOut] = []
    pending_invitations: list[HouseholdInvitationOut] = []
    my_role: Role | None = None
    is_head: bool = False


class ConsentNoticeOut(CamelModel):
    title_ta: str
    title_en: str
    notice_ta: str
    notice_en: str
    voluntary_clause_ta: str
    voluntary_clause_en: str
    is_voluntary: bool = True
    purpose_limitation_ta: str
    purpose_limitation_en: str


class ConsentLogOut(CamelModel):
    id: uuid.UUID
    household_id: uuid.UUID
    action: str
    member_id: uuid.UUID | None = None
    actor_id: uuid.UUID
    actor_name: str | None = None
    details: dict | None = None
    created_at: datetime


class InvitationsListOut(CamelModel):
    received: list[HouseholdInvitationOut] = []
    sent: list[HouseholdInvitationOut] = []


class StaffHouseholdViewOut(CamelModel):
    permitted: bool = True
    target_member_id: uuid.UUID
    target_member_code: str
    target_member_name: str
    household: HouseholdOut | None = None
    consent_logs: list[ConsentLogOut] = []
