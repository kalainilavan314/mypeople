"""Diaspora participation (BRD M46; FR-DSP-001 to 006): /v1/diaspora.

There is no payment route here: foreign and cross-border contributions stay switched off until
the approvals in OD-40 are recorded (OS-16), and /v1/diaspora/me says so.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.diaspora import service
from app.modules.diaspora.schemas import (
    DiasporaOptionsOut,
    DiasporaSummaryOut,
    DiasporaInternationalEventOut,
    DiasporaInternationalIn,
    DiasporaEventOut,
    DiasporaMeOut,
    DiasporaOpportunityOut,
    DiasporaSupporterIn,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
EventManager = Annotated[Staff, Depends(require_permission(service.MARK_EVENTS))]
Analyst = Annotated[Staff, Depends(require_permission(service.SUMMARY))]

router = APIRouter(prefix="/v1/diaspora", tags=["diaspora"], dependencies=[Depends(require_feature("diaspora"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.DiasporaNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.DiasporaRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "diaspora_refused", "problems": error.problems}
        ) from None


@router.get("/options", response_model=DiasporaOptionsOut)
def read_options(member: CurrentMember, db: Db) -> DiasporaOptionsOut:
    """The countries with their time zones, the contact topics and the skills to choose from."""
    return DiasporaOptionsOut.build(service.options(db))


@router.get("/me", response_model=DiasporaMeOut)
def read_me(member: CurrentMember, db: Db) -> DiasporaMeOut:
    return DiasporaMeOut.build(service.me(db, member.id))


@router.put("/me", response_model=DiasporaMeOut)
def register(body: DiasporaSupporterIn, member: CurrentMember, request: Request, db: Db) -> DiasporaMeOut:
    """FR-DSP-001: register or update; separate from identity verification and with no contribution rights."""
    with _answers():
        return DiasporaMeOut.build(service.register(
            db, member.id, country_code=body.country_code, time_zone=body.time_zone, topics=list(body.contact_topics),
            skills=body.skills, consent=body.consent, ip=client_ip(request),
        ))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def withdraw(member: CurrentMember, request: Request, db: Db) -> Response:
    service.withdraw(db, member.id, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/events", response_model=list[DiasporaInternationalEventOut])
def list_events(member: CurrentMember, db: Db) -> list[DiasporaInternationalEventOut]:
    """FR-DSP-002: international events in Sri Lanka time and in the supporter's own time zone."""
    return [DiasporaInternationalEventOut.build(view) for view in service.events(db, member.id)]


@router.get("/opportunities", response_model=list[DiasporaOpportunityOut])
def list_opportunities(member: CurrentMember, db: Db) -> list[DiasporaOpportunityOut]:
    """FR-DSP-003: remote, skill-based volunteering; offering to help goes through volunteering."""
    return [DiasporaOpportunityOut.build(view) for view in service.opportunities(db, member.id)]


@router.get("/manage/events", response_model=list[DiasporaEventOut])
def list_managed_events(staff: EventManager, db: Db) -> list[DiasporaEventOut]:
    return [DiasporaEventOut.build(e) for e in service.managed_events(db, staff)]


@router.put("/manage/events/{event_id}", response_model=DiasporaEventOut)
def set_international(event_id: uuid.UUID, body: DiasporaInternationalIn, staff: EventManager, request: Request,
                      db: Db) -> DiasporaEventOut:
    """List an event for supporters abroad, or take it off the list."""
    with _answers():
        return DiasporaEventOut.build(service.set_international(db, staff, event_id, body.international, client_ip(request)))


@router.get("/manage/summary", response_model=DiasporaSummaryOut)
def read_summary(staff: Analyst, request: Request, db: Db) -> DiasporaSummaryOut:
    """Counts only, small numbers hidden: by country, by contact topic, and diaspora proposals by stage."""
    with _answers():
        return DiasporaSummaryOut.build(service.summary(db, staff, client_ip(request)))
