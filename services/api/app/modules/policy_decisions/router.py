from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.policy_decisions import service
from app.modules.policy_decisions.rules import CONFIGURE
from app.modules.policy_decisions.schemas import DraftIn, PolicyDecisionOut, ReviewIn, SubmitIn

router = APIRouter(prefix="/v1/policy-decisions", tags=["policy-decisions"])

Db = Annotated[Session, Depends(get_db)]
CanConfigure = Annotated[Staff, Depends(require_permission(CONFIGURE))]


def _handled(call):  # type: ignore[no-untyped-def]
    try:
        return PolicyDecisionOut.build(call())
    except service.UnknownDecision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.DecisionRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None


@router.get("")
def list_policy_decisions(staff: CanConfigure, db: Db) -> list[PolicyDecisionOut]:
    """The fixed Phase 1 decision catalogue with current approval evidence."""
    return [PolicyDecisionOut.build(item) for item in service.list_decisions(db)]


@router.get("/{key}")
def get_policy_decision(key: str, staff: CanConfigure, db: Db) -> PolicyDecisionOut:
    return _handled(lambda: service.get_decision(db, key))


@router.post("/{key}/revisions", status_code=status.HTTP_201_CREATED)
def create_revision(key: str, body: DraftIn, staff: CanConfigure, request: Request, db: Db) -> PolicyDecisionOut:
    return _handled(
        lambda: service.create_revision(
            db, staff, key, body.decision_text, body.rationale, body.effective_from, client_ip(request)
        )
    )


@router.patch("/{key}/revisions/{revision_id}")
def update_revision(
    key: str, revision_id: UUID, body: DraftIn, staff: CanConfigure, request: Request, db: Db
) -> PolicyDecisionOut:
    return _handled(
        lambda: service.update_draft(
            db,
            staff,
            key,
            revision_id,
            body.decision_text,
            body.rationale,
            body.effective_from,
            client_ip(request),
        )
    )


@router.post("/{key}/revisions/{revision_id}/submit")
def submit_revision(
    key: str, revision_id: UUID, body: SubmitIn, staff: CanConfigure, request: Request, db: Db
) -> PolicyDecisionOut:
    return _handled(
        lambda: service.submit_revision(db, staff, key, revision_id, body.reason, client_ip(request))
    )


@router.post("/{key}/revisions/{revision_id}/reviews")
def record_review(
    key: str, revision_id: UUID, body: ReviewIn, staff: CanConfigure, request: Request, db: Db
) -> PolicyDecisionOut:
    return _handled(
        lambda: service.record_review(
            db,
            staff,
            key,
            revision_id,
            role=body.role,
            outcome=body.outcome,
            reviewer_name=body.reviewer_name,
            reviewer_title=body.reviewer_title,
            evidence_ref=body.evidence_ref,
            comment=body.comment,
            reviewed_at=body.reviewed_at,
            ip=client_ip(request),
        )
    )
