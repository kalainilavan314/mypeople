import uuid
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AreaRef
from app.modules.events.repository import StoredEvent

EventType = Literal["community_meeting", "service_day", "training", "cultural", "town_hall", "other"]
RsvpStateOut = Literal["going", "maybe", "declined", "waitlisted"]


def _summary_fields(event: StoredEvent, my_response: str | None) -> dict[str, object]:
    return {
        "id": event.id,
        "event_ref": event.event_ref,
        "title_en": event.title_en,
        "title_ta": event.title_ta,
        "event_type": event.event_type,
        "starts_at": event.starts_at,
        "ends_at": event.ends_at,
        "venue": event.venue,
        "area_key": event.area_key,
        "state": event.state,
        "my_response": my_response,
        "capacity": event.capacity,
        "places_left": None if event.capacity is None else max(event.capacity - event.going, 0),
    }


class EventSummaryOut(CamelModel):
    """An event card (FR-EVT-002): the member's response is given in words, never only by colour."""

    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    event_type: str
    starts_at: datetime
    ends_at: datetime
    venue: str
    area_key: str
    state: Literal["published", "cancelled"]
    my_response: RsvpStateOut | None
    capacity: int | None
    places_left: int | None = Field(description="Null when the event has no capacity limit")

    @classmethod
    def build(cls, event: StoredEvent, my_response: str | None) -> "EventSummaryOut":
        return cls.model_validate(_summary_fields(event, my_response))


class RsvpChangeOut(CamelModel):
    response: RsvpStateOut
    changed_at: datetime


class EventDetailOut(EventSummaryOut):
    """E04: schedule, venue and meeting point, agenda, organiser contact route and accessibility
    information come before the RSVP control (FR-EVT-007)."""

    description_en: str
    description_ta: str
    meeting_point: str
    agenda: str
    accessibility: str
    contact_route: str
    checkin_opens_at: datetime
    checkin_closes_at: datetime
    cancel_reason: str | None
    my_history: list[RsvpChangeOut]
    attended_at: datetime | None


class RsvpInput(CamelModel):
    response: Literal["going", "maybe", "declined"] = Field(description="No reason is asked for declining (BR-059)")


class RsvpOut(CamelModel):
    response: RsvpStateOut = Field(description="waitlisted when Going was chosen for a full event")


class EventPassOut(CamelModel):
    """E06 besides the QR: time, venue, meeting point and what to do (FR-EVT-014)."""

    event_id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    starts_at: datetime
    ends_at: datetime
    venue: str
    meeting_point: str
    checkin_opens_at: datetime
    checkin_closes_at: datetime
    attended_at: datetime | None = Field(description="Set once a scan has recorded attendance")
    instructions_en: str = "Show this pass to the authorised staff at the entrance."
    instructions_ta: str = "நுழைவாயிலில் அங்கீகரிக்கப்பட்ட பணியாளரிடம் இந்த அனுமதிச்சீட்டைக் காட்டவும்."


class PassCodeOut(CamelModel):
    code: str = Field(description="Show as a black-on-white QR; ask for a new one at expiresAt")
    expires_at: datetime


# --- Event managers ---------------------------------------------------------------------------------


class EventDetailsIn(CamelModel):
    title_en: str = Field(min_length=1, max_length=160)
    title_ta: str = Field(min_length=1, max_length=160)
    description_en: str = Field(default="", max_length=4000)
    description_ta: str = Field(default="", max_length=4000)
    event_type: EventType
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    checkin_opens_at: AwareDatetime | None = Field(default=None, description="Default: an hour before the start")
    checkin_closes_at: AwareDatetime | None = Field(default=None, description="Default: the end")
    venue: str = Field(min_length=1, max_length=300)
    meeting_point: str = Field(default="", max_length=300)
    agenda: str = Field(default="", max_length=4000)
    accessibility: str = Field(default="", max_length=1000)
    contact_route: str = Field(default="", max_length=300, description="An approved route, never a private number")
    capacity: int | None = Field(default=None, gt=0)
    admits_pending: bool = Field(default=False, description="OD-12: passes for members whose membership is pending")


class EventCreateIn(EventDetailsIn):
    area: AreaRef


class EventUpdateIn(CamelModel):
    """Only the fields sent change; the area stays as created."""

    title_en: str | None = Field(default=None, min_length=1, max_length=160)
    title_ta: str | None = Field(default=None, min_length=1, max_length=160)
    description_en: str | None = Field(default=None, max_length=4000)
    description_ta: str | None = Field(default=None, max_length=4000)
    event_type: EventType | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    checkin_opens_at: AwareDatetime | None = None
    checkin_closes_at: AwareDatetime | None = None
    venue: str | None = Field(default=None, min_length=1, max_length=300)
    meeting_point: str | None = Field(default=None, max_length=300)
    agenda: str | None = Field(default=None, max_length=4000)
    accessibility: str | None = Field(default=None, max_length=1000)
    contact_route: str | None = Field(default=None, max_length=300)
    capacity: int | None = Field(default=None, gt=0)
    admits_pending: bool | None = None


class CancelIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class ManagedEventOut(EventDetailOut):
    state: Literal["draft", "published", "cancelled"]  # type: ignore[assignment]
    area_path: list[str]
    admits_pending: bool
    going: int
    waitlisted: int
    published_at: datetime | None
    cancelled_at: datetime | None
    notified: int = Field(default=0, description="Members sent an SMS about this change")

    @classmethod
    def managed(cls, event: StoredEvent, notified: int = 0) -> "ManagedEventOut":
        return cls(
            **_summary_fields(event, None),  # type: ignore[arg-type]
            description_en=event.description_en,
            description_ta=event.description_ta,
            meeting_point=event.meeting_point,
            agenda=event.agenda,
            accessibility=event.accessibility,
            contact_route=event.contact_route,
            checkin_opens_at=event.checkin_opens_at,
            checkin_closes_at=event.checkin_closes_at,
            cancel_reason=event.cancel_reason,
            my_history=[],
            attended_at=None,
            area_path=event.area_path,
            admits_pending=event.admits_pending,
            going=event.going,
            waitlisted=event.waitlisted,
            published_at=event.published_at,
            cancelled_at=event.cancelled_at,
            notified=notified,
        )


class PassScanIn(CamelModel):
    code: str = Field(min_length=1, max_length=200)


class PassScanOut(CamelModel):
    """checked_in, already_checked_in, expired (ask the member to refresh), wrong_event,
    outside_window or not_valid. A name is shown only with a recorded attendance (BR-062)."""

    result: Literal["checked_in", "already_checked_in", "expired", "wrong_event", "outside_window", "not_valid"]
    full_name: str | None = None
    member_code: str | None = None
    attended_at: datetime | None = None


class RosterEntryOut(CamelModel):
    member_id: uuid.UUID
    full_name: str
    member_code: str
    response: RsvpStateOut | None
    attended_at: datetime | None


class RosterOut(CamelModel):
    event_id: uuid.UUID
    event_ref: str
    expected: int = Field(description="Members going")
    attended: int
    entries: list[RosterEntryOut]
