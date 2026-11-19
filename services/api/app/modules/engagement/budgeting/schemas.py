"""Request and response bodies for participatory budgeting (M24 to M27, D19)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.engagement.budgeting.repository import Allocation, Candidate, Cycle, Expenditure, Project, Result
from app.modules.engagement.budgeting.rules import FundKind, Phase, ReviewKind, Status
from app.modules.engagement.budgeting.service import (
    CycleListItem,
    MemberCycle,
    ProjectView,
    RecountView,
    ResultsView,
    StaffCycleView,
)

Money = Decimal

EligibilityReason = Literal[
    "identity_not_verified", "membership_not_active", "age_not_recorded", "under_voting_age", "outside_cycle_area",
]


class PbCycleSummaryOut(CamelModel):
    id: uuid.UUID
    cycle_ref: str
    title_en: str
    title_ta: str
    fund_kind: FundKind = Field(description="OD-25: a party fund or a community fund; never a public budget (FR-PBG-009)")
    budget: Money
    currency: str
    area_key: str
    voting_opens_at: datetime
    voting_closes_at: datetime
    status: Status
    phase: Phase

    @classmethod
    def fields(cls, c: Cycle, phase: str) -> dict:  # type: ignore[type-arg]
        return {
            "id": c.id, "cycle_ref": c.cycle_ref, "title_en": c.title_en, "title_ta": c.title_ta, "fund_kind": c.fund_kind,
            "budget": c.budget, "currency": c.currency, "area_key": c.area_key, "voting_opens_at": c.voting_opens_at,
            "voting_closes_at": c.voting_closes_at, "status": c.status, "phase": phase,
        }


class PbMemberCycleSummaryOut(PbCycleSummaryOut):
    in_my_area: bool

    @classmethod
    def build(cls, item: CycleListItem) -> "PbMemberCycleSummaryOut":
        return cls(**cls.fields(item.cycle, item.phase), in_my_area=item.in_my_area)


class PbCycleRulesOut(CamelModel):
    """FR-PBG-001: what is published before voting opens and never changes during voting."""

    description_en: str
    description_ta: str
    fund_source_en: str
    fund_source_ta: str
    eligibility_en: str
    eligibility_ta: str
    min_age: int
    max_choices: int
    rules_published_at: datetime | None
    status_reason: str | None = Field(description="Why a cycle was cancelled")

    @classmethod
    def build(cls, c: Cycle) -> "PbCycleRulesOut":
        return cls(description_en=c.description_en, description_ta=c.description_ta, fund_source_en=c.fund_source_en,
                   fund_source_ta=c.fund_source_ta, eligibility_en=c.eligibility_en, eligibility_ta=c.eligibility_ta,
                   min_age=c.min_age, max_choices=c.max_choices, rules_published_at=c.rules_published_at,
                   status_reason=c.status_reason)


class PbProjectSummaryOut(CamelModel):
    id: uuid.UUID
    proposal_ref: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    category: str
    area_key: str
    estimated_cost: Money

    @classmethod
    def fields(cls, p: Project) -> dict:  # type: ignore[type-arg]
        return {
            "id": p.id, "proposal_ref": p.proposal_ref, "title_en": p.title_en, "title_ta": p.title_ta,
            "summary_en": p.summary_en, "summary_ta": p.summary_ta, "category": p.proposal_category,
            "area_key": p.proposal_area_key, "estimated_cost": p.estimated_cost,
        }

    @classmethod
    def build(cls, p: Project) -> "PbProjectSummaryOut":
        return cls(**cls.fields(p))


class PbMemberCycleOut(PbCycleSummaryOut):
    rules: PbCycleRulesOut
    projects: list[PbProjectSummaryOut] = Field(description="Only projects on the ballot")
    in_my_area: bool
    can_vote: bool = Field(description="Eligible and not voted yet; checked again when the ballot is cast")
    ineligible_reason: EligibilityReason | None
    participated_on: date | None = Field(description="The day the member took part; their choice is never shown")

    @classmethod
    def build(cls, view: MemberCycle) -> "PbMemberCycleOut":
        return cls(
            **cls.fields(view.cycle, view.phase), rules=PbCycleRulesOut.build(view.cycle),
            projects=[PbProjectSummaryOut.build(p) for p in view.projects], in_my_area=view.in_my_area,
            can_vote=view.eligibility.reason is None and view.participated_on is None,
            ineligible_reason=view.eligibility.reason,  # type: ignore[arg-type]
            participated_on=view.participated_on,
        )


class PbReviewOut(CamelModel):
    reference: str
    note_en: str
    note_ta: str
    recorded_at: datetime


class PbExpenditureOut(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    amount: Money
    spent_on: date
    description_en: str
    description_ta: str
    evidence_ref: str

    @classmethod
    def build(cls, e: Expenditure) -> "PbExpenditureOut":
        return cls(id=e.id, project_id=e.project_id, amount=e.amount, spent_on=e.spent_on, description_en=e.description_en,
                   description_ta=e.description_ta, evidence_ref=e.evidence_ref)


class PbCompletionOut(CamelModel):
    completed_on: date
    evidence_ref: str
    note_en: str | None
    note_ta: str | None


def _review(ref: str | None, en: str | None, ta: str | None, at: datetime | None) -> PbReviewOut | None:
    if ref is None or at is None:
        return None
    return PbReviewOut(reference=ref, note_en=en or "", note_ta=ta or "", recorded_at=at)


def _completion(p: Project) -> PbCompletionOut | None:
    if p.completed_on is None or p.completion_evidence is None:
        return None
    return PbCompletionOut(completed_on=p.completed_on, evidence_ref=p.completion_evidence, note_en=p.completion_en,
                         note_ta=p.completion_ta)


class PbProjectDetailOut(PbProjectSummaryOut):
    cycle_id: uuid.UUID
    cycle_ref: str
    cycle_title_en: str
    cycle_title_ta: str
    problem: str = Field(description="From the development proposal, in the author's words")
    solution: str
    benefit: str
    financial_review: PbReviewOut | None
    legal_review: PbReviewOut | None
    on_ballot: bool
    votes: int | None = Field(description="Certified total; null before certification or when too few ballots to show")
    rank: int | None
    funded: bool | None
    allocated: Money | None
    spent: Money
    expenditures: list[PbExpenditureOut]
    completion: PbCompletionOut | None

    @classmethod
    def build(cls, p: Project, cycle: Cycle, result: Result | None, allocation: Allocation | None,
              expenditures: list[Expenditure], counts_shown: bool) -> "PbProjectDetailOut":
        mine = [e for e in expenditures if e.project_id == p.id]
        return cls(
            **cls.fields(p), cycle_id=cycle.id, cycle_ref=cycle.cycle_ref, cycle_title_en=cycle.title_en,
            cycle_title_ta=cycle.title_ta, problem=p.proposal_problem, solution=p.proposal_solution,
            benefit=p.proposal_benefit,
            financial_review=_review(p.financial_review_ref, p.financial_review_en, p.financial_review_ta,
                                     p.financial_reviewed_at),
            legal_review=_review(p.legal_review_ref, p.legal_review_en, p.legal_review_ta, p.legal_reviewed_at),
            on_ballot=p.on_ballot, votes=result.votes if result and counts_shown else None,
            rank=result.rank if result else None, funded=result.funded if result else None,
            allocated=allocation.amount if allocation else None, spent=sum((e.amount for e in mine), Decimal(0)),
            expenditures=[PbExpenditureOut.build(e) for e in mine], completion=_completion(p),
        )

    @classmethod
    def from_view(cls, view: ProjectView) -> "PbProjectDetailOut":
        return cls.build(view.project, view.cycle, view.result, view.allocation, view.expenditures, view.counts_shown)


class PbBallotIn(CamelModel):
    choices: list[uuid.UUID] = Field(min_length=1, max_length=10, description="Project ids, at most the cycle's max choices")


class PbReceiptOut(CamelModel):
    """Shown once. The code is never stored: keep it to check later that the ballot was counted."""

    receipt_code: str
    participated_on: date


class PbReceiptCheckIn(CamelModel):
    receipt_code: str = Field(min_length=16, max_length=40)


class PbReceiptCheckOut(CamelModel):
    counted: bool = Field(description="A ballot with this receipt is in the cycle's counted chain")
    certified: bool = Field(description="And two people have certified that chain's totals")


class PbResultRowOut(CamelModel):
    project: PbProjectSummaryOut
    votes: int | None = Field(description="Null when too few ballots were cast to show counts safely")
    rank: int
    funded: bool
    allocated: Money | None
    spent: Money
    completed_on: date | None


class PbCertificationOut(CamelModel):
    """Who certified is kept for the audit, not published; members see that two people did, and when."""

    certified_at: datetime
    ballot_count: int
    chain_head: str


class PbMemberResultsOut(CamelModel):
    cycle: PbCycleSummaryOut
    ballots: int
    eligible_count: int | None
    counts_shown: bool
    budget: Money
    allocated_total: Money
    rows: list[PbResultRowOut]
    certifications: list[PbCertificationOut]

    @classmethod
    def build(cls, view: ResultsView, phase: str) -> "PbMemberResultsOut":
        by_id = {p.id: p for p in view.projects}
        allocated = {a.project_id: a.amount for a in view.allocations}
        rows = []
        for r in view.results:
            project = by_id.get(r.project_id)
            if project is None:
                continue
            spent = sum((e.amount for e in view.expenditures if e.project_id == r.project_id), Decimal(0))
            rows.append(PbResultRowOut(project=PbProjectSummaryOut.build(project), votes=r.votes if view.counts_shown else None,
                                     rank=r.rank, funded=r.funded, allocated=allocated.get(r.project_id), spent=spent,
                                     completed_on=project.completed_on))
        return cls(
            cycle=PbCycleSummaryOut(**PbCycleSummaryOut.fields(view.cycle, phase)), ballots=view.ballots,
            eligible_count=view.cycle.eligible_count, counts_shown=view.counts_shown, budget=view.cycle.budget,
            allocated_total=sum(allocated.values(), Decimal(0)), rows=rows,
            certifications=[PbCertificationOut(certified_at=c.certified_at, ballot_count=c.ballot_count, chain_head=c.chain_head)
                            for c in view.certifications],
        )


# --- Staff (D19) -----------------------------------------------------------------------------------------


class PbAreaIn(CamelModel):
    level: Literal["province", "district", "ds", "gn"]
    code: str = Field(min_length=1, max_length=20)


class PbCycleIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=160)
    title_ta: str = Field(min_length=5, max_length=220)
    description_en: str = Field(min_length=10, max_length=3000)
    description_ta: str = Field(min_length=10, max_length=4500)
    fund_kind: FundKind
    fund_source_en: str = Field(min_length=3, max_length=300, description="The lawful fund that pays (OD-25)")
    fund_source_ta: str = Field(min_length=3, max_length=450)
    budget: Decimal = Field(gt=0, le=Decimal("999999999999"), decimal_places=2, description="Rupees")
    eligibility_en: str = Field(min_length=10, max_length=3000, description="Who may vote, as published to members")
    eligibility_ta: str = Field(min_length=10, max_length=4500)
    max_choices: int = Field(ge=1, le=10, description="How many projects each member may choose")
    voting_opens_at: datetime
    voting_closes_at: datetime
    area: PbAreaIn | None = Field(default=None, description="Required when creating; a cycle's area never changes")


class PbMoveIn(CamelModel):
    to: Literal["proposal_intake", "review", "voting_open", "voting_closed", "cancelled"]
    reason: str | None = Field(default=None, max_length=1000, description="Required to cancel (10 characters or more)")


class PbStaffProjectOut(PbProjectDetailOut):
    proposal_id: uuid.UUID


class PbStaffCycleOut(PbCycleSummaryOut):
    rules: PbCycleRulesOut
    area_path: list[str]
    eligible_count: int | None
    projects: list[PbStaffProjectOut]
    participation: int = Field(description="How many took part so far; never who, never a running total per project")
    ballots: int
    certifications: list[PbCertificationOut]
    allocated_total: Money
    created_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, view: StaffCycleView) -> "PbStaffCycleOut":
        c = view.cycle
        results = {r.project_id: r for r in view.results}
        allocations = {a.project_id: a for a in view.allocations}
        shown = True  # staff reading a certified cycle see the counts; members only past the small-number limit
        projects = [
            PbStaffProjectOut(
                **PbProjectDetailOut.build(p, c, results.get(p.id), allocations.get(p.id), view.expenditures, shown).model_dump(),
                proposal_id=p.proposal_id,
            )
            for p in view.projects
        ]
        return cls(
            **cls.fields(c, view.phase), rules=PbCycleRulesOut.build(c), area_path=c.area_path, eligible_count=c.eligible_count,
            projects=projects, participation=view.participation, ballots=view.ballots,
            certifications=[PbCertificationOut(certified_at=x.certified_at, ballot_count=x.ballot_count, chain_head=x.chain_head)
                            for x in view.certifications],
            allocated_total=sum((a.amount for a in view.allocations), Decimal(0)), created_at=c.created_at,
            updated_at=c.updated_at,
        )


class PbCandidateOut(CamelModel):
    id: uuid.UUID
    proposal_ref: str
    title: str
    category: str
    area_key: str
    cost_estimate: Money | None

    @classmethod
    def build(cls, c: Candidate) -> "PbCandidateOut":
        return cls(id=c.id, proposal_ref=c.proposal_ref, title=c.title, category=c.category, area_key=c.area_key,
                   cost_estimate=c.cost_estimate)


class PbProjectIn(CamelModel):
    proposal_id: uuid.UUID | None = Field(default=None, description="Required when adding; an approved-for-planning proposal")
    title_en: str = Field(min_length=5, max_length=160)
    title_ta: str = Field(min_length=5, max_length=220)
    summary_en: str = Field(min_length=10, max_length=2000)
    summary_ta: str = Field(min_length=10, max_length=3000)
    estimated_cost: Decimal = Field(gt=0, le=Decimal("999999999999"), decimal_places=2)


class PbReviewIn(CamelModel):
    kind: ReviewKind
    reference: str = Field(min_length=3, max_length=200, description="The review's document or file reference")
    note_en: str = Field(min_length=10, max_length=2000)
    note_ta: str = Field(min_length=10, max_length=3000)


class PbBallotPlacementIn(CamelModel):
    on_ballot: bool


class PbRecountOut(CamelModel):
    chain_valid: bool
    problem: str | None
    ballots: int
    participation: int
    chain_head: str
    matches_certified: bool | None = Field(description="Null before the first certification")
    totals: list["PbProjectTotalOut"]

    @classmethod
    def build(cls, view: RecountView, projects: list[Project]) -> "PbRecountOut":
        names = {p.id: p for p in projects}
        return cls(
            chain_valid=view.recount.chain_valid, problem=view.recount.problem, ballots=view.recount.ballots,
            participation=view.participation, chain_head=view.recount.head, matches_certified=view.matches_certified,
            totals=[PbProjectTotalOut(project_id=pid, proposal_ref=names[pid].proposal_ref if pid in names else "",
                                    votes=votes) for pid, votes in view.recount.totals.items()],
        )


class PbProjectTotalOut(CamelModel):
    project_id: uuid.UUID
    proposal_ref: str
    votes: int


class PbExpenditureIn(CamelModel):
    amount: Decimal = Field(gt=0, le=Decimal("999999999999"), decimal_places=2)
    spent_on: date
    description_en: str = Field(min_length=5, max_length=1000)
    description_ta: str = Field(min_length=5, max_length=1500)
    evidence_ref: str = Field(min_length=3, max_length=500, description="Invoice, payment voucher or bank reference")


class PbCompletionIn(CamelModel):
    completed_on: date
    evidence_ref: str = Field(min_length=3, max_length=500, description="Completion certificate, photos or inspection report")
    note_en: str = Field(min_length=10, max_length=2000)
    note_ta: str = Field(min_length=10, max_length=3000)


PbRecountOut.model_rebuild()

