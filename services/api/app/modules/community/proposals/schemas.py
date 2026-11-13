"""Request and response bodies for development proposals (M15 to M17, D15)."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.proposals.repository import Proposal, StageEvent
from app.modules.community.proposals.rules import Category, Stage


class ProposalAreaIn(CamelModel):
    level: Literal["district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class ProposalIn(CamelModel):
    client_reference: uuid.UUID = Field(description="Made once per draft; sending a draft twice returns the first proposal")
    title: str = Field(min_length=5, max_length=120)
    category: Category
    area: ProposalAreaIn
    problem: str = Field(min_length=20, max_length=3000)
    solution: str = Field(min_length=20, max_length=3000)
    benefit: str = Field(min_length=10, max_length=2000)
    cost_estimate: Decimal | None = Field(default=None, ge=0, le=Decimal("999999999999"), description="Rupees, optional")
    evidence: str | None = Field(default=None, max_length=2000, description="Supporting evidence, optional")


class ProposalRevisionIn(CamelModel):
    title: str = Field(min_length=5, max_length=120)
    category: Category
    problem: str = Field(min_length=20, max_length=3000)
    solution: str = Field(min_length=20, max_length=3000)
    benefit: str = Field(min_length=10, max_length=2000)
    cost_estimate: Decimal | None = Field(default=None, ge=0, le=Decimal("999999999999"))
    evidence: str | None = Field(default=None, max_length=2000)


class StageEventOut(CamelModel):
    from_stage: Stage | None
    to_stage: Stage
    actor_tier: str | None = Field(description="The tier that recorded it; never the person's name")
    reason: str | None
    occurred_at: datetime

    @classmethod
    def build(cls, event: StageEvent) -> "StageEventOut":
        return cls(from_stage=event.from_stage, to_stage=event.to_stage, actor_tier=event.actor_tier,  # type: ignore[arg-type]
                   reason=event.reason, occurred_at=event.occurred_at)


class ProposalSummaryOut(CamelModel):
    id: uuid.UUID
    proposal_ref: str
    title: str
    category: Category
    area_key: str
    stage: Stage
    mine: bool
    updated_at: datetime

    @classmethod
    def build(cls, p: Proposal, viewer: uuid.UUID) -> "ProposalSummaryOut":
        return cls(id=p.id, proposal_ref=p.proposal_ref, title=p.title, category=p.category, area_key=p.area_key,  # type: ignore[arg-type]
                   stage=p.stage, mine=p.author_id == viewer, updated_at=p.updated_at)  # type: ignore[arg-type]


class ProposalBoardOut(CamelModel):
    area: list[ProposalSummaryOut]
    mine: list[ProposalSummaryOut]


class ProposalDetailOut(ProposalSummaryOut):
    problem: str
    solution: str
    benefit: str
    cost_estimate: Decimal | None
    evidence: str | None
    stage_reason: str | None = Field(description="The decision reason shown to members (FR-DEV-007)")
    revision: int
    published_at: datetime | None
    created_at: datetime
    history: list[StageEventOut]

    @classmethod
    def from_view(cls, p: Proposal, viewer: uuid.UUID, history: list[StageEvent]) -> "ProposalDetailOut":
        return cls(
            **ProposalSummaryOut.build(p, viewer).model_dump(),
            problem=p.problem, solution=p.solution, benefit=p.benefit, cost_estimate=p.cost_estimate,
            evidence=p.evidence, stage_reason=p.stage_reason, revision=p.revision, published_at=p.published_at,
            created_at=p.created_at, history=[StageEventOut.build(e) for e in history],
        )


class ProposalMoveIn(CamelModel):
    stage: Literal["review", "rejected", "approved_for_planning", "funding_identified", "implementation", "not_taken_forward"]
    reason: str | None = Field(default=None, max_length=2000)


class NeedsCellOut(CamelModel):
    area_key: str
    category: Category
    count: int | None = Field(description="Null means fewer than 10")


class NeedsOut(CamelModel):
    cells: list[NeedsCellOut]
