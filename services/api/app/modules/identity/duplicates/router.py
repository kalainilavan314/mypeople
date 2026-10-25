import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.duplicates import service
from app.modules.identity.duplicates.rules import INVESTIGATE, REPORT, CaseState
from app.modules.identity.duplicates.schemas import (
    CaseDecisionInput,
    CaseFileOut,
    CaseMemberOut,
    CaseSummaryOut,
    ReportInput,
)
from app.modules.identity.reviews.schemas import ReviewMemberOut

router = APIRouter(prefix="/v1/identity/duplicates", tags=["duplicate investigations"])

Db = Annotated[Session, Depends(get_db)]
CanReport = Annotated[Staff, Depends(require_permission(REPORT))]
CanInvestigate = Annotated[Staff, Depends(require_permission(INVESTIGATE))]

OPEN_STATES: list[CaseState] = ["open", "in_review"]
REFUSED = {
    403: {"description": "forbidden, own_record or outside_your_area"},
    404: {"description": "not_found"},
    409: {"description": "not_open, claimed_by_another or not_claimed_by_you"},
}


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


def _refused(error: AccessRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


def _conflict(error: service.CaseConflict) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


@router.post(
    "",
    responses={**REFUSED, 422: {"description": '{"code": "report_refused", "problems": ["same_member" | "own_record"]}'}},
)
def report_duplicate(body: ReportInput, staff: CanReport, request: Request, db: Db) -> CaseSummaryOut:
    """Report that a member may hold another account. Needs members.verify over the member's area.
    Reporting a pair that already has a case returns that case."""
    try:
        case = service.report(db, staff, body.member_id, body.other_member_id, body.reason, client_ip(request))
    except service.CaseNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.ReportRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "report_refused", "problems": error.problems},
        ) from None
    return CaseSummaryOut.from_stored(case)


@router.get("")
def list_cases(
    staff: CanInvestigate,
    db: Db,
    state: Annotated[list[CaseState] | None, Query()] = None,
    mine: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[CaseSummaryOut]:
    """D04: duplicate investigations in the caller's areas, oldest first. Open cases unless states are given."""
    cases = service.queue(db, staff, states=list(state or OPEN_STATES), mine=mine, limit=limit)
    return [CaseSummaryOut.from_stored(case) for case in cases]


def _file(db: Session, staff: Staff, case_id: uuid.UUID, request: Request) -> CaseFileOut:
    try:
        file = service.case_file(db, staff, case_id, client_ip(request))
    except service.CaseNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    case = file.case
    return CaseFileOut(
        **CaseSummaryOut.from_stored(case).model_dump(),
        opened_by=case.opened_by,
        opened_reason=case.opened_reason,
        decided_by=case.decided_by,
        outcome_reason=case.outcome_reason,
        members=[
            CaseMemberOut(
                member_id=m.member.id,
                details=ReviewMemberOut.from_stored(m.member),
                verification_status=m.member.verification_status,
                membership_state=m.membership_state,
                documents=[DocumentOut.from_stored(d) for d in m.documents],
            )
            for m in file.members
        ],
    )


@router.get("/{case_id}", responses=REFUSED)
def read_case(case_id: uuid.UUID, staff: CanInvestigate, request: Request, db: Db) -> CaseFileOut:
    """Both accounts side by side. Needs idv.duplicate.investigate over both accounts' areas."""
    return _file(db, staff, case_id, request)


@router.post("/{case_id}/claim", responses=REFUSED)
def claim_case(case_id: uuid.UUID, staff: CanInvestigate, request: Request, db: Db) -> CaseFileOut:
    """Take the case. While held, both accounts' evidence opens to the caller (PRM-03)."""
    try:
        service.claim(db, staff, case_id, client_ip(request))
    except service.CaseNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.CaseConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, case_id, request)


@router.post("/{case_id}/release", responses=REFUSED)
def release_case(case_id: uuid.UUID, staff: CanInvestigate, request: Request, db: Db) -> CaseFileOut:
    try:
        service.release(db, staff, case_id, client_ip(request))
    except service.CaseNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.CaseConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, case_id, request)


@router.post("/{case_id}/decision", responses=REFUSED)
def decide_case(
    case_id: uuid.UUID, body: CaseDecisionInput, staff: CanInvestigate, request: Request, db: Db
) -> CaseFileOut:
    """Record whether the two accounts belong to one person, with a reason. Final, and it changes
    neither account: inactivating one is a separate membership change (BR-015, BR-094)."""
    try:
        service.decide(db, staff, case_id, body.outcome, body.reason, client_ip(request))
    except service.CaseNotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _refused(error) from None
    except service.CaseConflict as error:
        raise _conflict(error) from None
    return _file(db, staff, case_id, request)
