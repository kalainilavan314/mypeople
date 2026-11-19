"""Meet Your Representative (BRD M41, M42, S17, D29, FR-APT-001 to 007): /v1/appointments."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.events.appointments import rules, service
from app.modules.events.appointments.rules import ProfileState
from app.modules.events.appointments.schemas import (
    AppointmentBookIn,
    AppointmentCancelIn,
    AppointmentOut,
    AppointmentRescheduleIn,
    BookingCancelIn,
    BookingOut,
    CalendarOut,
    CalendarSlotOut,
    ContactApprovalIn,
    AppointmentFollowUpIn,
    OwnProfileIn,
    OwnProfileOut,
    ProfileSlotOut,
    ProfileWithdrawIn,
    RepresentativeCreateIn,
    RepresentativeDetailOut,
    RepresentativeManagedDetailOut,
    RepresentativeManagedOut,
    RepresentativeProfileIn,
    RepresentativeSummaryOut,
    SlotSeriesIn,
    SlotWithdrawIn,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Representative = Annotated[Staff, Depends(require_permission(rules.MANAGE_OWN))]
ProfileManager = Annotated[Staff, Depends(require_permission(rules.MANAGE_PROFILES))]

router = APIRouter(prefix="/v1/appointments", tags=["appointments"],
                   dependencies=[Depends(require_feature("representatives"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.AppointmentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.AppointmentRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "appointment_refused", "problems": error.problems},
        ) from None


def _calendar(view: service.CalendarView) -> CalendarOut:
    slots = []
    for slot in view.slots:
        booking = view.bookings.get(slot.id)
        slots.append(CalendarSlotOut(
            **ProfileSlotOut.fields(slot), state=slot.state, withdrawn_reason=slot.withdrawn_reason,  # type: ignore[arg-type]
            booking=BookingOut.with_member(booking, view.names.get(booking.member_id, ("", ""))) if booking else None,
        ))
    return CalendarOut(profile=OwnProfileOut.build(view.representative) if view.representative else None, slots=slots)


def _profile_detail(view: service.ProfileView) -> RepresentativeManagedDetailOut:
    return RepresentativeManagedDetailOut(
        **RepresentativeManagedOut.build(view.representative).model_dump(),
        holds_calendar_permission=view.holds_calendar_permission,
        slots=[ProfileSlotOut.build(s) for s in view.slots],
    )


# --- Members (M41, M42) -------------------------------------------------------------------------


@router.get("/representatives", response_model=list[RepresentativeSummaryOut])
def list_representatives(member: CurrentMember, db: Db) -> list[RepresentativeSummaryOut]:
    """M41: published role profiles, those covering the member's own area first (FR-APT-001)."""
    return [RepresentativeSummaryOut.build(item.representative, item.covers_my_area) for item in service.directory(db, member.id)]


@router.get("/representatives/{representative_id}", response_model=RepresentativeDetailOut)
def read_representative(representative_id: uuid.UUID, member: CurrentMember, db: Db) -> RepresentativeDetailOut:
    """M41: the role, area, office hours, approved contacts only (FR-APT-007) and free slots (FR-APT-002)."""
    with _answers():
        view = service.representative_view(db, member.id, representative_id)
        return RepresentativeDetailOut.from_view(view.representative, view.covers_my_area, view.free_slots)


@router.get("/mine", response_model=list[AppointmentOut])
def my_appointments(member: CurrentMember, db: Db) -> list[AppointmentOut]:
    return [AppointmentOut.build(a) for a in service.mine(db, member.id)]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AppointmentOut)
def book_appointment(body: AppointmentBookIn, member: CurrentMember, request: Request, db: Db) -> AppointmentOut:
    """M42: book a free slot. Needs a Verified identity and an Active membership [ASSUMPTION]. With
    caseLinkConsent false, no case reference is stored (FR-APT-005)."""
    with _answers():
        return AppointmentOut.build(service.book(db, member.id, body.model_dump(), client_ip(request)))


@router.get("/mine/{appointment_id}", response_model=AppointmentOut)
def read_my_appointment(appointment_id: uuid.UUID, member: CurrentMember, db: Db) -> AppointmentOut:
    """M42: the booking with the representative's follow-up note (FR-APT-006)."""
    with _answers():
        return AppointmentOut.build(service.my_appointment(db, member.id, appointment_id))


@router.post("/mine/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_my_appointment(appointment_id: uuid.UUID, body: AppointmentCancelIn, member: CurrentMember, request: Request,
                          db: Db) -> AppointmentOut:
    with _answers():
        return AppointmentOut.build(service.cancel_mine(db, member.id, appointment_id, body.reason, client_ip(request)))


@router.post("/mine/{appointment_id}/reschedule", response_model=AppointmentOut)
def reschedule_my_appointment(appointment_id: uuid.UUID, body: AppointmentRescheduleIn, member: CurrentMember,
                              request: Request, db: Db) -> AppointmentOut:
    """Move to another free slot of the same representative; reminders start again."""
    with _answers():
        return AppointmentOut.build(service.reschedule(db, member.id, appointment_id, body.slot_id, client_ip(request)))


# --- The representative's own calendar (S17; PRM-56) --------------------------------------------


@router.get("/calendar", response_model=CalendarOut)
def read_calendar(
    staff: Representative,
    db: Db,
    since: Annotated[date | None, Query(alias="from", description="First day; a week ago by default")] = None,
    days: Annotated[int, Query(ge=1, le=120)] = 45,
) -> CalendarOut:
    """S17: the representative's slots, bookings, needs and follow-up notes."""
    with _answers():
        return _calendar(service.calendar(db, staff, since, days))


@router.put("/calendar/profile", response_model=OwnProfileOut)
def update_own_profile(body: OwnProfileIn, staff: Representative, request: Request, db: Db) -> OwnProfileOut:
    with _answers():
        return OwnProfileOut.build(service.update_own_profile(db, staff, body.model_dump(exclude={"show_contacts"}),
                                                              body.show_contacts, client_ip(request)))


@router.post("/calendar/contacts", response_model=OwnProfileOut)
def approve_own_contacts(body: ContactApprovalIn, staff: Representative, request: Request, db: Db) -> OwnProfileOut:
    """BR-143: the person approves (or withdraws approval of) the routes entered for them."""
    with _answers():
        return OwnProfileOut.build(service.approve_contacts(db, staff, body.approve, client_ip(request)))


@router.post("/calendar/slots", status_code=status.HTTP_201_CREATED, response_model=list[ProfileSlotOut])
def add_own_slots(body: SlotSeriesIn, staff: Representative, request: Request, db: Db) -> list[ProfileSlotOut]:
    """No overlapping slots (S17)."""
    with _answers():
        return [ProfileSlotOut.build(s) for s in service.add_own_slots(db, staff, body.model_dump(), client_ip(request))]


@router.post("/calendar/slots/{slot_id}/withdraw", response_model=ProfileSlotOut)
def withdraw_own_slot(slot_id: uuid.UUID, body: SlotWithdrawIn, staff: Representative, request: Request,
                      db: Db) -> ProfileSlotOut:
    """A booking on the slot is cancelled and the member told why."""
    with _answers():
        return ProfileSlotOut.build(service.withdraw_own_slot(db, staff, slot_id, body.reason, client_ip(request)))


@router.get("/calendar/bookings/{appointment_id}", response_model=BookingOut)
def read_booking(appointment_id: uuid.UUID, staff: Representative, db: Db) -> BookingOut:
    with _answers():
        appointment, member = service.own_booking(db, staff, appointment_id)
        return BookingOut.with_member(appointment, member)


@router.post("/calendar/bookings/{appointment_id}/cancel", response_model=BookingOut)
def cancel_booking(appointment_id: uuid.UUID, body: BookingCancelIn, staff: Representative, request: Request,
                   db: Db) -> BookingOut:
    with _answers():
        service.cancel_booking(db, staff, appointment_id, body.reason, client_ip(request))
        appointment, member = service.own_booking(db, staff, appointment_id)
        return BookingOut.with_member(appointment, member)


@router.post("/calendar/bookings/{appointment_id}/follow-up", response_model=BookingOut)
def record_follow_up(appointment_id: uuid.UUID, body: AppointmentFollowUpIn, staff: Representative, request: Request,
                     db: Db) -> BookingOut:
    """FR-APT-006: the note is visible to the member."""
    with _answers():
        service.follow_up(db, staff, appointment_id, body.outcome, body.note, client_ip(request))
        appointment, member = service.own_booking(db, staff, appointment_id)
        return BookingOut.with_member(appointment, member)


# --- Profiles for the areas (D29) ---------------------------------------------------------------


@router.get("/profiles", response_model=list[RepresentativeManagedOut])
def list_profiles(
    staff: ProfileManager, db: Db, profile_state: Annotated[ProfileState | None, Query(alias="state")] = None
) -> list[RepresentativeManagedOut]:
    with _answers():
        return [RepresentativeManagedOut.build(r) for r in service.profiles(db, staff, profile_state)]


@router.post("/profiles", status_code=status.HTTP_201_CREATED, response_model=RepresentativeManagedDetailOut)
def create_profile(body: RepresentativeCreateIn, staff: ProfileManager, request: Request,
                   db: Db) -> RepresentativeManagedDetailOut:
    """D29: a draft profile for the person with this member ID; any contact routes wait for their approval."""
    with _answers():
        created = service.create_profile(db, staff, body.member_code, body.model_dump(exclude={"member_code", "area"}),
                                         Area(body.area.level, body.area.code), client_ip(request))
        return _profile_detail(service.profile_view(db, staff, created.id))


@router.get("/profiles/{representative_id}", response_model=RepresentativeManagedDetailOut)
def read_profile(representative_id: uuid.UUID, staff: ProfileManager, db: Db) -> RepresentativeManagedDetailOut:
    with _answers():
        return _profile_detail(service.profile_view(db, staff, representative_id))


@router.put("/profiles/{representative_id}", response_model=RepresentativeManagedDetailOut)
def update_profile(representative_id: uuid.UUID, body: RepresentativeProfileIn, staff: ProfileManager, request: Request,
                   db: Db) -> RepresentativeManagedDetailOut:
    """Changing a contact route clears the person's approval and asks them again (BR-143)."""
    with _answers():
        service.update_profile(db, staff, representative_id, body.model_dump(), client_ip(request))
        return _profile_detail(service.profile_view(db, staff, representative_id))


@router.post("/profiles/{representative_id}/publish", response_model=RepresentativeManagedDetailOut)
def publish_profile(representative_id: uuid.UUID, staff: ProfileManager, request: Request,
                    db: Db) -> RepresentativeManagedDetailOut:
    """Refused unless the person holds PRM-56, so bookings reach someone."""
    with _answers():
        service.publish_profile(db, staff, representative_id, client_ip(request))
        return _profile_detail(service.profile_view(db, staff, representative_id))


@router.post("/profiles/{representative_id}/withdraw", response_model=RepresentativeManagedDetailOut)
def withdraw_profile(representative_id: uuid.UUID, body: ProfileWithdrawIn, staff: ProfileManager, request: Request,
                     db: Db) -> RepresentativeManagedDetailOut:
    """Bookings still ahead are cancelled and their members told."""
    with _answers():
        service.withdraw_profile(db, staff, representative_id, body.reason, client_ip(request))
        return _profile_detail(service.profile_view(db, staff, representative_id))


@router.post("/profiles/{representative_id}/slots", status_code=status.HTTP_201_CREATED,
             response_model=list[ProfileSlotOut])
def add_slots(representative_id: uuid.UUID, body: SlotSeriesIn, staff: ProfileManager, request: Request,
              db: Db) -> list[ProfileSlotOut]:
    with _answers():
        return [ProfileSlotOut.build(s) for s in service.add_slots_for(db, staff, representative_id, body.model_dump(),
                                                                      client_ip(request))]


@router.post("/profiles/{representative_id}/slots/{slot_id}/withdraw", response_model=ProfileSlotOut)
def withdraw_slot(representative_id: uuid.UUID, slot_id: uuid.UUID, body: SlotWithdrawIn, staff: ProfileManager,
                  request: Request, db: Db) -> ProfileSlotOut:
    with _answers():
        return ProfileSlotOut.build(service.withdraw_slot_for(db, staff, representative_id, slot_id, body.reason,
                                                              client_ip(request)))
