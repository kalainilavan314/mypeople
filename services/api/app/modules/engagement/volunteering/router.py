"""Volunteering (BRD H10 to H12, S10, FR-VOL-001 to 008): /v1/volunteering."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Literal, get_args

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.engagement.volunteering import repository, rules, service
from app.modules.engagement.volunteering.schemas import (
    AnswerIn,
    VolunteerOfferItemOut,
    ContactIn,
    ContactOut,
    InboxItemOut,
    ManagedOpportunityOut,
    MemberOpportunityOut,
    MyOfferOut,
    OfferCardOut,
    OfferDecisionIn,
    OpportunityIn,
    OpportunityStateIn,
    OpportunityUpdateIn,
    SavedIn,
    SkillOut,
    VolunteerCardOut,
    VolunteerProfileIn,
    VolunteerProfileOut,
    VolunteerSkillsOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Coordinator = Annotated[Staff, Depends(require_permission(rules.PERMISSION))]

router = APIRouter(prefix="/v1/volunteering", tags=["volunteering"], dependencies=[Depends(require_feature("volunteering"))])

REFUSED = {
    403: {"description": "forbidden, outside_your_area, own_record"},
    404: {"description": "not_found"},
    422: {"description": "volunteer_refused with problems"},
}


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.NotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.VolunteerRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "volunteer_refused", "problems": error.problems}
        ) from None


# --- Members -------------------------------------------------------------------------------------------


@router.get("/skills", response_model=VolunteerSkillsOut)
def read_skills(member: CurrentMember, db: Db) -> VolunteerSkillsOut:
    """H10: the skills list, the availability choices and the member's own profile."""
    found = service.profile(db, member.id)
    return VolunteerSkillsOut(
        skills=[SkillOut(key=s.key, name_en=s.name_en, name_ta=s.name_ta) for s in repository.skills(db)],
        availability=list(get_args(rules.Availability)),
        profile=VolunteerProfileOut.build(found) if found else None,
    )


@router.put("/profile", response_model=VolunteerProfileOut, responses=REFUSED)
def save_profile(body: VolunteerProfileIn, member: CurrentMember, request: Request, db: Db) -> VolunteerProfileOut:
    """FR-VOL-001 to 003: saved only with consent to share with authorised coordinators."""
    with _answers():
        saved = service.save_profile(
            db, member.id, skills=body.skills, availability=list(body.availability), travel_area=body.travel_area,
            consent=body.consent, ip=client_ip(request),
        )
    return VolunteerProfileOut.build(saved)


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_profile(member: CurrentMember, request: Request, db: Db) -> None:
    """Withdraw consent: the profile is deleted and coordinators no longer see it."""
    service.withdraw_profile(db, member.id, client_ip(request))


@router.get("/opportunities", response_model=list[MemberOpportunityOut])
def list_opportunities(member: CurrentMember, db: Db) -> list[MemberOpportunityOut]:
    """Open opportunities in the member's area, soonest first."""
    return [MemberOpportunityOut.build(view) for view in service.opportunities(db, member.id)]


@router.get("/opportunities/{opportunity_id}", response_model=MemberOpportunityOut, responses=REFUSED)
def read_opportunity(opportunity_id: uuid.UUID, member: CurrentMember, db: Db) -> MemberOpportunityOut:
    """H11: the briefing with time, place, role, what to bring and the coordinating team."""
    with _answers():
        return MemberOpportunityOut.build(service.opportunity(db, member.id, opportunity_id))


@router.post("/opportunities/{opportunity_id}/offer", status_code=status.HTTP_201_CREATED, response_model=MyOfferOut,
             responses=REFUSED)
def offer_to_help(opportunity_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> MyOfferOut:
    """FR-VOL-005: "Offer to help"; a receipt, awaiting the coordinator."""
    with _answers():
        return MyOfferOut.build(service.offer_to_help(db, member.id, opportunity_id, client_ip(request)))


@router.delete("/opportunities/{opportunity_id}/offer", status_code=status.HTTP_204_NO_CONTENT, responses=REFUSED)
def withdraw_offer(opportunity_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> None:
    with _answers():
        service.withdraw_offer(db, member.id, opportunity_id, client_ip(request))


@router.put("/opportunities/{opportunity_id}/saved", response_model=MemberOpportunityOut, responses=REFUSED)
def set_saved(opportunity_id: uuid.UUID, body: SavedIn, member: CurrentMember, db: Db) -> MemberOpportunityOut:
    """"Save for later"."""
    with _answers():
        return MemberOpportunityOut.build(service.set_saved(db, member.id, opportunity_id, body.saved))


@router.get("/assignments", response_model=list[VolunteerOfferItemOut])
def list_my_assignments(member: CurrentMember, db: Db) -> list[VolunteerOfferItemOut]:
    """H12: offers and confirmed assignments with their history and messages."""
    return [VolunteerOfferItemOut.build(item) for item in service.my_assignments(db, member.id)]


@router.post("/offers/{offer_id}/contact", status_code=status.HTTP_201_CREATED, response_model=ContactOut, responses=REFUSED)
def contact_coordinator(offer_id: uuid.UUID, body: ContactIn, member: CurrentMember, request: Request, db: Db) -> ContactOut:
    """FR-VOL-007, 008: a message or change request to the coordinators, through the app."""
    if not body.confirmed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "volunteer_refused", "problems": ["confirmation_required"]},
        )
    with _answers():
        return ContactOut.build(service.contact_coordinator(db, member.id, offer_id, body.kind, body.body, client_ip(request)))


# --- Coordinators --------------------------------------------------------------------------------------


@router.get("/manage/opportunities", response_model=list[ManagedOpportunityOut])
def list_managed(
    staff: Coordinator,
    db: Db,
    state: Annotated[list[Literal["draft", "open", "closed", "cancelled"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[ManagedOpportunityOut]:
    return [ManagedOpportunityOut.build(o) for o in service.managed(db, staff, list(state) if state else None, limit)]


@router.post("/manage/opportunities", status_code=status.HTTP_201_CREATED, response_model=ManagedOpportunityOut,
             responses=REFUSED)
def create_opportunity(body: OpportunityIn, staff: Coordinator, request: Request, db: Db) -> ManagedOpportunityOut:
    """A draft; it reaches members once opened."""
    values = body.model_dump(exclude={"area"})
    with _answers():
        found = service.create_opportunity(db, staff, values, Area(body.area.level, body.area.code), client_ip(request))
    return ManagedOpportunityOut.build(found)


@router.patch("/manage/opportunities/{opportunity_id}", response_model=ManagedOpportunityOut, responses=REFUSED)
def update_opportunity(
    opportunity_id: uuid.UUID, body: OpportunityUpdateIn, staff: Coordinator, request: Request, db: Db
) -> ManagedOpportunityOut:
    with _answers():
        found = service.update_opportunity(db, staff, opportunity_id, body.model_dump(exclude_none=True), client_ip(request))
    return ManagedOpportunityOut.build(found)


@router.post("/manage/opportunities/{opportunity_id}/state", response_model=ManagedOpportunityOut, responses=REFUSED)
def move_opportunity(
    opportunity_id: uuid.UUID, body: OpportunityStateIn, staff: Coordinator, request: Request, db: Db
) -> ManagedOpportunityOut:
    """Open, close or cancel; cancelling tells everyone who offered, with the reason."""
    with _answers():
        found = service.move_opportunity(db, staff, opportunity_id, body.state, body.reason, client_ip(request))
    return ManagedOpportunityOut.build(found)


@router.get("/manage/opportunities/{opportunity_id}/offers", response_model=list[OfferCardOut], responses=REFUSED)
def list_offers(opportunity_id: uuid.UUID, staff: Coordinator, request: Request, db: Db) -> list[OfferCardOut]:
    with _answers():
        return [OfferCardOut.build(card) for card in service.offers(db, staff, opportunity_id, client_ip(request))]


@router.post("/manage/offers/{offer_id}/decision", response_model=MyOfferOut, responses=REFUSED)
def decide_offer(offer_id: uuid.UUID, body: OfferDecisionIn, staff: Coordinator, request: Request, db: Db) -> MyOfferOut:
    """S10: confirm with a role and meeting point, or decline with a reason."""
    with _answers():
        decided = service.decide_offer(
            db, staff, offer_id, confirm=body.confirm, role_en=body.role_en, role_ta=body.role_ta,
            meeting_point_en=body.meeting_point_en, meeting_point_ta=body.meeting_point_ta, reason=body.reason,
            ip=client_ip(request),
        )
    return MyOfferOut.build(decided)


@router.get("/manage/inbox", response_model=list[InboxItemOut])
def list_inbox(staff: Coordinator, db: Db) -> list[InboxItemOut]:
    """Open messages and change requests from volunteers in the coordinator's areas, oldest first."""
    return [InboxItemOut.build(contact) for contact in service.open_contacts(db, staff)]


@router.post("/manage/inbox/{contact_id}/answer", response_model=ContactOut, responses=REFUSED)
def answer_contact(contact_id: uuid.UUID, body: AnswerIn, staff: Coordinator, request: Request, db: Db) -> ContactOut:
    with _answers():
        return ContactOut.build(service.answer_contact(db, staff, contact_id, body.answer, client_ip(request)))


@router.get("/manage/volunteers", response_model=list[VolunteerCardOut], responses=REFUSED)
def list_volunteers(
    staff: Coordinator,
    db: Db,
    skill: Annotated[str | None, Query(max_length=40)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[VolunteerCardOut]:
    """Consented skills profiles in the coordinator's areas, by name; no phone numbers, no ranking."""
    with _answers():
        cards = service.volunteers(db, staff, skill, limit)
    return [
        VolunteerCardOut(member_id=c.member_id, name=c.name, member_code=c.member_code, skills=c.skills,
                         availability=c.availability, travel_area=c.travel_area)
        for c in cards
    ]
