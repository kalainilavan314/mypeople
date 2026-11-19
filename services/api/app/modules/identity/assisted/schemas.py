"""Request and response bodies for assisted verification (M05, S04). None carries an image or an ID number."""

import uuid
from datetime import date, datetime
from typing import Literal, Self

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel
from app.modules.identity.assisted import rules
from app.modules.identity.assisted.repository import AssistedSession, Request
from app.modules.identity.assisted.rules import (
    AbandonReason,
    CloseReason,
    Device,
    PreferredTime,
    Reason,
    Route,
    State,
)
from app.modules.identity.assisted.service import MyAssisted, RequestFile

ChecklistItem = Literal[
    "member_present", "original_document_seen", "face_matches_document", "captured_on_allowed_device", "no_copies_kept",
    "declaration_by_member",
]


class AssistedHelpRequestOut(CamelModel):
    id: uuid.UUID
    request_ref: str
    reason: Reason
    route: Route
    preferred_date: date | None
    preferred_time: PreferredTime | None
    state: State
    scheduled_for: datetime | None
    meeting_place: str | None
    closed_reason: CloseReason | None
    area_key: str
    created_at: datetime

    @classmethod
    def build(cls, r: Request) -> Self:
        return cls(
            id=r.id, request_ref=r.request_ref, reason=r.reason, route=r.route,  # type: ignore[arg-type]
            preferred_date=r.preferred_date, preferred_time=r.preferred_time, state=r.state,  # type: ignore[arg-type]
            scheduled_for=r.scheduled_for, meeting_place=r.meeting_place, closed_reason=r.closed_reason,  # type: ignore[arg-type]
            area_key=r.area_path[-1], created_at=r.created_at,
        )


class MyAssistedOut(CamelModel):
    """M05: the member's latest request, and whether they can ask now."""

    request: AssistedHelpRequestOut | None
    identity_verified: bool
    review_state: str | None
    contact_on_record: bool = Field(description="Help needs a mobile number confirmed by a code, so the team can call")
    check_failures_before_help: int = rules.CHECK_FAILURES_BEFORE_HELP
    preferred_within_days: int = rules.PREFERRED_WITHIN_DAYS

    @classmethod
    def build(cls, mine: MyAssisted) -> Self:
        return cls(
            request=AssistedHelpRequestOut.build(mine.request) if mine.request else None,
            identity_verified=mine.identity_verified, review_state=mine.review_state,
            contact_on_record=mine.contact_on_record,
        )


class AssistedHelpRequestIn(CamelModel):
    """No ID data: only why, which route and when suits the member (M05)."""

    reason: Reason
    route: Route
    preferred_date: date | None = None
    preferred_time: PreferredTime | None = None


class AssistedSessionOut(CamelModel):
    id: uuid.UUID
    witness_tier: str = Field(description="The witness's tier, never their name")
    device: Device
    started_at: datetime
    ended_at: datetime | None
    outcome: Literal["completed", "abandoned"] | None
    checklist: list[str]
    notes: str | None
    abandon_reason: AbandonReason | None
    mine: bool = False

    @classmethod
    def build(cls, s: AssistedSession, viewer_id: uuid.UUID | None = None) -> Self:
        return cls(
            id=s.id, witness_tier=s.witness_tier, device=s.device, started_at=s.started_at,  # type: ignore[arg-type]
            ended_at=s.ended_at, outcome=s.outcome, checklist=list(s.checklist), notes=s.notes,  # type: ignore[arg-type]
            abandon_reason=s.abandon_reason, mine=viewer_id is not None and s.witness_id == viewer_id,  # type: ignore[arg-type]
        )


class AssistedImageOut(CamelModel):
    kind: str
    received_at: datetime | None = Field(description="When the server acknowledged it; null while still needed")


class AssistedRequestFileOut(AssistedHelpRequestOut):
    """S04: who to meet, how to reach them while the request is open, and what the review still needs."""

    member_code: str
    full_name: str
    district_name: str | None
    ds_name: str | None
    gn_name: str | None
    phone: str | None = Field(description="The member's confirmed number, only while the request is open")
    identity_route: Literal["nic", "passport"]
    images: list[AssistedImageOut]
    consent_given: bool
    checklist_items: list[ChecklistItem]
    sessions: list[AssistedSessionOut]

    @classmethod
    def from_file(cls, file: RequestFile, viewer_id: uuid.UUID) -> Self:
        return cls(
            **AssistedHelpRequestOut.build(file.request).model_dump(),
            member_code=file.member.member_code, full_name=file.member.full_name,
            district_name=file.member.district_name, ds_name=file.member.ds_name, gn_name=file.member.gn_name,
            phone=file.phone, identity_route=file.route,  # type: ignore[arg-type]
            images=[AssistedImageOut(kind=kind, received_at=file.received.get(kind)) for kind in file.required_documents],
            consent_given=file.consent_given, checklist_items=list(rules.CHECKLIST),  # type: ignore[arg-type]
            sessions=[AssistedSessionOut.build(s, viewer_id) for s in file.sessions],
        )


class AssistedQueueItemOut(AssistedHelpRequestOut):
    pass


class AssistedScheduleIn(CamelModel):
    scheduled_for: AwareDatetime
    meeting_place: str = Field(min_length=3, max_length=200)


class AssistedStartIn(CamelModel):
    device: Device = Field(description="The member's own phone, or a district office's device; never the witness's phone")


class AssistedCompleteIn(CamelModel):
    checklist: list[ChecklistItem] = Field(max_length=len(rules.CHECKLIST))
    notes: str | None = Field(default=None, max_length=1000, description="No ID numbers: the images carry the details")


class AssistedAbandonIn(CamelModel):
    reason: AbandonReason
    notes: str | None = Field(default=None, max_length=1000)


class AssistedCloseIn(CamelModel):
    reason: CloseReason


class AssistedReviewSessionOut(AssistedSessionOut):
    request_ref: str
