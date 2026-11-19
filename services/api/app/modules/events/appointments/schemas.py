"""Request and response bodies for Meet Your Representative (M41, M42, S17, D29)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.events.appointments import rules
from app.modules.events.appointments.repository import Appointment, Representative, Slot
from app.modules.events.appointments.rules import (
    AppointmentState,
    AreaLevel,
    CancelledBy,
    ContactPreference,
    Need,
    Outcome,
    ProfileState,
    SlotMode,
)


class RepresentativeContactsOut(CamelModel):
    """BR-143, FR-APT-007: only the routes the person approved; empty when they approved none."""

    phone: str | None
    email: str | None
    office_address_en: str | None
    office_address_ta: str | None

    @classmethod
    def approved(cls, r: Representative) -> "RepresentativeContactsOut":
        if r.contacts_approved_at is None:
            return cls(phone=None, email=None, office_address_en=None, office_address_ta=None)
        return cls(phone=r.public_phone, email=r.public_email, office_address_en=r.office_address_en,
                   office_address_ta=r.office_address_ta)


class RepresentativeSummaryOut(CamelModel):
    """M41: a role profile in the directory."""

    id: uuid.UUID
    role_en: str
    role_ta: str
    display_name_en: str
    display_name_ta: str
    area_key: str = Field(description="The District, DS or GN division covered, such as district:LK41")
    office_hours_en: str
    office_hours_ta: str
    covers_my_area: bool
    open_slots: int
    next_open_slot: datetime | None

    @classmethod
    def fields(cls, r: Representative, covers: bool) -> dict:  # type: ignore[type-arg]
        return {
            "id": r.id, "role_en": r.role_en, "role_ta": r.role_ta, "display_name_en": r.display_name_en,
            "display_name_ta": r.display_name_ta, "area_key": r.area_key, "office_hours_en": r.office_hours_en,
            "office_hours_ta": r.office_hours_ta, "covers_my_area": covers, "open_slots": r.open_slots,
            "next_open_slot": r.next_open_slot,
        }

    @classmethod
    def build(cls, r: Representative, covers: bool) -> "RepresentativeSummaryOut":
        return cls(**cls.fields(r, covers))


class AppointmentSlotOut(CamelModel):
    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    mode: SlotMode
    place_en: str | None
    place_ta: str | None

    @classmethod
    def fields(cls, s: Slot) -> dict:  # type: ignore[type-arg]
        return {"id": s.id, "starts_at": s.starts_at, "ends_at": s.ends_at, "mode": s.mode, "place_en": s.place_en,
                "place_ta": s.place_ta}

    @classmethod
    def build(cls, s: Slot) -> "AppointmentSlotOut":
        return cls(**cls.fields(s))


class RepresentativeDetailOut(RepresentativeSummaryOut):
    """M41, M42: the profile with its approved contacts and the free slots. With no slots, the office
    hours are the way to meet (FR-APT-002)."""

    contacts: RepresentativeContactsOut
    slots: list[AppointmentSlotOut]

    @classmethod
    def from_view(cls, r: Representative, covers: bool, slots: list[Slot]) -> "RepresentativeDetailOut":
        return cls(**RepresentativeSummaryOut.fields(r, covers), contacts=RepresentativeContactsOut.approved(r),
                   slots=[AppointmentSlotOut.build(s) for s in slots])


class AppointmentOut(CamelModel):
    """M42: the member's own booking, with the representative's follow-up note (FR-APT-006)."""

    id: uuid.UUID
    appointment_ref: str
    representative_id: uuid.UUID
    representative_role_en: str
    representative_role_ta: str
    representative_name_en: str
    representative_name_ta: str
    area_key: str
    slot: AppointmentSlotOut
    topic: str
    contact_preference: ContactPreference
    contact_phone: str | None
    needs: list[Need]
    needs_note: str | None
    case_ref: str | None = Field(description="Stored only when the member consented to link it (FR-APT-005)")
    state: AppointmentState
    cancelled_by: CancelledBy | None
    cancel_reason: str | None
    cancelled_at: datetime | None
    follow_up_note: str | None
    follow_up_at: datetime | None
    booked_at: datetime

    @classmethod
    def fields(cls, a: Appointment) -> dict:  # type: ignore[type-arg]
        return {
            "id": a.id, "appointment_ref": a.appointment_ref, "representative_id": a.representative_id,
            "representative_role_en": a.role_en, "representative_role_ta": a.role_ta,
            "representative_name_en": a.display_name_en, "representative_name_ta": a.display_name_ta,
            "area_key": a.area_key,
            "slot": AppointmentSlotOut(id=a.slot_id, starts_at=a.starts_at, ends_at=a.ends_at, mode=a.mode,  # type: ignore[arg-type]
                                       place_en=a.place_en, place_ta=a.place_ta),
            "topic": a.topic, "contact_preference": a.contact_preference, "contact_phone": a.contact_phone,
            "needs": a.needs, "needs_note": a.needs_note, "case_ref": a.case_ref, "state": a.state,
            "cancelled_by": a.cancelled_by, "cancel_reason": a.cancel_reason, "cancelled_at": a.cancelled_at,
            "follow_up_note": a.follow_up_note, "follow_up_at": a.follow_up_at, "booked_at": a.booked_at,
        }

    @classmethod
    def build(cls, a: Appointment) -> "AppointmentOut":
        return cls(**cls.fields(a))


class AppointmentBookIn(CamelModel):
    slot_id: uuid.UUID
    topic: str = Field(min_length=5, max_length=500, description="What the member would like to talk about")
    contact_preference: ContactPreference
    contact_phone: str | None = Field(default=None, max_length=20,
                                      description="Only for a call or a text; never stored for in-app contact")
    needs: list[Need] = Field(default_factory=list, max_length=7, description="Accessibility or language needs")
    needs_note: str | None = Field(default=None, max_length=300)
    case_ref: str | None = Field(default=None, max_length=30, description="Kept only when caseLinkConsent is true")
    case_link_consent: bool = False


class AppointmentCancelIn(CamelModel):
    reason: str | None = Field(default=None, max_length=500)


class AppointmentRescheduleIn(CamelModel):
    slot_id: uuid.UUID


# --- S17: the representative's own calendar ------------------------------------------------------


class OwnProfileOut(CamelModel):
    """The representative's own profile, with every contact route and whether they approved it."""

    id: uuid.UUID
    role_en: str
    role_ta: str
    display_name_en: str
    display_name_ta: str
    area_key: str
    office_hours_en: str
    office_hours_ta: str
    public_phone: str | None
    public_email: str | None
    office_address_en: str | None
    office_address_ta: str | None
    contacts_approved_at: datetime | None = Field(description="Members see the contact routes only once this is set")
    state: ProfileState
    withdrawn_reason: str | None

    @classmethod
    def fields(cls, r: Representative) -> dict:  # type: ignore[type-arg]
        return {
            "id": r.id, "role_en": r.role_en, "role_ta": r.role_ta, "display_name_en": r.display_name_en,
            "display_name_ta": r.display_name_ta, "area_key": r.area_key, "office_hours_en": r.office_hours_en,
            "office_hours_ta": r.office_hours_ta, "public_phone": r.public_phone, "public_email": r.public_email,
            "office_address_en": r.office_address_en, "office_address_ta": r.office_address_ta,
            "contacts_approved_at": r.contacts_approved_at, "state": r.state, "withdrawn_reason": r.withdrawn_reason,
        }

    @classmethod
    def build(cls, r: Representative) -> "OwnProfileOut":
        return cls(**cls.fields(r))


class BookingOut(AppointmentOut):
    """S17: a booking as the representative sees it: who booked, their needs, contact and any linked case."""

    member_name: str
    member_code: str
    case_consent_at: datetime | None

    @classmethod
    def with_member(cls, a: Appointment, member: tuple[str, str]) -> "BookingOut":
        return cls(**AppointmentOut.fields(a), member_name=member[0], member_code=member[1],
                   case_consent_at=a.case_consent_at)


class CalendarSlotOut(AppointmentSlotOut):
    state: Literal["open", "withdrawn"]
    withdrawn_reason: str | None
    booking: BookingOut | None = Field(description="The live booking, or the last cancelled one")


class CalendarOut(CamelModel):
    profile: OwnProfileOut | None = Field(description="None until a profile manager creates the person's profile")
    slots: list[CalendarSlotOut]


class OwnProfileIn(CamelModel):
    office_hours_en: str = Field(min_length=3, max_length=500)
    office_hours_ta: str = Field(min_length=3, max_length=700)
    public_phone: str | None = Field(default=None, max_length=20, pattern=r"^\s*(\+94|0)[0-9\s-]{9,12}\s*$|^\s*$")
    public_email: str | None = Field(default=None, max_length=200)
    office_address_en: str | None = Field(default=None, max_length=300)
    office_address_ta: str | None = Field(default=None, max_length=450)
    show_contacts: bool = Field(description="The person's approval to show these routes to members (BR-143)")


class ContactApprovalIn(CamelModel):
    approve: bool


class SlotSeriesIn(CamelModel):
    starts_at: datetime = Field(description="The first slot's start, with its time zone")
    minutes: int = Field(ge=rules.MIN_SLOT_MINUTES, le=rules.MAX_SLOT_MINUTES, description="Length of each slot")
    count: int = Field(ge=1, le=rules.MAX_SLOTS_PER_SERIES, description="Consecutive slots of that length")
    mode: SlotMode
    place_en: str | None = Field(default=None, max_length=300, description="Required in person: an official office")
    place_ta: str | None = Field(default=None, max_length=450)


class SlotWithdrawIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class BookingCancelIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500, description="Shown to the member")


class AppointmentFollowUpIn(CamelModel):
    outcome: Outcome
    note: str | None = Field(default=None, max_length=2000, description="Shown to the member; required when completed")


# --- D29: profiles managed for the areas ---------------------------------------------------------


class RepresentativeAreaIn(CamelModel):
    level: AreaLevel
    code: str = Field(min_length=2, max_length=20)


class RepresentativeProfileIn(CamelModel):
    role_en: str = Field(min_length=3, max_length=160, description="The official role, such as District Coordinator")
    role_ta: str = Field(min_length=3, max_length=220)
    display_name_en: str = Field(min_length=2, max_length=120)
    display_name_ta: str = Field(min_length=2, max_length=160)
    office_hours_en: str = Field(min_length=3, max_length=500)
    office_hours_ta: str = Field(min_length=3, max_length=700)
    public_phone: str | None = Field(default=None, max_length=20, pattern=r"^\s*(\+94|0)[0-9\s-]{9,12}\s*$|^\s*$")
    public_email: str | None = Field(default=None, max_length=200)
    office_address_en: str | None = Field(default=None, max_length=300)
    office_address_ta: str | None = Field(default=None, max_length=450)


class RepresentativeCreateIn(RepresentativeProfileIn):
    member_code: str = Field(min_length=3, max_length=40, description="The member ID of the person holding the role")
    area: RepresentativeAreaIn


class ProfileWithdrawIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class ProfileSlotOut(AppointmentSlotOut):
    """D29 sees whether a slot is taken, never by whom."""

    state: Literal["open", "withdrawn"]
    booked: bool

    @classmethod
    def build(cls, s: Slot) -> "ProfileSlotOut":  # type: ignore[override]
        return cls(**AppointmentSlotOut.fields(s), state=s.state, booked=s.booking_id is not None)  # type: ignore[arg-type]


class RepresentativeManagedOut(OwnProfileOut):
    open_slots: int
    next_open_slot: datetime | None
    published_at: datetime | None
    updated_at: datetime

    @classmethod
    def build(cls, r: Representative) -> "RepresentativeManagedOut":  # type: ignore[override]
        return cls(**OwnProfileOut.fields(r), open_slots=r.open_slots, next_open_slot=r.next_open_slot,
                   published_at=r.published_at, updated_at=r.updated_at)


class RepresentativeManagedDetailOut(RepresentativeManagedOut):
    holds_calendar_permission: bool = Field(description="Whether the person holds PRM-56, needed to publish")
    slots: list[ProfileSlotOut]
