"""Our Development Ideas (BRD M15 to M17, D15, FR-DEV-001 to 008): /v1/proposals."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.proposals import rules, service
from app.modules.community.proposals.rules import Category, Stage
from app.modules.community.proposals.schemas import (
    NeedsCellOut,
    NeedsOut,
    ProposalBoardOut,
    ProposalDetailOut,
    ProposalIn,
    ProposalMoveIn,
    ProposalRevisionIn,
    ProposalSummaryOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
ProposalStaff = Annotated[Staff, Depends(require_permission(*rules.STAFF_PERMISSIONS))]

router = APIRouter(
    prefix="/v1/proposals", tags=["proposals"], dependencies=[Depends(require_feature("development_proposals"))]
)


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ProposalNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.ProposalRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "proposal_refused", "problems": error.problems}
        ) from None


@router.get("", response_model=ProposalBoardOut)
def browse(
    member: CurrentMember,
    db: Db,
    q: Annotated[str | None, Query(max_length=80)] = None,
    category: Category | None = None,
) -> ProposalBoardOut:
    """M15: proposals for my area and my own proposals; `q` matches words in Tamil or English."""
    area, mine = service.browse(db, member.id, q.strip() if q else None, category)
    return ProposalBoardOut(
        area=[ProposalSummaryOut.build(p, member.id) for p in area], mine=[ProposalSummaryOut.build(p, member.id) for p in mine]
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProposalDetailOut)
def submit(body: ProposalIn, member: CurrentMember, request: Request, db: Db) -> ProposalDetailOut:
    """M16: moderated before anyone else sees it."""
    with _answers():
        proposal = service.submit(
            db, member.id,
            service.NewProposal(
                client_reference=body.client_reference, title=body.title, category=body.category,
                area=Area(body.area.level, body.area.code), problem=body.problem, solution=body.solution,
                benefit=body.benefit, cost_estimate=body.cost_estimate, evidence=body.evidence,
            ),
            client_ip(request),
        )
        found = service.view(db, member.id, proposal.id)
    return ProposalDetailOut.from_view(found.proposal, member.id, found.history)


@router.get("/manage", response_model=list[ProposalSummaryOut])
def staff_queue(
    staff: ProposalStaff,
    db: Db,
    stage: Annotated[list[Stage] | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
    category: Category | None = None,
) -> list[ProposalSummaryOut]:
    """D15: proposals in the viewer's areas, newest activity first."""
    with _answers():
        found = service.queue(db, staff, list(stage) if stage else None, q.strip() if q else None, category)
    return [ProposalSummaryOut.build(p, staff.member_id) for p in found]


@router.get("/manage/needs", response_model=NeedsOut)
def regional_needs(staff: ProposalStaff, db: Db) -> NeedsOut:
    """FR-DEV-008: published proposals by area and category; groups under 10 hidden or merged."""
    with _answers():
        cells = service.regional_needs(db, staff)
    return NeedsOut(cells=[NeedsCellOut(area_key=a, category=c, count=n) for a, c, n in cells])  # type: ignore[arg-type]


@router.get("/manage/{proposal_id}", response_model=ProposalDetailOut)
def staff_read(proposal_id: uuid.UUID, staff: ProposalStaff, db: Db) -> ProposalDetailOut:
    with _answers():
        found = service.staff_view(db, staff, proposal_id)
    return ProposalDetailOut.from_view(found.proposal, staff.member_id, found.history)


@router.post("/manage/{proposal_id}/stage", response_model=ProposalDetailOut)
def move(proposal_id: uuid.UUID, body: ProposalMoveIn, staff: ProposalStaff, request: Request, db: Db) -> ProposalDetailOut:
    """FR-DEV-003, 006: moderate, or move a stage with the authority it needs; the author is told."""
    with _answers():
        service.move(db, staff, proposal_id, body.stage, body.reason, client_ip(request))
        found = service.staff_view(db, staff, proposal_id)
    return ProposalDetailOut.from_view(found.proposal, staff.member_id, found.history)


@router.get("/{proposal_id}", response_model=ProposalDetailOut)
def read(proposal_id: uuid.UUID, member: CurrentMember, db: Db) -> ProposalDetailOut:
    """M17: stage, decision reason and history."""
    with _answers():
        found = service.view(db, member.id, proposal_id)
    return ProposalDetailOut.from_view(found.proposal, member.id, found.history)


@router.put("/{proposal_id}", response_model=ProposalDetailOut)
def revise(proposal_id: uuid.UUID, body: ProposalRevisionIn, member: CurrentMember, request: Request, db: Db) -> ProposalDetailOut:
    """A rejected proposal, revised and sent back to moderation."""
    with _answers():
        service.revise(db, member.id, proposal_id, body.model_dump(), client_ip(request))
        found = service.view(db, member.id, proposal_id)
    return ProposalDetailOut.from_view(found.proposal, member.id, found.history)


@router.post("/{proposal_id}/withdraw", response_model=ProposalDetailOut)
def withdraw(proposal_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> ProposalDetailOut:
    with _answers():
        service.withdraw(db, member.id, proposal_id, client_ip(request))
        found = service.view(db, member.id, proposal_id)
    return ProposalDetailOut.from_view(found.proposal, member.id, found.history)
