"""The staff case workflow (BRD W03 to W08, FR-WEB-014 to 029): /v1/cases.

Every endpoint needs one of the case permissions (or content.moderate for public summaries and
added information); the service then checks the case's area, stage and the viewer's tier.
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.community.cases import service
from app.modules.community.cases.schemas import (
    AdditionModerationIn,
    AssignIn,
    IssueCaseFileOut,
    IssueCaseListOut,
    CasePhotoOut,
    IssueCaseOut,
    ChallengeDecisionIn,
    CaseCloseIn,
    DistrictDecisionIn,
    DsReportIn,
    ExecutiveDecisionIn,
    FactIn,
    FindingIn,
    ForwardIn,
    LinkIn,
    NoteIn,
    OwnerOptionOut,
    OwnerOptionsOut,
    ProgressIn,
    PublicSummaryIn,
    RegionalPlanIn,
    ReporterContactOut,
    ReturnIn,
)
from app.modules.community.issues.evidence import IssueVault
from app.modules.content.gallery.dependencies import PhotoBody
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
CaseStaff = Annotated[Staff, Depends(require_permission(*service.READ_PERMISSIONS))]

router = APIRouter(prefix="/v1/cases", tags=["cases"], dependencies=[Depends(require_feature("community_issues"))])

REFUSED = {
    403: {"description": "forbidden, own_record"},
    404: {"description": "not_found: no such case, or outside the viewer's areas"},
    409: {"description": "case_refused with problems such as wrong_stage or owner_not_eligible"},
}
StageFilter = Literal["gn", "returned", "ds", "district", "regional", "executive", "implementation", "resolved", "declined", "linked"]


@contextmanager
def _answers() -> Iterator[None]:
    """Turn the service's refusals into HTTP answers."""
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.CaseNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.CaseRefused as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail={"code": "case_refused", "problems": error.problems}
        ) from None


def _act(db: Session, staff: Staff, case_id: uuid.UUID, run: Callable[[], None]) -> IssueCaseFileOut:
    """Do the action, then answer with the updated file, so the dashboard shows the new state."""
    with _answers():
        run()
        case = service.current_file(db, staff, case_id)
    return IssueCaseFileOut.from_file(case, datetime.now(UTC))


@router.get("", response_model=IssueCaseListOut, responses=REFUSED)
def list_cases(
    staff: CaseStaff,
    db: Db,
    stage: Annotated[list[StageFilter] | None, Query()] = None,
    mine: bool = False,
    overdue: bool = False,
    district_closures: Annotated[bool, Query(alias="districtClosures")] = False,
    search: Annotated[str | None, Query(max_length=60)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
) -> IssueCaseListOut:
    """Cases in the viewer's areas; overdue ones first (FR-WEB-022, 028)."""
    with _answers():
        found = service.list_cases(
            db, staff, stages=list(stage) if stage else None, mine=mine, overdue=overdue,
            district_closures=district_closures, search=search, limit=limit, offset=offset,
        )
    now = datetime.now(UTC)
    return IssueCaseListOut(
        items=[IssueCaseOut.build(issue, now) for issue in found.items],
        total=found.total,
        limit=limit,
        offset=offset,
        counts=found.counts,
    )


@router.get("/{case_id}", response_model=IssueCaseFileOut, responses=REFUSED)
def read_case(case_id: uuid.UUID, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    with _answers():
        case = service.case_file(db, staff, case_id, client_ip(request))
    return IssueCaseFileOut.from_file(case, datetime.now(UTC))


@router.get("/{case_id}/owners", response_model=OwnerOptionsOut, responses=REFUSED)
def list_owner_options(
    case_id: uuid.UUID,
    staff: CaseStaff,
    db: Db,
    permission: Annotated[str, Query(max_length=60)],
) -> OwnerOptionsOut:
    """People who may be named owner for the next step: deciding holders of that permission over the area."""
    with _answers():
        holders = service.owner_options(db, staff, case_id, permission)
    return OwnerOptionsOut(items=[OwnerOptionOut.build(holder) for holder in holders])


@router.get("/{case_id}/reporter-contact", response_model=ReporterContactOut, responses=REFUSED)
def read_reporter_contact(case_id: uuid.UUID, staff: CaseStaff, request: Request, db: Db) -> ReporterContactOut:
    """PRM-13: only the assigned owner; every look is audited."""
    with _answers():
        contact = service.reporter_contact(db, staff, case_id, client_ip(request))
    return ReporterContactOut(full_name=contact.full_name, phone=contact.phone, member_code=contact.member_code)


@router.get(
    "/{case_id}/photos/{photo_id}",
    response_class=Response,
    responses={**REFUSED, 200: {"content": {"image/webp": {}}, "description": "The photo, without metadata"}},
)
def read_case_photo(
    case_id: uuid.UUID, photo_id: uuid.UUID, staff: CaseStaff, vault: IssueVault, request: Request, db: Db
) -> Response:
    with _answers():
        data = service.read_photo(db, vault, staff, case_id, photo_id, client_ip(request))
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": "no-store"})


@router.post("/{case_id}/photos", status_code=status.HTTP_201_CREATED, response_model=CasePhotoOut, responses=REFUSED)
def upload_case_photo(case_id: uuid.UUID, staff: CaseStaff, photo: PhotoBody, vault: IssueVault, db: Db) -> CasePhotoOut:
    with _answers():
        saved = service.save_case_photo(db, vault, staff, case_id, photo)
    return CasePhotoOut(id=saved.id, width=saved.width, height=saved.height)


@router.post("/{case_id}/facts", response_model=IssueCaseFileOut, responses=REFUSED)
def add_fact(case_id: uuid.UUID, body: FactIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W03: an observed fact and its source (FR-WEB-015)."""
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.add_fact(db, staff, case_id, body.statement, body.source, ip))


@router.post("/{case_id}/findings", response_model=IssueCaseFileOut, responses=REFUSED)
def add_finding(case_id: uuid.UUID, body: FindingIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W04: divisional findings by kind (FR-WEB-019); Tier 2B may add them too (FR-WEB-020)."""
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.add_finding(db, staff, case_id, body.kind, body.statement, body.source, ip))


@router.post("/{case_id}/notes", response_model=IssueCaseFileOut, responses=REFUSED)
def add_note(case_id: uuid.UUID, body: NoteIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.add_note(db, staff, case_id, body.text, ip))


@router.post("/{case_id}/return", response_model=IssueCaseFileOut, responses=REFUSED)
def return_for_details(case_id: uuid.UUID, body: ReturnIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """FR-WEB-016: ask the reporter for details instead of deleting the report."""
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.return_for_details(db, staff, case_id, body.question, ip))


@router.post("/{case_id}/link", response_model=IssueCaseFileOut, responses=REFUSED)
def link_to_parent(case_id: uuid.UUID, body: LinkIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """FR-WEB-018: link a duplicate report to its parent case."""
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.link_to_parent(db, staff, case_id, body.parent_case_number, body.note, ip))


@router.post("/{case_id}/forward", response_model=IssueCaseFileOut, responses=REFUSED)
def forward_to_ds(case_id: uuid.UUID, body: ForwardIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """FR-WEB-017: forward to the divisional owner after the completeness check."""
    ip = client_ip(request)
    forward = service.Forward(
        location_confirmed=body.location_confirmed, description_clear=body.description_clear,
        evidence_reviewed=body.evidence_reviewed, owner_id=body.owner_id, note=body.note,
    )
    return _act(db, staff, case_id, lambda: service.forward_to_ds(db, staff, case_id, forward, ip))


@router.post("/{case_id}/ds-report", response_model=IssueCaseFileOut, responses=REFUSED)
def send_ds_report(case_id: uuid.UUID, body: DsReportIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W04: the formal divisional report to the district (FR-WEB-019)."""
    ip = client_ip(request)
    report = service.DsReport(
        summary=body.summary, evidence_refs=body.evidence_refs, recommendation=body.recommendation,
        district_owner_id=body.district_owner_id,
    )
    return _act(db, staff, case_id, lambda: service.send_ds_report(db, staff, case_id, report, ip))


@router.post("/{case_id}/district-decision", response_model=IssueCaseFileOut, responses=REFUSED)
def decide_at_district(case_id: uuid.UUID, body: DistrictDecisionIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W05: act within delegated authority, or escalate (FR-WEB-021)."""
    ip = client_ip(request)
    decision = service.DistrictDecision(**body.model_dump())
    return _act(db, staff, case_id, lambda: service.decide_at_district(db, staff, case_id, decision, ip))


@router.post("/{case_id}/regional-plan", response_model=IssueCaseFileOut, responses=REFUSED)
def submit_regional_plan(case_id: uuid.UUID, body: RegionalPlanIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W06: the regional solution plan for Tier 5 (FR-WEB-023)."""
    ip = client_ip(request)
    plan = service.RegionalPlan(**body.model_dump())
    return _act(db, staff, case_id, lambda: service.submit_regional_plan(db, staff, case_id, plan, ip))


@router.post("/{case_id}/executive-decision", response_model=IssueCaseFileOut, responses=REFUSED)
def decide_executive(case_id: uuid.UUID, body: ExecutiveDecisionIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W07: approve with conditions, return for clarification, or decline (FR-WEB-024)."""
    ip = client_ip(request)
    decision = service.ExecutiveDecision(**body.model_dump())
    return _act(db, staff, case_id, lambda: service.decide_executive(db, staff, case_id, decision, ip))


@router.post("/{case_id}/progress", response_model=IssueCaseFileOut, responses=REFUSED)
def record_progress(case_id: uuid.UUID, body: ProgressIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W08: a step and its progress evidence (FR-WEB-025)."""
    ip = client_ip(request)
    return _act(
        db, staff, case_id,
        lambda: service.record_progress(db, staff, case_id, body.step, body.evidence_refs, body.photo_ids, ip),
    )


@router.post("/{case_id}/close", response_model=IssueCaseFileOut, responses=REFUSED)
def close_case(case_id: uuid.UUID, body: CaseCloseIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """W08: the closing report; Resolved only with evidence and a Tamil and English summary (FR-WEB-026)."""
    ip = client_ip(request)
    report = service.ClosingReport(**body.model_dump())
    return _act(db, staff, case_id, lambda: service.close_case(db, staff, case_id, report, ip))


@router.post("/{case_id}/assign", response_model=IssueCaseFileOut, responses=REFUSED)
def assign(case_id: uuid.UUID, body: AssignIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """A handoff within the stage, or taking an unassigned case (FR-WEB-029)."""
    ip = client_ip(request)
    return _act(db, staff, case_id, lambda: service.assign(db, staff, case_id, body.owner_id, body.note, ip))


@router.post("/{case_id}/challenge-decision", response_model=IssueCaseFileOut, responses=REFUSED)
def decide_challenge(case_id: uuid.UUID, body: ChallengeDecisionIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """FR-WEB-027: reopen on an accepted challenge, or reject it with a reason."""
    ip = client_ip(request)
    return _act(
        db, staff, case_id,
        lambda: service.decide_challenge(
            db, staff, case_id, accept=body.accept, reason=body.reason, stage=body.stage, owner_id=body.owner_id,
            due_date=body.due_date, ip=ip,
        ),
    )


@router.post("/{case_id}/public-summary", response_model=IssueCaseFileOut, responses=REFUSED)
def set_public_summary(case_id: uuid.UUID, body: PublicSummaryIn, staff: CaseStaff, request: Request, db: Db) -> IssueCaseFileOut:
    """BR-032: publish a moderated public summary, or withhold it with a reason."""
    ip = client_ip(request)
    summary = service.PublicSummary(**body.model_dump())
    return _act(db, staff, case_id, lambda: service.set_public_summary(db, staff, case_id, summary, ip))


@router.post("/{case_id}/additions/{addition_id}/moderation", response_model=IssueCaseFileOut, responses=REFUSED)
def moderate_addition(
    case_id: uuid.UUID, addition_id: uuid.UUID, body: AdditionModerationIn, staff: CaseStaff, request: Request, db: Db
) -> IssueCaseFileOut:
    ip = client_ip(request)
    return _act(
        db, staff, case_id, lambda: service.moderate_addition(db, staff, case_id, addition_id, body.approve, body.reason, ip)
    )
