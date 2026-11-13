"""Request and response bodies for volunteering (H10 to H12, S10)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.engagement.volunteering import repository
from app.modules.engagement.volunteering.rules import Availability, OfferState, OpportunityState, TravelArea
from app.modules.engagement.volunteering.service import Assignment, OfferCard, OpportunityView


class SkillOut(CamelModel):
    key: str
    name_en: str
    name_ta: str


class VolunteerProfileOut(CamelModel):
    skills: list[str]
    availability: list[Availability]
    travel_area: TravelArea
    consented_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, profile: repository.Profile) -> "VolunteerProfileOut":
        return cls(
            skills=profile.skills,
            availability=profile.availability,  # type: ignore[arg-type]
            travel_area=profile.travel_area,  # type: ignore[arg-type]
            consented_at=profile.consented_at,
            updated_at=profile.updated_at,
        )


class VolunteerSkillsOut(CamelModel):
    """H10: the configurable skills list, the availability choices, and the member's profile if any."""

    skills: list[SkillOut]
    availability: list[Availability]
    profile: VolunteerProfileOut | None


class VolunteerProfileIn(CamelModel):
    skills: list[str] = Field(min_length=1, max_length=10)
    availability: list[Availability] = Field(min_length=1, max_length=5)
    travel_area: TravelArea
    consent: bool = Field(description="Agreement to share these with authorised volunteer coordinators (FR-VOL-003)")


class OpportunityOut(CamelModel):
    id: uuid.UUID
    opportunity_ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    description_en: str
    description_ta: str
    place_en: str
    place_ta: str
    bring_en: str
    bring_ta: str
    team_en: str
    team_ta: str
    starts_at: datetime
    ends_at: datetime
    event_id: uuid.UUID | None
    skills: list[str]
    state: OpportunityState

    @classmethod
    def fields(cls, o: repository.Opportunity) -> dict:  # type: ignore[type-arg]
        return {
            "id": o.id, "opportunity_ref": o.opportunity_ref, "title_en": o.title_en, "title_ta": o.title_ta,
            "role_en": o.role_en, "role_ta": o.role_ta, "description_en": o.description_en,
            "description_ta": o.description_ta, "place_en": o.place_en, "place_ta": o.place_ta, "bring_en": o.bring_en,
            "bring_ta": o.bring_ta, "team_en": o.team_en, "team_ta": o.team_ta, "starts_at": o.starts_at,
            "ends_at": o.ends_at, "event_id": o.event_id, "skills": o.skills, "state": o.state,
        }


class MyOfferOut(CamelModel):
    id: uuid.UUID
    offer_ref: str
    state: OfferState
    role_en: str | None
    role_ta: str | None
    meeting_point_en: str | None
    meeting_point_ta: str | None
    decision_reason: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, offer: repository.Offer) -> "MyOfferOut":
        return cls(
            id=offer.id, offer_ref=offer.offer_ref, state=offer.state,  # type: ignore[arg-type]
            role_en=offer.role_en, role_ta=offer.role_ta, meeting_point_en=offer.meeting_point_en,
            meeting_point_ta=offer.meeting_point_ta, decision_reason=offer.decision_reason,
            created_at=offer.created_at, updated_at=offer.updated_at,
        )


class MemberOpportunityOut(OpportunityOut):
    saved: bool
    my_offer: MyOfferOut | None

    @classmethod
    def build(cls, view: OpportunityView) -> "MemberOpportunityOut":
        return cls(
            **OpportunityOut.fields(view.opportunity),
            saved=view.saved,
            my_offer=MyOfferOut.build(view.my_offer) if view.my_offer else None,
        )


class SavedIn(CamelModel):
    saved: bool


class OfferHistoryOut(CamelModel):
    from_state: str | None
    to_state: str
    reason: str | None
    occurred_at: datetime


class ContactOut(CamelModel):
    id: uuid.UUID
    kind: Literal["message", "change_request"]
    body: str
    state: Literal["open", "answered"]
    answer: str | None
    answered_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, contact: repository.Contact) -> "ContactOut":
        return cls(
            id=contact.id, kind=contact.kind, body=contact.body, state=contact.state,  # type: ignore[arg-type]
            answer=contact.answer, answered_at=contact.answered_at, created_at=contact.created_at,
        )


class VolunteerOfferItemOut(CamelModel):
    """H12: an offer or confirmed assignment with its opportunity, history and messages."""

    offer: MyOfferOut
    opportunity: OpportunityOut
    history: list[OfferHistoryOut]
    contacts: list[ContactOut]

    @classmethod
    def build(cls, item: Assignment) -> "VolunteerOfferItemOut":
        return cls(
            offer=MyOfferOut.build(item.offer),
            opportunity=OpportunityOut(**OpportunityOut.fields(item.opportunity)),
            history=[OfferHistoryOut(from_state=e.from_state, to_state=e.to_state, reason=e.reason, occurred_at=e.occurred_at)
                     for e in item.history],
            contacts=[ContactOut.build(c) for c in item.contacts],
        )


class ContactIn(CamelModel):
    kind: Literal["message", "change_request"]
    body: str = Field(min_length=5, max_length=1000, description="For a change request, the reason (FR-VOL-008)")
    confirmed: bool = Field(description="The member confirmed sending; an accidental tap sends nothing")


# --- Coordinators ----------------------------------------------------------------------------------------


class AreaIn(CamelModel):
    level: Literal["province", "district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class OpportunityIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=120)
    title_ta: str = Field(min_length=5, max_length=160)
    role_en: str = Field(min_length=3, max_length=120)
    role_ta: str = Field(min_length=3, max_length=160)
    description_en: str = Field(min_length=10, max_length=2000)
    description_ta: str = Field(min_length=10, max_length=3000)
    place_en: str = Field(min_length=3, max_length=200)
    place_ta: str = Field(min_length=3, max_length=300)
    bring_en: str = Field(min_length=2, max_length=500)
    bring_ta: str = Field(min_length=2, max_length=800)
    team_en: str = Field(min_length=3, max_length=120)
    team_ta: str = Field(min_length=3, max_length=160)
    starts_at: datetime
    ends_at: datetime
    event_id: uuid.UUID | None = None
    skills: list[str] = Field(default_factory=list, max_length=10)
    places: int = Field(ge=1, le=500)
    area: AreaIn


class OpportunityUpdateIn(CamelModel):
    title_en: str | None = Field(default=None, min_length=5, max_length=120)
    title_ta: str | None = Field(default=None, min_length=5, max_length=160)
    role_en: str | None = Field(default=None, min_length=3, max_length=120)
    role_ta: str | None = Field(default=None, min_length=3, max_length=160)
    description_en: str | None = Field(default=None, min_length=10, max_length=2000)
    description_ta: str | None = Field(default=None, min_length=10, max_length=3000)
    place_en: str | None = Field(default=None, min_length=3, max_length=200)
    place_ta: str | None = Field(default=None, min_length=3, max_length=300)
    bring_en: str | None = Field(default=None, min_length=2, max_length=500)
    bring_ta: str | None = Field(default=None, min_length=2, max_length=800)
    team_en: str | None = Field(default=None, min_length=3, max_length=120)
    team_ta: str | None = Field(default=None, min_length=3, max_length=160)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    places: int | None = Field(default=None, ge=1, le=500)


class OpportunityStateIn(CamelModel):
    state: Literal["open", "closed", "cancelled"]
    reason: str | None = Field(default=None, max_length=500)


class ManagedOpportunityOut(OpportunityOut):
    places: int
    confirmed: int
    waiting: int
    area_key: str
    cancel_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, o: repository.Opportunity) -> "ManagedOpportunityOut":
        return cls(
            **OpportunityOut.fields(o), places=o.places, confirmed=o.confirmed, waiting=o.waiting, area_key=o.area_key,
            cancel_reason=o.cancel_reason, created_at=o.created_at,
        )


class OfferCardOut(CamelModel):
    """A volunteer as a coordinator sees them: no phone number, skills only with consent."""

    id: uuid.UUID
    offer_ref: str
    state: OfferState
    volunteer_name: str
    member_code: str
    skills: list[str] | None
    availability: list[str] | None
    travel_area: str | None
    role_en: str | None
    meeting_point_en: str | None
    decision_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, card: OfferCard) -> "OfferCardOut":
        offer, profile = card.offer, card.profile
        return cls(
            id=offer.id, offer_ref=offer.offer_ref, state=offer.state,  # type: ignore[arg-type]
            volunteer_name=offer.volunteer_name, member_code=offer.member_code,
            skills=profile.skills if profile else None, availability=profile.availability if profile else None,
            travel_area=profile.travel_area if profile else None, role_en=offer.role_en,
            meeting_point_en=offer.meeting_point_en, decision_reason=offer.decision_reason, created_at=offer.created_at,
        )


class OfferDecisionIn(CamelModel):
    confirm: bool
    role_en: str | None = Field(default=None, min_length=3, max_length=120)
    role_ta: str | None = Field(default=None, min_length=3, max_length=160)
    meeting_point_en: str | None = Field(default=None, min_length=3, max_length=200)
    meeting_point_ta: str | None = Field(default=None, min_length=3, max_length=300)
    reason: str | None = Field(default=None, max_length=500)


class InboxItemOut(CamelModel):
    id: uuid.UUID
    kind: Literal["message", "change_request"]
    body: str
    volunteer_name: str
    offer_ref: str
    opportunity_id: uuid.UUID
    opportunity_title_en: str
    created_at: datetime

    @classmethod
    def build(cls, contact: repository.Contact) -> "InboxItemOut":
        return cls(
            id=contact.id, kind=contact.kind, body=contact.body, volunteer_name=contact.volunteer_name,  # type: ignore[arg-type]
            offer_ref=contact.offer_ref, opportunity_id=contact.opportunity_id,
            opportunity_title_en=contact.opportunity_title_en, created_at=contact.created_at,
        )


class AnswerIn(CamelModel):
    answer: str = Field(min_length=3, max_length=1000)


class VolunteerCardOut(CamelModel):
    member_id: uuid.UUID
    name: str
    member_code: str
    skills: list[str]
    availability: list[str]
    travel_area: str
