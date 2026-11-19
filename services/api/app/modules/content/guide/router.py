"""Welfare, jobs and livelihood guide (BRD M39, M40, D28, FR-LIV-001 to 006): /v1/guide."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.content.guide import rules, service
from app.modules.content.guide.rules import Category, State
from app.modules.content.guide.schemas import (
    GuideEntryDetailManagedOut,
    GuideEntryIn,
    GuideEntryManagedOut,
    GuideEntryOut,
    GuideEntrySummaryOut,
    GuideManagedReportOut,
    GuideReportIn,
    GuideReportOut,
    GuideReportResolutionIn,
    GuideReviewIn,
    GuideWithdrawIn,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
GuideStaff = Annotated[Staff, Depends(require_permission(rules.EDIT, rules.REVIEW))]
Editor = Annotated[Staff, Depends(require_permission(rules.EDIT))]
Reviewer = Annotated[Staff, Depends(require_permission(rules.REVIEW))]

router = APIRouter(prefix="/v1/guide", tags=["guide"], dependencies=[Depends(require_feature("livelihood_guide"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.GuideNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.GuideRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "guide_refused", "problems": error.problems}
        ) from None


def _managed(staff: Staff, entry: service.Entry) -> GuideEntryManagedOut:
    return GuideEntryManagedOut.build(entry, staff.member_id, service.today())


def _detail(staff: Staff, view: service.StaffView) -> GuideEntryDetailManagedOut:
    return GuideEntryDetailManagedOut(
        **_managed(staff, view.entry).model_dump(), reports=[GuideManagedReportOut.build(r) for r in view.reports]
    )


@router.get("", response_model=list[GuideEntrySummaryOut])
def search_guide(
    member: CurrentMember,
    db: Db,
    q: Annotated[str | None, Query(max_length=80, description="Words in either language")] = None,
    category: Category | None = None,
) -> list[GuideEntrySummaryOut]:
    """M39: published entries that have not passed their end date (FR-LIV-001, 003)."""
    return [GuideEntrySummaryOut.build(e) for e in service.search(db, q, category)]


@router.get("/manage", response_model=list[GuideEntryManagedOut])
def list_managed(
    staff: GuideStaff,
    db: Db,
    entry_state: Annotated[State | None, Query(alias="state")] = None,
    expired: Annotated[bool, Query(description="Only published entries past their end date")] = False,
    q: Annotated[str | None, Query(max_length=80)] = None,
) -> list[GuideEntryManagedOut]:
    with _answers():
        return [_managed(staff, e) for e in service.managed(db, staff, entry_state, expired, q)]


@router.get("/manage/reports", response_model=list[GuideManagedReportOut])
def report_queue(
    staff: GuideStaff,
    db: Db,
    report_state: Annotated[str | None, Query(alias="state", pattern="^(open|fixed|dismissed)$")] = "open",
) -> list[GuideManagedReportOut]:
    """D28: reports that an entry is outdated, oldest first (FR-LIV-006)."""
    with _answers():
        return [GuideManagedReportOut.build(r) for r in service.report_queue(db, staff, report_state)]


@router.post("/manage/reports/{report_id}/resolution", response_model=GuideManagedReportOut)
def resolve_report(report_id: uuid.UUID, body: GuideReportResolutionIn, staff: Editor, request: Request,
                   db: Db) -> GuideManagedReportOut:
    with _answers():
        return GuideManagedReportOut.build(service.resolve_report(db, staff, report_id, body.outcome, body.note,
                                                                  client_ip(request)))


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=GuideEntryDetailManagedOut)
def draft_entry(body: GuideEntryIn, staff: Editor, request: Request, db: Db) -> GuideEntryDetailManagedOut:
    with _answers():
        entry = service.save(db, staff, None, body.model_dump(), client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry.id))


@router.get("/manage/{entry_id}", response_model=GuideEntryDetailManagedOut)
def read_managed(entry_id: uuid.UUID, staff: GuideStaff, db: Db) -> GuideEntryDetailManagedOut:
    with _answers():
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.put("/manage/{entry_id}", response_model=GuideEntryDetailManagedOut)
def save_entry(entry_id: uuid.UUID, body: GuideEntryIn, staff: Editor, request: Request, db: Db) -> GuideEntryDetailManagedOut:
    """Saving a published entry takes it off the guide until it is reviewed again (FR-LIV-003)."""
    with _answers():
        service.save(db, staff, entry_id, body.model_dump(), client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.post("/manage/{entry_id}/request-review", response_model=GuideEntryDetailManagedOut)
def request_review(entry_id: uuid.UUID, staff: Editor, request: Request, db: Db) -> GuideEntryDetailManagedOut:
    """Refused without a source link, both languages or the dates (FR-LIV-002, 005)."""
    with _answers():
        service.request_review(db, staff, entry_id, client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.post("/manage/{entry_id}/review", response_model=GuideEntryDetailManagedOut)
def review_entry(entry_id: uuid.UUID, body: GuideReviewIn, staff: Reviewer, request: Request,
                 db: Db) -> GuideEntryDetailManagedOut:
    """A second person publishes or returns it; the person who asked or last changed it gets 403 own_entry."""
    with _answers():
        service.review(db, staff, entry_id, body.approve, body.note, client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.post("/manage/{entry_id}/verified", response_model=GuideEntryDetailManagedOut)
def mark_verified(entry_id: uuid.UUID, staff: Editor, request: Request, db: Db) -> GuideEntryDetailManagedOut:
    """The editor checked the published entry against its source today."""
    with _answers():
        service.mark_verified(db, staff, entry_id, client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.post("/manage/{entry_id}/withdraw", response_model=GuideEntryDetailManagedOut)
def withdraw_entry(entry_id: uuid.UUID, body: GuideWithdrawIn, staff: GuideStaff, request: Request,
                   db: Db) -> GuideEntryDetailManagedOut:
    with _answers():
        service.withdraw(db, staff, entry_id, body.reason, client_ip(request))
        return _detail(staff, service.staff_view(db, staff, entry_id))


@router.get("/{entry_id}", response_model=GuideEntryOut)
def read_entry(entry_id: uuid.UUID, member: CurrentMember, db: Db) -> GuideEntryOut:
    """M40: source link, publication and last-verified dates, and the eligibility disclaimer."""
    with _answers():
        view = service.member_view(db, member.id, entry_id)
        return GuideEntryOut.from_view(view.entry, view.my_open_report)


@router.post("/{entry_id}/reports", status_code=status.HTTP_201_CREATED, response_model=GuideReportOut)
def report_entry(entry_id: uuid.UUID, body: GuideReportIn, member: CurrentMember, request: Request,
                 db: Db) -> GuideReportOut:
    """FR-LIV-006: report an outdated entry; one open report per member and entry."""
    with _answers():
        return GuideReportOut.build(service.report(db, member.id, entry_id, body.reason, body.note, client_ip(request)))
