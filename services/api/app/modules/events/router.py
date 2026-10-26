import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.events import service
from app.modules.events.rules import MANAGE, SCAN
from app.modules.events.schemas import (
    ManualCheckInIn,
    ManualCheckInOut,
    CancelIn,
    EventCreateIn,
    EventDetailOut,
    EventPassOut,
    EventSummaryOut,
    EventUpdateIn,
    ManagedEventOut,
    PassCodeOut,
    RosterEntryOut,
    RosterOut,
    RsvpChangeOut,
    RsvpInput,
    RsvpOut,
    PassScanIn,
    PassScanOut,
)

router = APIRouter(prefix="/v1/events", tags=["events"])

Db = Annotated[Session, Depends(get_db)]
CanManage = Annotated[Staff, Depends(require_permission(MANAGE))]
CanScan = Annotated[Staff, Depends(require_permission(SCAN))]

NOT_FOUND = {404: {"description": "not_found"}}
REFUSED = {403: {"description": "forbidden or outside_your_area"}, **NOT_FOUND}


def _secret(request: Request) -> str:
    return request.app.state.settings.jwt_secret.get_secret_value()


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


def _refused(error: service.EventRefused) -> HTTPException:
    if error.code == "not_found":
        return _not_found()
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


def _invalid(error: service.EventInvalid) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "event_invalid", "problems": error.problems}
    )


def _send(background: BackgroundTasks, request: Request, notice: service.Notice | None) -> int:
    """Notices go after the response; returns how many members will be sent one."""
    if notice is None or not notice.phones:
        return 0
    background.add_task(service.deliver, request.app.state.sms, notice)
    return len(notice.phones)


# --- Event managers (GAP-03, FR-ADM-004) --------------------------------------------------------------
# Declared before /{event_id}, so "manage" is never read as an event id.


@router.get("/manage")
def list_managed_events(
    staff: CanManage,
    db: Db,
    state: Annotated[list[Literal["draft", "published", "cancelled"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ManagedEventOut]:
    """Events in the areas where the caller holds events.manage, drafts included, soonest first."""
    states = list(state) if state else ["draft", "published"]
    return [ManagedEventOut.managed(event) for event in service.managed_events(db, staff, states, limit)]


@router.get("/manage/{event_id}", responses=REFUSED)
def read_managed_event(event_id: uuid.UUID, staff: CanManage, request: Request, db: Db) -> ManagedEventOut:
    try:
        event = service.managed_event(db, staff, event_id, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return ManagedEventOut.managed(event)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    responses={**REFUSED, 422: {"description": '{"code": "event_invalid", "problems": [...]}'}},
)
def create_event(body: EventCreateIn, staff: CanManage, request: Request, db: Db) -> ManagedEventOut:
    """A draft event in an area where the caller holds events.manage (FR-ADM-004)."""
    details = body.model_dump(exclude={"area"})
    try:
        event = service.create_event(
            db, staff, details, Area(body.area.level, body.area.code), client_ip(request)
        )
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.EventInvalid as error:
        raise _invalid(error) from None
    return ManagedEventOut.managed(event)


@router.patch(
    "/{event_id}",
    responses={
        **REFUSED,
        409: {"description": "not_allowed_from:cancelled, or silence_period for a published event moved into one"},
        422: {"description": "event_invalid"},
    },
)
def update_event(
    event_id: uuid.UUID, body: EventUpdateIn, staff: CanManage, request: Request, background: BackgroundTasks, db: Db
) -> ManagedEventOut:
    """Edit a draft or published event. Members who responded are told by SMS when a published
    event's time or place changes."""
    changes = body.model_dump(exclude_unset=True)
    try:
        event, notice = service.update_event(db, staff, event_id, changes, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.EventRefused as error:
        raise _refused(error) from None
    except service.EventInvalid as error:
        raise _invalid(error) from None
    return ManagedEventOut.managed(event, _send(background, request, notice))


@router.post(
    "/{event_id}/publish", responses={**REFUSED, 409: {"description": "not_allowed_from:<state> or silence_period"}}
)
def publish_event(event_id: uuid.UUID, staff: CanManage, request: Request, db: Db) -> ManagedEventOut:
    try:
        event = service.publish_event(db, staff, event_id, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.EventRefused as error:
        raise _refused(error) from None
    return ManagedEventOut.managed(event)


@router.post("/{event_id}/cancel", responses={**REFUSED, 409: {"description": "not_allowed_from:cancelled"}})
def cancel_event(
    event_id: uuid.UUID, body: CancelIn, staff: CanManage, request: Request, background: BackgroundTasks, db: Db
) -> ManagedEventOut:
    """Cancel with a reason: every pass stops working, and members going, maybe going or
    waitlisted are told by SMS."""
    try:
        event, notice = service.cancel_event(db, staff, event_id, body.reason, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.EventRefused as error:
        raise _refused(error) from None
    return ManagedEventOut.managed(event, _send(background, request, notice))


@router.post("/{event_id}/scan", responses=REFUSED)
def scan_pass(event_id: uuid.UUID, body: PassScanIn, staff: CanScan, request: Request, db: Db) -> PassScanOut:
    """Check a pass in at this event; needs events.checkin_scan over the event's area. A repeat
    scan records nothing new (BR-061); an expired code asks the member to refresh (BR-062)."""
    try:
        check_in = service.scan(db, staff, event_id, body.code, _secret(request), client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return PassScanOut(
        result=check_in.result,  # type: ignore[arg-type]
        full_name=check_in.full_name,
        member_code=check_in.member_code,
        attended_at=check_in.attended_at,
    )


@router.post("/{event_id}/checkin/manual", responses=REFUSED)
def check_in_manually(
    event_id: uuid.UUID, body: ManualCheckInIn, staff: CanScan, request: Request, db: Db
) -> ManualCheckInOut:
    """FR-VOI-007: check a member in by the member ID on their card when the pass cannot be scanned
    (camera refused or broken, no phone). Same permission, window and eligibility as a scan; the
    reason is kept on the attendance record and the roster shows it was manual."""
    try:
        check_in = service.check_in_manually(db, staff, event_id, body.member_code, body.reason, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return ManualCheckInOut(
        result=check_in.result,  # type: ignore[arg-type]
        full_name=check_in.full_name,
        member_code=check_in.member_code,
        attended_at=check_in.attended_at,
    )


@router.get("/{event_id}/attendance", responses=REFUSED)
def read_attendance(event_id: uuid.UUID, staff: CanScan, request: Request, db: Db) -> RosterOut:
    """S09: who is expected and who has attended, for an event in the caller's scope (FR-STF-006)."""
    try:
        roster = service.attendance_roster(db, staff, event_id, client_ip(request))
    except service.EventNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return RosterOut(
        event_id=roster.event.id,
        event_ref=roster.event.event_ref,
        expected=roster.expected,
        attended=roster.attended,
        entries=[
            RosterEntryOut(
                member_id=entry.member_id,
                full_name=entry.full_name,
                member_code=entry.member_code,
                response=entry.response,  # type: ignore[arg-type]
                attended_at=entry.attended_at,
                checkin_method=entry.checkin_method,  # type: ignore[arg-type]
            )
            for entry in roster.entries
        ],
    )


# --- Members (E01 to E06) -------------------------------------------------------------------------------


@router.get("")
def list_events(
    member: CurrentMember,
    db: Db,
    scope: Annotated[Literal["mine", "all"], Query(description="mine (the default): events for the member's area")] = "mine",
    area: Annotated[str | None, Query(max_length=40, description="Only events within this area, e.g. district:LK41")] = None,
    until: Annotated[datetime | None, Query(description="Only events starting before this time")] = None,
    event_type: Annotated[str | None, Query(alias="type", max_length=40)] = None,
    participation: Annotated[Literal["going", "maybe", "declined", "waitlisted"] | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=100, description="Search titles and venues")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[EventSummaryOut]:
    """E01: published events still to come, soonest first, with the member's response (FR-EVT-001,
    002, 005). Cancelled ones stay listed, marked cancelled. "My area" is only a default (BR-057)."""
    filters = service.EventFilters(
        mine=scope == "mine",
        within_area=area,
        starts_before=until if until is None or until.tzinfo else until.replace(tzinfo=UTC),
        event_type=event_type,
        participation=participation,
        search=q.strip() if q else None,
        limit=limit,
    )
    return [EventSummaryOut.build(item.event, item.my_response) for item in service.list_events(db, member.id, filters)]


@router.get("/{event_id}", responses=NOT_FOUND)
def read_event(event_id: uuid.UUID, member: CurrentMember, db: Db) -> EventDetailOut:
    """E04: everything a member needs before responding (FR-EVT-007), and their response history."""
    try:
        detail = service.event_detail(db, member.id, event_id)
    except service.EventNotFound:
        raise _not_found() from None
    event = detail.event
    return EventDetailOut(
        **EventSummaryOut.build(event, detail.my_response).model_dump(),
        description_en=event.description_en,
        description_ta=event.description_ta,
        meeting_point=event.meeting_point,
        agenda=event.agenda,
        accessibility=event.accessibility,
        contact_route=event.contact_route,
        checkin_opens_at=event.checkin_opens_at,
        checkin_closes_at=event.checkin_closes_at,
        cancel_reason=event.cancel_reason,
        my_history=[RsvpChangeOut(response=c.response, changed_at=c.changed_at) for c in detail.my_history],  # type: ignore[arg-type]
        attended_at=detail.attended_at,
    )


@router.put("/{event_id}/rsvp", responses={**NOT_FOUND, 409: {"description": "event_cancelled or event_over"}})
def respond(event_id: uuid.UUID, body: RsvpInput, member: CurrentMember, db: Db) -> RsvpOut:
    """E05: going, maybe or declined; changing it updates the one RSVP (FR-EVT-009, 010). Going on a
    full event joins the waitlist (FR-EVT-011)."""
    try:
        state = service.respond(db, member.id, event_id, body.response)
    except service.EventNotFound:
        raise _not_found() from None
    except service.EventRefused as error:
        raise _refused(error) from None
    return RsvpOut(response=state)  # type: ignore[arg-type]


PASS_REFUSED = {
    **NOT_FOUND,
    409: {"description": "not_going, membership_not_active, event_cancelled or event_over"},
}


@router.get("/{event_id}/pass", responses=PASS_REFUSED)
def read_pass(event_id: uuid.UUID, member: CurrentMember, db: Db) -> EventPassOut:
    """E06: only for a member going to the event (FR-EVT-012, 014)."""
    try:
        event_pass = service.my_pass(db, member.id, event_id)
    except service.EventNotFound:
        raise _not_found() from None
    except service.EventRefused as error:
        raise _refused(error) from None
    event = event_pass.event
    return EventPassOut(
        event_id=event.id,
        event_ref=event.event_ref,
        title_en=event.title_en,
        title_ta=event.title_ta,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        venue=event.venue,
        meeting_point=event.meeting_point,
        checkin_opens_at=event.checkin_opens_at,
        checkin_closes_at=event.checkin_closes_at,
        attended_at=event_pass.attended_at,
    )


@router.get("/{event_id}/pass/code", responses=PASS_REFUSED)
def read_pass_code(event_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> PassCodeOut:
    """A pass code valid for 60 seconds, bound to this event and this member (FR-EVT-013)."""
    try:
        code = service.my_pass_code(db, member.id, event_id, _secret(request))
    except service.EventNotFound:
        raise _not_found() from None
    except service.EventRefused as error:
        raise _refused(error) from None
    return PassCodeOut(code=code.code, expires_at=datetime.fromtimestamp(code.expires_at, UTC))
