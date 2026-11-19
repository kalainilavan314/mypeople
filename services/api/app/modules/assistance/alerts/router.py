"""Alerts and safety (BRD M35, M36, D26, FR-DIS-001 to 004, 006 to 008): /v1/alerts."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.assistance.alerts import rules, service
from app.modules.assistance.alerts.schemas import (
    AlertComposerOut,
    AlertOut,
    AlertRefreshIn,
    AlertRelayIn,
    AlertWithdrawIn,
    ManagedAlertOut,
    ReliefOfferIn,
    ReliefOfferOut,
    ReliefVolunteerOut,
    SafetyHelpIn,
    SafetyHelpOut,
    SafetyHomeOut,
    ShelterCreateIn,
    ShelterIn,
    ShelterOut,
    contacts,
    sources,
)
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Relayer = Annotated[Staff, Depends(require_permission(rules.RELAY))]
Coordinator = Annotated[Staff, Depends(require_permission(rules.LOGISTICS))]
AreaQuery = Annotated[str | None, Query(max_length=40, description="An area key such as ds:LK4103; the home area when absent")]

router = APIRouter(prefix="/v1/alerts", tags=["alerts"], dependencies=[Depends(require_feature("disaster_alerts"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.SafetyNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.SafetyRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "safety_refused", "problems": error.problems}
        ) from None


def _now() -> datetime:
    return datetime.now(UTC)


# --- Members ------------------------------------------------------------------------------------------------


@router.get("", response_model=SafetyHomeOut)
def safety_home(member: CurrentMember, db: Db, area: AreaQuery = None) -> SafetyHomeOut:
    """M35: open to anyone signed in. Alerts follow the member's home area, or the area they chose; never GPS."""
    now = _now()
    with _answers():
        view = service.safety(db, member.id, area, now)
    return SafetyHomeOut(
        area_keys=view.area_keys, emergency_contacts=contacts(), current=[AlertOut.build(a, now) for a in view.current],
        shelters=[ShelterOut.build(s, now) for s in view.shelters],
        relief_offer=ReliefOfferOut.build(view.volunteer) if view.volunteer else None,
        relief_offer_lock=view.volunteer_lock,  # type: ignore[arg-type]
        relief_tasks=list(rules.RELIEF_TASKS), help_needs=list(rules.HELP_NEEDS), checked_at=now,
    )


@router.get("/history", response_model=list[AlertOut])
def alert_history(member: CurrentMember, db: Db, area: AreaQuery = None) -> list[AlertOut]:
    """FR-DIS-008: expired and withdrawn alerts of the last 90 days."""
    now = _now()
    with _answers():
        return [AlertOut.build(a, now) for a in service.history(db, member.id, area, now)]


@router.post("/help", status_code=status.HTTP_201_CREATED, response_model=SafetyHelpOut)
def request_help(body: SafetyHelpIn, member: CurrentMember, request: Request, db: Db) -> SafetyHelpOut:
    """M36: an urgent Community Support case for follow-up; nobody is dispatched (OS-14). 422 support_not_open
    while Community Support is switched off."""
    with _answers():
        case = service.request_help(
            db, member.id,
            service.HelpRequest(need=body.need, people=body.people, details=body.details, full_name=body.full_name,
                                phone=body.phone, area=Area(body.area.level, body.area.code) if body.area else None,
                                alert_id=body.alert_id, consent=body.consent),
            client_ip(request), flags_enforced=request.app.state.settings.feature_flags_enforced,
        )
    return SafetyHelpOut(case_id=case.id, case_ref=case.case_ref)


@router.put("/relief-offer", response_model=ReliefOfferOut)
def save_relief_offer(body: ReliefOfferIn, member: CurrentMember, request: Request, db: Db) -> ReliefOfferOut:
    """FR-DIS-004: offer relief help in the home area until a date; Verified and Active members."""
    with _answers():
        return ReliefOfferOut.build(service.save_volunteer(db, member.id, tasks=list(body.tasks),
                                                           available_until=body.available_until, consent=body.consent,
                                                           ip=client_ip(request), now=_now()))


@router.delete("/relief-offer", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def withdraw_relief_offer(member: CurrentMember, request: Request, db: Db) -> Response:
    with _answers():
        service.withdraw_volunteer(db, member.id, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Staff (D26) ---------------------------------------------------------------------------------------------


@router.get("/manage", response_model=list[ManagedAlertOut])
def managed_alerts(staff: Relayer, db: Db, current: bool = True) -> list[ManagedAlertOut]:
    """Current alerts in the relayer's areas, the ones longest unchecked first; or the history."""
    now = _now()
    with _answers():
        return [ManagedAlertOut.managed(m.alert, now=now) for m in service.managed(db, staff, current=current, now=now)]


@router.get("/manage/composer", response_model=AlertComposerOut)
def composer(staff: Relayer) -> AlertComposerOut:
    return AlertComposerOut(sources=sources(), hazards=list(rules.HAZARDS), severities=list(rules.SEVERITIES),
                            longest_alert_days=rules.LONGEST_ALERT.days,
                            stale_after_hours=int(rules.STALE_AFTER.total_seconds() // 3600))


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=ManagedAlertOut)
def relay_alert(body: AlertRelayIn, staff: Relayer, request: Request, db: Db) -> ManagedAlertOut:
    """FR-DIS-001, 002: relay an official warning; members of the targeted areas are told at once."""
    values = body.model_dump(exclude={"targets"})
    now = _now()
    with _answers():
        relayed = service.relay(db, staff, values, [Area(t.level, t.code) for t in body.targets], client_ip(request), now)
        view = service.staff_alert(db, staff, relayed.id, now)
    return ManagedAlertOut.managed(view.alert, view.revisions, now)


@router.get("/manage/shelters", response_model=list[ShelterOut])
def managed_shelters(staff: Relayer, db: Db) -> list[ShelterOut]:
    now = _now()
    with _answers():
        return [ShelterOut.build(s, now) for s in service.managed_shelters(db, staff)]


@router.post("/manage/shelters", status_code=status.HTTP_201_CREATED, response_model=ShelterOut)
def add_shelter(body: ShelterCreateIn, staff: Relayer, request: Request, db: Db) -> ShelterOut:
    """FR-DIS-006: shelter information from an authorised source, with the time it reported."""
    values = body.model_dump(exclude={"area"})
    with _answers():
        return ShelterOut.build(service.add_shelter(db, staff, values, Area(body.area.level, body.area.code),
                                                    client_ip(request), _now()))


@router.put("/manage/shelters/{shelter_id}", response_model=ShelterOut)
def update_shelter(shelter_id: uuid.UUID, body: ShelterIn, staff: Relayer, request: Request, db: Db) -> ShelterOut:
    with _answers():
        return ShelterOut.build(service.update_shelter(db, staff, shelter_id, body.model_dump(), client_ip(request), _now()))


@router.get("/manage/volunteers", response_model=list[ReliefVolunteerOut])
def relief_volunteers(staff: Coordinator, db: Db) -> list[ReliefVolunteerOut]:
    """FR-DIS-004: members who offered relief help in the coordinator's areas."""
    with _answers():
        return [ReliefVolunteerOut.build(v) for v in service.relief_volunteers(db, staff, _now())]


@router.get("/manage/{alert_id}", response_model=ManagedAlertOut)
def read_managed(alert_id: uuid.UUID, staff: Relayer, db: Db) -> ManagedAlertOut:
    now = _now()
    with _answers():
        view = service.staff_alert(db, staff, alert_id, now)
    return ManagedAlertOut.managed(view.alert, view.revisions, now)


@router.post("/manage/{alert_id}/refresh", response_model=ManagedAlertOut)
def refresh_alert(alert_id: uuid.UUID, body: AlertRefreshIn, staff: Relayer, request: Request, db: Db) -> ManagedAlertOut:
    """FR-DIS-008: checked against the source again; the 6-hour flag clears."""
    now = _now()
    with _answers():
        service.refresh(db, staff, alert_id, body.model_dump(exclude={"note"}), body.note, client_ip(request), now)
        view = service.staff_alert(db, staff, alert_id, now)
    return ManagedAlertOut.managed(view.alert, view.revisions, now)


@router.post("/manage/{alert_id}/withdraw", response_model=ManagedAlertOut)
def withdraw_alert(alert_id: uuid.UUID, body: AlertWithdrawIn, staff: Relayer, request: Request, db: Db) -> ManagedAlertOut:
    now = _now()
    with _answers():
        service.withdraw(db, staff, alert_id, body.reason, client_ip(request), now)
        view = service.staff_alert(db, staff, alert_id, now)
    return ManagedAlertOut.managed(view.alert, view.revisions, now)


@router.get("/{alert_id}", response_model=AlertOut)
def read_alert(alert_id: uuid.UUID, member: CurrentMember, db: Db) -> AlertOut:
    """An official warning with its source, link, times and the emergency numbers (FR-DIS-001, 003)."""
    with _answers():
        return AlertOut.build(service.alert(db, alert_id))
