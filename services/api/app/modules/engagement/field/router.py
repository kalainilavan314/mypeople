"""Offline field visits (BRD S05 to S07, D24, FR-FLD-001 to 009): /v1/field."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import Field

from app.core.request_info import client_ip
from app.core.schemas import CamelModel
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.engagement.field import rules, service
from app.modules.engagement.field.repository import Visit
from app.modules.engagement.field.rules import Concern
from app.modules.features.dependencies import require_feature
from sqlalchemy.orm import Session

Db = Annotated[Session, Depends(get_db)]
Collector = Annotated[Staff, Depends(require_permission(rules.PERMISSION))]

router = APIRouter(prefix="/v1/field", tags=["field"], dependencies=[Depends(require_feature("field_visits"))])


class FieldVisitIn(CamelModel):
    client_id: uuid.UUID = Field(description="Made on the phone; the same visit always has the same id")
    base_version: int | None = Field(default=None, description="The server version this edit started from; null for a new visit")
    gn_code: str = Field(min_length=3, max_length=20, description="Chosen by hand; location is never tracked")
    visited_at: datetime
    consent: Literal["given", "declined"]
    concerns: list[Concern] = Field(default_factory=list, max_length=12)
    notes: str | None = Field(default=None, max_length=1000)
    place_text: str | None = Field(default=None, max_length=200)
    follow_up: str | None = Field(default=None, max_length=500)
    case_number: str | None = Field(default=None, pattern=r"^CI-[0-9]{5,}$")
    confirmed_not_political: bool = False


class SyncIn(CamelModel):
    visits: list[FieldVisitIn] = Field(max_length=200)


class FieldVisitOut(CamelModel):
    id: uuid.UUID
    visit_ref: str
    client_id: uuid.UUID
    coordinator_name: str
    gn_code: str
    visited_at: datetime
    consent: Literal["given", "declined"]
    concerns: list[str]
    notes: str | None
    place_text: str | None
    follow_up: str | None
    follow_up_done_at: datetime | None
    case_number: str | None
    version: int
    updated_at: datetime

    @classmethod
    def build(cls, v: Visit) -> "FieldVisitOut":
        return cls(
            id=v.id, visit_ref=v.visit_ref, client_id=v.client_id, coordinator_name=v.coordinator_name, gn_code=v.gn_code,
            visited_at=v.visited_at, consent=v.consent, concerns=v.concerns, notes=v.notes,  # type: ignore[arg-type]
            place_text=v.place_text, follow_up=v.follow_up, follow_up_done_at=v.follow_up_done_at,
            case_number=v.case_number, version=v.version, updated_at=v.updated_at,
        )


class SyncResultOut(CamelModel):
    client_id: uuid.UUID
    outcome: Literal["created", "updated", "unchanged", "conflict", "refused"]
    problems: list[str] = Field(description="outside_your_area, concerns_required, political_content, ...")
    visit: FieldVisitOut | None = Field(description="The server's copy; on a conflict, the version to compare with")


class FollowUpIn(CamelModel):
    done: bool


class VisitCountOut(CamelModel):
    gn_code: str
    concern: str
    visits: int


@router.post("/visits/sync", response_model=list[SyncResultOut])
def sync(body: SyncIn, staff: Collector, request: Request, db: Db) -> list[SyncResultOut]:
    """S07: send visits made offline; each comes back created, updated, in conflict or refused."""
    items = [service.VisitIn(**v.model_dump()) for v in body.visits]
    try:
        results = service.sync(db, staff, items, client_ip(request))
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    return [SyncResultOut(client_id=r.client_id, outcome=r.outcome, problems=r.problems,
                          visit=FieldVisitOut.build(r.visit) if r.visit else None) for r in results]


@router.get("/visits/mine", response_model=list[FieldVisitOut])
def my_visits(staff: Collector, db: Db, since: datetime | None = None) -> list[FieldVisitOut]:
    """The coordinator's own visits with the server's versions, to refresh the phone's copy."""
    return [FieldVisitOut.build(v) for v in service.my_visits(db, staff, since)]


@router.get("/manage/visits", response_model=list[FieldVisitOut])
def supervised(staff: Collector, db: Db, open_follow_ups: Annotated[bool, Query(alias="openFollowUps")] = False) -> list[FieldVisitOut]:
    """D24: visits and follow-ups in the supervisor's areas."""
    return [FieldVisitOut.build(v) for v in service.supervised(db, staff, open_follow_ups)]


@router.get("/manage/counts", response_model=list[VisitCountOut])
def counts(staff: Collector, db: Db) -> list[VisitCountOut]:
    return [VisitCountOut(gn_code=g, concern=c, visits=n) for g, c, n in service.counts(db, staff)]


@router.post("/manage/visits/{visit_id}/follow-up", response_model=FieldVisitOut)
def set_follow_up(visit_id: uuid.UUID, body: FollowUpIn, staff: Collector, request: Request, db: Db) -> FieldVisitOut:
    try:
        return FieldVisitOut.build(service.set_follow_up(db, staff, visit_id, body.done, client_ip(request)))
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
