"""Participatory budgeting (BRD M24 to M27, D19, FR-PBG-001 to 010): /v1/pb."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.engagement.budgeting import rules, service
from app.modules.engagement.budgeting.schemas import (
    PbBallotIn,
    PbBallotPlacementIn,
    PbCandidateOut,
    PbCompletionIn,
    PbCycleIn,
    PbCycleSummaryOut,
    PbExpenditureIn,
    PbExpenditureOut,
    PbMemberCycleOut,
    PbMemberCycleSummaryOut,
    PbMemberResultsOut,
    PbMoveIn,
    PbProjectDetailOut,
    PbProjectIn,
    PbReceiptCheckIn,
    PbReceiptCheckOut,
    PbReceiptOut,
    PbRecountOut,
    PbReviewIn,
    PbStaffCycleOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
BudgetStaff = Annotated[Staff, Depends(require_permission(*rules.STAFF_PERMISSIONS))]
Manager = Annotated[Staff, Depends(require_permission(rules.MANAGE))]
Certifier = Annotated[Staff, Depends(require_permission(rules.CERTIFY))]
Treasurer = Annotated[Staff, Depends(require_permission(rules.ALLOCATE))]
Counter = Annotated[Staff, Depends(require_permission(rules.CERTIFY, rules.MANAGE))]

router = APIRouter(prefix="/v1/pb", tags=["budgeting"], dependencies=[Depends(require_feature("participatory_budgeting"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.BudgetingNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.BudgetingRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "budgeting_refused", "problems": error.problems}
        ) from None


# --- Members (M24 to M27) ---------------------------------------------------------------------------------


@router.get("/cycles", response_model=list[PbMemberCycleSummaryOut])
def list_cycles(member: CurrentMember, db: Db) -> list[PbMemberCycleSummaryOut]:
    """M24: published cycles, the member's own areas first. Drafts are never shown."""
    return [PbMemberCycleSummaryOut.build(item) for item in service.published_cycles(db, member.id)]


@router.get("/cycles/{cycle_id}", response_model=PbMemberCycleOut)
def read_cycle(cycle_id: uuid.UUID, member: CurrentMember, db: Db) -> PbMemberCycleOut:
    """M24: budget, fund source, dates, eligibility rules and the projects on the ballot; whether this
    member may vote (with the reason if not) and whether they already took part."""
    with _answers():
        return PbMemberCycleOut.build(service.member_cycle(db, member.id, cycle_id))


@router.get("/projects/{project_id}", response_model=PbProjectDetailOut)
def read_project(project_id: uuid.UUID, member: CurrentMember, db: Db) -> PbProjectDetailOut:
    """M25: a ballot project with its estimated cost and recorded reviews; once funded, spending and
    completion evidence."""
    with _answers():
        return PbProjectDetailOut.from_view(service.member_project(db, project_id))


@router.post("/cycles/{cycle_id}/ballot", status_code=status.HTTP_201_CREATED, response_model=PbReceiptOut)
def cast_ballot(cycle_id: uuid.UUID, body: PbBallotIn, member: CurrentMember, db: Db) -> PbReceiptOut:
    """M26: one private ballot per eligible member per cycle (422 already_voted after that). The
    receipt code is shown once and never stored; nothing here is logged with the member."""
    with _answers():
        receipt = service.cast_ballot(db, member.id, cycle_id, body.choices)
    return PbReceiptOut(receipt_code=receipt.code, participated_on=receipt.participated_on)


@router.post("/cycles/{cycle_id}/receipt-check", response_model=PbReceiptCheckOut)
def check_receipt(cycle_id: uuid.UUID, body: PbReceiptCheckIn, member: CurrentMember, db: Db) -> PbReceiptCheckOut:
    """FR-PBG-005: confirms a ballot with this receipt was counted, without revealing its choice."""
    with _answers():
        found = service.check_receipt(db, member.id, cycle_id, body.receipt_code)
    return PbReceiptCheckOut(counted=found.counted, certified=found.certified)


@router.get("/cycles/{cycle_id}/results", response_model=PbMemberResultsOut)
def read_results(cycle_id: uuid.UUID, member: CurrentMember, db: Db) -> PbMemberResultsOut:
    """M27: certified totals only; 422 results_not_certified before two people certify."""
    with _answers():
        view = service.member_results(db, cycle_id)
    c = view.cycle
    return PbMemberResultsOut.build(view, rules.phase(c.status, c.voting_opens_at, c.voting_closes_at, datetime.now(UTC)))


# --- Staff (D19) -----------------------------------------------------------------------------------------


def _area(body: PbCycleIn) -> Area:
    if body.area is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail={"code": "budgeting_refused", "problems": ["area_required"]})
    return Area(body.area.level, body.area.code)


@router.get("/manage/cycles", response_model=list[PbCycleSummaryOut])
def list_managed(staff: BudgetStaff, db: Db) -> list[PbCycleSummaryOut]:
    now = datetime.now(UTC)
    with _answers():
        return [PbCycleSummaryOut(**PbCycleSummaryOut.fields(c, rules.phase(c.status, c.voting_opens_at, c.voting_closes_at, now)))
                for c in service.managed_cycles(db, staff)]


@router.post("/manage/cycles", status_code=status.HTTP_201_CREATED, response_model=PbStaffCycleOut)
def create_cycle(body: PbCycleIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    values = body.model_dump(exclude={"area"})
    with _answers():
        cycle = service.create_cycle(db, staff, values, _area(body), client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle.id))


@router.get("/manage/cycles/{cycle_id}", response_model=PbStaffCycleOut)
def read_managed(cycle_id: uuid.UUID, staff: BudgetStaff, db: Db) -> PbStaffCycleOut:
    with _answers():
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.put("/manage/cycles/{cycle_id}", response_model=PbStaffCycleOut)
def update_cycle(cycle_id: uuid.UUID, body: PbCycleIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    """BR-121: only before voting is scheduled; after publication a change publishes the rules again."""
    with _answers():
        service.update_cycle(db, staff, cycle_id, body.model_dump(exclude={"area"}), client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.post("/manage/cycles/{cycle_id}/move", response_model=PbStaffCycleOut)
def move_cycle(cycle_id: uuid.UUID, body: PbMoveIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    """Publish the rules (to proposal_intake), review, schedule voting (rules lock), close voting once
    the closing time has passed, or cancel with a reason before voting."""
    with _answers():
        service.move_cycle(db, staff, cycle_id, body.to, body.reason, client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.get("/manage/cycles/{cycle_id}/candidates", response_model=list[PbCandidateOut])
def list_candidates(cycle_id: uuid.UUID, staff: BudgetStaff, db: Db) -> list[PbCandidateOut]:
    """FR-PBG-002: development proposals approved for planning in the cycle's area, not yet added."""
    with _answers():
        return [PbCandidateOut.build(c) for c in service.candidates(db, staff, cycle_id)]


@router.post("/manage/cycles/{cycle_id}/projects", status_code=status.HTTP_201_CREATED, response_model=PbStaffCycleOut)
def add_project(cycle_id: uuid.UUID, body: PbProjectIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    if body.proposal_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail={"code": "budgeting_refused", "problems": ["proposal_required"]})
    with _answers():
        service.add_project(db, staff, cycle_id, body.proposal_id, body.model_dump(exclude={"proposal_id"}),
                            client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.put("/manage/projects/{project_id}", response_model=PbStaffCycleOut)
def update_project(project_id: uuid.UUID, body: PbProjectIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    """A changed estimated cost clears the financial review and takes the project off the ballot."""
    with _answers():
        project = service.update_project(db, staff, project_id, body.model_dump(exclude={"proposal_id"}), client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, project.cycle_id))


@router.post("/manage/projects/{project_id}/reviews", response_model=PbStaffCycleOut)
def record_review(project_id: uuid.UUID, body: PbReviewIn, staff: Manager, request: Request, db: Db) -> PbStaffCycleOut:
    with _answers():
        project = service.record_review(db, staff, project_id, body.kind, body.reference, body.note_en, body.note_ta,
                                        client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, project.cycle_id))


@router.post("/manage/projects/{project_id}/ballot", response_model=PbStaffCycleOut)
def place_on_ballot(project_id: uuid.UUID, body: PbBallotPlacementIn, staff: Manager, request: Request,
                    db: Db) -> PbStaffCycleOut:
    """FR-PBG-002: refused (financial_review_required, legal_review_required) until both are recorded."""
    with _answers():
        project = service.set_on_ballot(db, staff, project_id, body.on_ballot, client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, project.cycle_id))


@router.get("/manage/cycles/{cycle_id}/recount", response_model=PbRecountOut)
def recount(cycle_id: uuid.UUID, staff: Counter, request: Request, db: Db) -> PbRecountOut:
    """FR-PBG-006: replays the hash chain and counts again; only after voting closes."""
    with _answers():
        view = service.recount(db, staff, cycle_id, client_ip(request))
        projects = service.staff_view(db, staff, cycle_id).projects
    return PbRecountOut.build(view, projects)


@router.post("/manage/cycles/{cycle_id}/certify", response_model=PbStaffCycleOut)
def certify(cycle_id: uuid.UUID, staff: Certifier, request: Request, db: Db) -> PbStaffCycleOut:
    """FR-PBG-006: two different people certify the same recount (403 already_certified_by_you);
    a mismatch blocks certification (422 count_mismatch, chain_broken)."""
    with _answers():
        service.certify(db, staff, cycle_id, client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.post("/manage/cycles/{cycle_id}/allocations", response_model=PbStaffCycleOut)
def allocate(cycle_id: uuid.UUID, staff: Treasurer, request: Request, db: Db) -> PbStaffCycleOut:
    """FR-PBG-008: the Treasurer records each funded project's allocation in the finance records."""
    with _answers():
        service.allocate(db, staff, cycle_id, client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, cycle_id))


@router.post("/manage/projects/{project_id}/expenditures", status_code=status.HTTP_201_CREATED,
             response_model=PbExpenditureOut)
def record_expenditure(project_id: uuid.UUID, body: PbExpenditureIn, staff: Manager, request: Request,
                       db: Db) -> PbExpenditureOut:
    """Spending on a funded project, with evidence; never beyond its allocation."""
    with _answers():
        return PbExpenditureOut.build(service.record_expenditure(db, staff, project_id, body.model_dump(), client_ip(request)))


@router.post("/manage/projects/{project_id}/completion", response_model=PbStaffCycleOut)
def record_completion(project_id: uuid.UUID, body: PbCompletionIn, staff: Manager, request: Request,
                      db: Db) -> PbStaffCycleOut:
    with _answers():
        project = service.record_completion(db, staff, project_id, body.model_dump(), client_ip(request))
        return PbStaffCycleOut.build(service.staff_view(db, staff, project.cycle_id))
