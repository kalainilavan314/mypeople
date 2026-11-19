"""Request and response bodies for membership renewal (M33, D25)."""

import uuid
from datetime import date, datetime, timedelta
from typing import Literal, Self

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.membership.renewal import rules
from app.modules.membership.renewal.repository import Cycle, DueMember
from app.modules.membership.renewal.rules import Phase
from app.modules.membership.renewal.service import MyRenewal


class RenewalCycleOut(CamelModel):
    id: uuid.UUID
    due_on: date
    grace_ends_on: date
    opens_on: date = Field(description="From this day the member can confirm")
    state: Literal["open", "confirmed", "lapsed"]
    confirmed_at: datetime | None
    area_confirmation: Literal["confirmed", "change_requested"] | None
    lapsed_at: datetime | None

    @classmethod
    def build(cls, c: Cycle) -> Self:
        return cls(
            id=c.id, due_on=c.due_on, grace_ends_on=rules.grace_ends_on(c.due_on),
            opens_on=c.due_on - timedelta(days=rules.OPENS_DAYS_BEFORE), state=c.state,  # type: ignore[arg-type]
            confirmed_at=c.confirmed_at, area_confirmation=c.area_confirmation,  # type: ignore[arg-type]
            lapsed_at=c.lapsed_at,
        )


class MyRenewalOut(CamelModel):
    """M33: where the member's yearly check stands and the two things it asks them to confirm."""

    applies: bool = Field(description="False before the membership is Active, or while it is suspended or inactive")
    reason: str | None = Field(description="Why it does not apply: membership_pending, membership_suspended, membership_inactive")
    membership_state: str
    phase: Phase | None
    can_confirm: bool
    reactivation: bool = Field(description="Confirming makes a lapsed membership Active again (OD-43)")
    cycle: RenewalCycleOut | None
    grace_days: int
    mobile_masked: str | None = Field(description="The confirmed mobile number, all but the last two digits hidden")
    contact_on_record: bool = Field(description="False until a mobile number is confirmed by a code")
    district_name: str | None
    ds_name: str | None
    gn_name: str | None
    area_change_open: bool = Field(description="An area change is waiting for review; it counts as the area answer")
    history: list[RenewalCycleOut]

    @classmethod
    def build(cls, mine: MyRenewal) -> Self:
        return cls(
            applies=mine.applies, reason=mine.reason, membership_state=mine.membership_state, phase=mine.phase,
            can_confirm=mine.phase in ("due", "grace", "lapsed"), reactivation=mine.reactivation,
            cycle=RenewalCycleOut.build(mine.cycle) if mine.cycle else None, grace_days=rules.GRACE_DAYS,
            mobile_masked=mine.mobile_masked, contact_on_record=mine.contact_on_record,
            district_name=mine.district_name, ds_name=mine.ds_name, gn_name=mine.gn_name,
            area_change_open=mine.area_change_open, history=[RenewalCycleOut.build(c) for c in mine.history],
        )


class RenewalConfirmIn(CamelModel):
    contact_confirmed: bool = Field(description="The member says the mobile number shown is still theirs")
    area_confirmed: bool = Field(description="The member says the area shown is still right (or an area change is open)")


class RenewalDueMemberOut(CamelModel):
    member_id: uuid.UUID
    member_code: str
    full_name: str
    area_key: str
    due_on: date
    grace_ends_on: date
    phase: Phase
    notice_30_at: datetime | None
    notice_7_at: datetime | None
    lapsed_at: datetime | None

    @classmethod
    def build(cls, row: DueMember, day: date) -> Self:
        phase: Phase = "lapsed" if row.state == "lapsed" else rules.phase(row.due_on, day)
        return cls(
            member_id=row.member_id, member_code=row.member_code, full_name=row.full_name, area_key=row.area_key,
            due_on=row.due_on, grace_ends_on=rules.grace_ends_on(row.due_on), phase=phase,
            notice_30_at=row.notice_30_at, notice_7_at=row.notice_7_at, lapsed_at=row.lapsed_at,
        )


class RenewalSummaryOut(CamelModel):
    upcoming: int
    due: int
    grace: int
    lapsed: int
    grace_days: int = rules.GRACE_DAYS
