import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import StringConstraints

from app.core.schemas import CamelModel
from app.modules.identity.documents.schemas import DocumentOut
from app.modules.identity.duplicates.repository import StoredCase
from app.modules.identity.duplicates.rules import CaseState, Outcome, Signal
from app.modules.identity.reviews.schemas import ReviewMemberOut

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1000)]


class ReportInput(CamelModel):
    member_id: uuid.UUID
    other_member_id: uuid.UUID
    reason: Reason


class CaseDecisionInput(CamelModel):
    outcome: Outcome
    reason: Reason


class CaseSummaryOut(CamelModel):
    """One row of the D04 queue."""

    id: uuid.UUID
    case_ref: str
    member_ids: list[uuid.UUID]
    signal: Signal
    state: CaseState
    opened_at: datetime
    claimed_by: uuid.UUID | None
    claimed_by_name: str | None
    decided_at: datetime | None

    @classmethod
    def from_stored(cls, case: StoredCase) -> Self:
        return cls(
            id=case.id,
            case_ref=case.case_ref,
            member_ids=[case.member_a, case.member_b],
            signal=case.signal,  # type: ignore[arg-type]
            state=case.state,  # type: ignore[arg-type]
            opened_at=case.opened_at,
            claimed_by=case.claimed_by,
            claimed_by_name=case.claimed_by_name,
            decided_at=case.decided_at,
        )


class CaseMemberOut(CamelModel):
    member_id: uuid.UUID
    details: ReviewMemberOut
    verification_status: str
    membership_state: str
    documents: list[DocumentOut]


class CaseFileOut(CaseSummaryOut):
    """D04: both accounts side by side, without the images; they open through view links once the case is claimed."""

    opened_by: uuid.UUID | None
    opened_reason: str | None
    decided_by: uuid.UUID | None
    outcome_reason: str | None
    members: list[CaseMemberOut]
