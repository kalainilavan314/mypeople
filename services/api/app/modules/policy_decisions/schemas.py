from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.policy_decisions.service import DecisionView


class ReviewOut(CamelModel):
    role: str
    outcome: Literal["approve", "reject"]
    reviewer_name: str
    reviewer_title: str
    evidence_ref: str
    comment: str
    reviewed_at: date
    recorded_at: datetime


class RevisionOut(CamelModel):
    id: UUID
    revision: int
    status: Literal["draft", "in_review", "approved", "rejected"]
    decision_text: str
    rationale: str
    effective_from: date | None
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    resolved_at: datetime | None
    reviews: list[ReviewOut]


class PolicyDecisionOut(CamelModel):
    key: str
    workstream: str
    title: str
    question: str
    proposed_default: str
    release_effect: str
    required_roles: list[str]
    approved_roles: list[str]
    missing_roles: list[str]
    current: RevisionOut | None

    @classmethod
    def build(cls, view: DecisionView) -> "PolicyDecisionOut":
        revision = view.revision
        current = None
        if revision:
            current = RevisionOut(
                id=revision.id,
                revision=revision.revision,
                status=revision.status,  # type: ignore[arg-type]
                decision_text=revision.decision_text,
                rationale=revision.rationale,
                effective_from=revision.effective_from,
                created_at=revision.created_at,
                updated_at=revision.updated_at,
                submitted_at=revision.submitted_at,
                resolved_at=revision.resolved_at,
                reviews=[
                    ReviewOut(
                        role=review.role,
                        outcome=review.outcome,  # type: ignore[arg-type]
                        reviewer_name=review.reviewer_name,
                        reviewer_title=review.reviewer_title,
                        evidence_ref=review.evidence_ref,
                        comment=review.comment,
                        reviewed_at=review.reviewed_at,
                        recorded_at=review.created_at,
                    )
                    for review in view.reviews
                ],
            )
        return cls(
            key=view.definition.key,
            workstream=view.definition.workstream,
            title=view.definition.title,
            question=view.definition.question,
            proposed_default=view.definition.proposed_default,
            release_effect=view.definition.release_effect,
            required_roles=list(view.definition.required_roles),
            approved_roles=list(view.approved_roles),
            missing_roles=list(view.missing_roles),
            current=current,
        )


class DraftIn(CamelModel):
    decision_text: str = Field(min_length=10, max_length=4000)
    rationale: str = Field(min_length=10, max_length=4000)
    effective_from: date | None = None


class SubmitIn(CamelModel):
    reason: str = Field(min_length=10, max_length=1000)


class ReviewIn(CamelModel):
    role: str = Field(min_length=2, max_length=50)
    outcome: Literal["approve", "reject"]
    reviewer_name: str = Field(min_length=2, max_length=200)
    reviewer_title: str = Field(min_length=2, max_length=200)
    evidence_ref: str = Field(min_length=3, max_length=300)
    comment: str = Field(min_length=10, max_length=2000)
    reviewed_at: date
