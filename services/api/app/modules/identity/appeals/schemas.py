import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import Field, StringConstraints

from app.core.schemas import CamelModel
from app.core.permissions import Tier
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.reviews.rules import Decision
from app.modules.identity.reviews.schemas import DecisionOut, ReviewMemberOut, ReviewSummaryOut
from app.modules.identity.appeals.repository import StoredAppeal
from app.modules.identity.appeals.rules import AppealState, Outcome


class AppealInput(CamelModel):
    # M04: the member's own words, up to 1,000 characters.
    statement: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class AppealDecisionInput(CamelModel):
    outcome: Outcome
    # FR-IDV-013: the outcome is sent to the member with a reason.
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]


class AppealSummaryOut(CamelModel):
    """One row of the D05 queue."""

    id: uuid.UUID
    appeal_ref: str
    review_id: uuid.UUID
    review_ref: str
    member_id: uuid.UUID
    appealed_decision: Decision
    state: AppealState
    area: str = Field(description="The member's area when the review was submitted")
    submitted_at: datetime
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None
    claimed_at: datetime | None
    decided_at: datetime | None

    @classmethod
    def from_stored(cls, appeal: StoredAppeal) -> Self:
        return cls(
            id=appeal.id,
            appeal_ref=appeal.appeal_ref,
            review_id=appeal.review_id,
            review_ref=appeal.review_ref,
            member_id=appeal.member_id,
            appealed_decision=appeal.appealed_decision,  # type: ignore[arg-type]
            state=appeal.state,  # type: ignore[arg-type]
            area=appeal.area_path[-1],
            submitted_at=appeal.submitted_at,
            claimed_by=appeal.claimed_by,
            claimed_by_name=appeal.claimed_by_name,
            claimed_at=appeal.claimed_at,
            decided_at=appeal.decided_at,
        )


class AppealFileOut(AppealSummaryOut):
    """D05: the appeal, the decision under appeal, the review and the member's image records."""

    statement: str
    decided_by: uuid.UUID | None
    decider_tier: Tier | None
    outcome_reason: str | None
    decision: DecisionOut
    review: ReviewSummaryOut
    member: ReviewMemberOut
    documents: list[DocumentOut]
