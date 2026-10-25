import uuid
from datetime import date, datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.core.schemas import CamelModel
from app.modules.membership.repository import MembershipChange, MembershipState
from app.modules.membership.rules import Action, State


class MemberProfile(BaseModel):
    """The signed-in member's own profile.

    JSON keys are camelCase, matching the Express /api/me response. The NIC
    hash, password hash and staff-only review fields are never part of it.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    member_code: str
    full_name: str
    phone: str | None
    dob: date | None
    gender: str | None
    language: str
    tier: str
    referral_code: str
    verification_status: str
    verified_at: datetime | None
    district_code: str | None
    district_name: str | None
    ds_code: str | None
    ds_name: str | None
    gs_code: str | None
    gs_name: str | None
    joined_at: datetime


# --- Membership states (§9.3, FR-ADM-003) ----------------------------------------------


class MyMembershipOut(CamelModel):
    """The member's own membership state (A12, C06). The reason code is shown; staff notes are not."""

    state: State
    reason_code: str | None
    changed_at: datetime | None

    @classmethod
    def from_state(cls, current: MembershipState) -> Self:
        return cls(state=current.state, reason_code=current.reason_code, changed_at=current.changed_at)  # type: ignore[arg-type]


class MembershipChangeOut(CamelModel):
    action: Action
    from_state: State
    to_state: State
    reason_code: str
    note: str | None
    changed_by: uuid.UUID | None
    changed_at: datetime

    @classmethod
    def from_change(cls, change: MembershipChange) -> Self:
        return cls(
            action=change.action,  # type: ignore[arg-type]
            from_state=change.from_state,  # type: ignore[arg-type]
            to_state=change.to_state,  # type: ignore[arg-type]
            reason_code=change.reason_code,
            note=change.note,
            changed_by=change.changed_by,
            changed_at=change.changed_at,
        )


class MembershipFileOut(CamelModel):
    """A member's membership for staff: state, whether identity is verified, and every change."""

    member_id: uuid.UUID
    identity_verified: bool
    state: State
    reason_code: str | None
    changed_at: datetime | None
    history: list[MembershipChangeOut]


class MembershipChangeInput(CamelModel):
    action: Action
    reason_code: str = Field(max_length=50)
    note: str | None = Field(default=None, max_length=500)


class AwaitingMemberOut(CamelModel):
    id: uuid.UUID
    member_code: str
    full_name: str
    verified_at: datetime | None
    area: str
