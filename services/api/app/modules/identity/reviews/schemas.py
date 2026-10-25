import uuid
from datetime import date, datetime
from typing import Literal, Self

from pydantic import Field

from app.core.schemas import CamelModel
from app.core.permissions import Tier
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.reviews.repository import ReviewMember, StoredDecision, StoredReview
from app.modules.identity.reviews.rules import Decision, ReviewState, Route
from app.modules.identity.appeals.repository import StoredAppeal
from app.modules.identity.duplicates.repository import StoredCase
from app.modules.identity.appeals.rules import AppealState


class SubmissionInput(CamelModel):
    route: Route
    # BR-011: the member declares the documents are theirs and the details correct.
    declaration: Literal[True]


class DecisionInput(CamelModel):
    decision: Decision
    checklist: list[str] = Field(default=[], max_length=10)
    items: list[str] = Field(default=[], max_length=10)
    reason_category: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=500)


class AppealOut(CamelModel):
    """An appeal against one decision (M04): the member's statement and the outcome with its reason.
    The decider is shown by tier only."""

    appeal_ref: str
    state: AppealState
    statement: str
    submitted_at: datetime
    decided_at: datetime | None
    decider_tier: Tier | None
    outcome_reason: str | None

    @classmethod
    def from_stored(cls, appeal: StoredAppeal) -> Self:
        return cls(
            appeal_ref=appeal.appeal_ref,
            state=appeal.state,  # type: ignore[arg-type]
            statement=appeal.statement,
            submitted_at=appeal.submitted_at,
            decided_at=appeal.decided_at,
            decider_tier=appeal.decider_tier,  # type: ignore[arg-type]
            outcome_reason=appeal.outcome_reason,
        )


def _appeal_of(decision: StoredDecision, appeals: list[StoredAppeal]) -> AppealOut | None:
    appeal = next((a for a in appeals if a.decision_id == decision.id), None)
    return AppealOut.from_stored(appeal) if appeal else None


class MemberDecisionOut(CamelModel):
    """A decision as the member sees it: the reviewer's tier, never their name (FR-PROF-006)."""

    decision: Decision
    decided_at: datetime
    reviewer_tier: Tier
    requested_items: list[str]
    reason_category: str | None
    note: str | None
    appeal: AppealOut | None

    @classmethod
    def from_stored(cls, decision: StoredDecision, appeals: list[StoredAppeal]) -> Self:
        return cls(
            decision=decision.decision,  # type: ignore[arg-type]
            decided_at=decision.decided_at,
            reviewer_tier=decision.reviewer_tier,  # type: ignore[arg-type]
            requested_items=decision.requested_items,
            reason_category=decision.reason_category,
            note=decision.note,
            appeal=_appeal_of(decision, appeals),
        )


class MyReviewOut(CamelModel):
    """A10, A11, C06: the review reference and state, and what to correct when a correction is asked for."""

    review_ref: str
    route: Route
    state: ReviewState
    submitted_at: datetime
    decided_at: datetime | None
    history: list[MemberDecisionOut]

    @classmethod
    def from_stored(cls, review: StoredReview, decisions: list[StoredDecision], appeals: list[StoredAppeal]) -> Self:
        return cls(
            review_ref=review.review_ref,
            route=review.route,  # type: ignore[arg-type]
            state=review.state,  # type: ignore[arg-type]
            submitted_at=review.submitted_at,
            decided_at=review.decided_at,
            history=[MemberDecisionOut.from_stored(d, appeals) for d in reversed(decisions)],
        )


class ReviewSummaryOut(CamelModel):
    """One row of the W01 queue."""

    id: uuid.UUID
    review_ref: str
    member_id: uuid.UUID
    route: Route
    state: ReviewState
    area: str = Field(description="The member's area when submitted, e.g. gn:LK4103005")
    submitted_at: datetime
    resubmitted_at: datetime | None
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None = Field(description='Shown as "In review by …" (FR-WEB-003)')
    claimed_at: datetime | None
    decided_at: datetime | None

    @classmethod
    def from_stored(cls, review: StoredReview) -> Self:
        return cls(
            id=review.id,
            review_ref=review.review_ref,
            member_id=review.member_id,
            route=review.route,  # type: ignore[arg-type]
            state=review.state,  # type: ignore[arg-type]
            area=review.area_path[-1],
            submitted_at=review.submitted_at,
            resubmitted_at=review.resubmitted_at,
            claimed_by=review.claimed_by,
            claimed_by_name=review.claimed_by_name,
            claimed_at=review.claimed_at,
            decided_at=review.decided_at,
        )


class ReviewMemberOut(CamelModel):
    """The profile details a reviewer compares with the documents (FR-WEB-007)."""

    member_code: str
    full_name: str
    dob: date | None
    district_code: str | None
    ds_code: str | None
    gs_code: str | None

    @classmethod
    def from_stored(cls, member: ReviewMember) -> Self:
        return cls(
            member_code=member.member_code,
            full_name=member.full_name,
            dob=member.dob,
            district_code=member.district_code,
            ds_code=member.ds_code,
            gs_code=member.gs_code,
        )


class EvidenceVersion(CamelModel):
    id: uuid.UUID
    version: int


class DecisionOut(CamelModel):
    id: uuid.UUID
    decision: Decision
    reviewer_id: uuid.UUID
    reviewer_tier: Tier
    decided_at: datetime
    checklist: list[str]
    requested_items: list[str]
    reason_category: str | None
    note: str | None
    evidence: dict[str, EvidenceVersion] = Field(description="The images the decision was made on (BR-082)")
    appeal: AppealOut | None

    @classmethod
    def from_stored(cls, decision: StoredDecision, appeals: list[StoredAppeal]) -> Self:
        return cls(
            id=decision.id,
            decision=decision.decision,  # type: ignore[arg-type]
            reviewer_id=decision.reviewer_id,
            reviewer_tier=decision.reviewer_tier,  # type: ignore[arg-type]
            decided_at=decision.decided_at,
            checklist=decision.checklist,
            requested_items=decision.requested_items,
            reason_category=decision.reason_category,
            note=decision.note,
            evidence={kind: EvidenceVersion(**value) for kind, value in decision.evidence.items()},
            appeal=_appeal_of(decision, appeals),
        )


class DuplicateFlagOut(CamelModel):
    """A possible duplicate account (FR-WEB-012): a flag for the reviewer, never a decision."""

    case_ref: str
    state: str
    signal: str
    other_member_id: uuid.UUID

    @classmethod
    def from_case(cls, case: StoredCase, member_id: uuid.UUID) -> Self:
        other = case.member_b if case.member_a == member_id else case.member_a
        return cls(case_ref=case.case_ref, state=case.state, signal=case.signal, other_member_id=other)


class ReviewFileOut(ReviewSummaryOut):
    """W02 without the images: they open one at a time through view links, once the review is claimed."""

    member: ReviewMemberOut
    documents: list[DocumentOut]
    decisions: list[DecisionOut]
    duplicate_flags: list[DuplicateFlagOut]


class QueueCountsOut(CamelModel):
    awaiting_review: int
    needs_update: int
    assigned_to_me: int
