"""Schemas for the My Household module (MP-FEA-002 §4.1: screens M06 to M10, D02)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import ConfigDict, Field

from app.core.schemas import CamelModel

Role = Literal["head", "adult", "dependent"]
Relationship = Literal["head", "spouse", "parent", "sibling", "child", "grandchild", "other"]
# An adult's relationship, set by the invitation and correctable by the head.
AdultRelationship = Literal["spouse", "parent", "sibling", "other"]
InvitationRelationship = AdultRelationship
# A child's relationship to the guardian who added them (OD-31: guardian-managed minimum record).
DependantRelationship = Literal["child", "grandchild", "sibling", "other"]
AgeBand = Literal["18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"]
OccupationCategory = Literal[
    "farming",
    "fishing",
    "daily_labour",
    "trade",
    "government",
    "private_sector",
    "self_employed",
    "student",
    "homemaker",
    "retired",
    "unemployed",
    "other",
]
InvitationStatus = Literal["pending", "accepted", "declined", "revoked", "expired"]
MemberStatus = Literal["active", "removed"]
HouseholdAction = Literal[
    "create_household",
    "update_name",
    "invite_adult",
    "accept_invitation",
    "decline_invitation",
    "revoke_invitation",
    "leave_household",
    "remove_member",
    "add_dependent",
    "remove_dependent",
    "dissolve_household",
    "staff_view",
    "update_member",
    "caseworker_consent_given",
    "caseworker_consent_withdrawn",
]
# Who did something, as the household's own change log shows it: a name only for a current adult.
LogActor = Literal["you", "household_member", "former_member", "caseworker"]

# A first name with no digits, so a phone, NIC or passport number cannot be typed into it (M07:
# never another person's ID or phone), and at least one character that is not a space.
FIRST_NAME_PATTERN = r"^\D*[^\d\s]\D*$"


class HouseholdCreateIn(CamelModel):
    name: str | None = Field(default=None, max_length=100)


class HouseholdUpdateIn(CamelModel):
    name: str | None = Field(default=None, max_length=100)


class InviteAdultIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)
    relationship: InvitationRelationship


class InvitationRespondIn(CamelModel):
    action: Literal["accept", "decline"]


class DependantIn(CamelModel):
    """M07 child record: first name, relationship and birth year only. Unknown fields (an ID
    number, a phone, a photo) are refused, never silently dropped."""

    model_config = ConfigDict(extra="forbid")

    first_name: str = Field(min_length=1, max_length=50, pattern=FIRST_NAME_PATTERN)
    relationship: DependantRelationship
    birth_year: int = Field(ge=1900, le=2100)


class DependantUpdateIn(CamelModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=50, pattern=FIRST_NAME_PATTERN)
    relationship: DependantRelationship | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)


class MyHouseholdDetailsIn(CamelModel):
    """An adult's own entry (OD-30: each adult confirms their own). A field left out stays as it
    is; a field sent as null is cleared."""

    model_config = ConfigDict(extra="forbid")

    age_band: AgeBand | None = None
    occupation_category: OccupationCategory | None = None


class MemberRelationshipIn(CamelModel):
    model_config = ConfigDict(extra="forbid")

    relationship: AdultRelationship


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
    age_band: AgeBand | None = None
    occupation_category: OccupationCategory | None = None
    birth_year: int | None = None
    guardian_member_id: uuid.UUID | None = None


class HouseholdInvitationOut(CamelModel):
    """An invitation. The invitee's name is never included: the inviter typed a member code, and a
    name before the invitee accepts would let anyone look names up by code (M08)."""

    id: uuid.UUID
    household_id: uuid.UUID
    household_name: str | None = None
    inviter_member_id: uuid.UUID
    inviter_name: str
    invitee_member_id: uuid.UUID
    invitee_code: str | None = None
    relationship: str
    status: InvitationStatus
    created_at: datetime
    expires_at: datetime
    responded_at: datetime | None = None


class HouseholdInvitationSentOut(CamelModel):
    """The neutral answer to sending an invitation: nothing about the invitee."""

    id: uuid.UUID
    relationship: InvitationRelationship
    status: InvitationStatus
    expires_at: datetime


class HouseholdPlaceOut(CamelModel):
    level: Literal["district", "ds", "gn"]
    code: str
    name_en: str | None = None
    name_ta: str | None = None


class HouseholdOut(CamelModel):
    id: uuid.UUID
    household_code: str = Field(description="A short reference shown to the household, e.g. HH-1A2B3C4D")
    created_by: uuid.UUID
    name: str | None = None
    created_at: datetime
    updated_at: datetime
    dissolved_at: datetime | None = None
    places: list[HouseholdPlaceOut] = Field(default=[], description="District, DS division and GN division")
    caseworker_consent_at: datetime | None = None
    caseworker_consent_by: uuid.UUID | None = None
    members: list[HouseholdMemberOut] = []
    pending_invitations: list[HouseholdInvitationOut] = []
    my_role: Role | None = None
    my_member_id: uuid.UUID | None = None
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


class HouseholdLogEntryOut(CamelModel):
    """One change in the household's log (M10): what, who and when; nothing else."""

    id: uuid.UUID
    action: HouseholdAction
    actor: LogActor
    actor_name: str | None = None
    created_at: datetime


class InvitationsListOut(CamelModel):
    received: list[HouseholdInvitationOut] = []
    sent: list[HouseholdInvitationOut] = []


class StaffHouseholdViewOut(CamelModel):
    """D02 read-only caseworker view, only when the household has given caseworker consent."""

    permitted: bool = True
    target_member_id: uuid.UUID
    target_member_code: str
    target_member_name: str
    household: HouseholdOut
