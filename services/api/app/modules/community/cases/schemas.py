"""Staff request and response bodies for the case workflow (W03 to W08)."""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.cases.service import CaseFile
from app.modules.community.issues import rules
from app.modules.community.issues.repository import Holder, StoredAction, StoredIssue

FindingKind = Literal["verified_fact", "assumption", "option", "stakeholder", "resource_need", "open_question"]
ResponsibleTierChoice = Literal["3A", "3B", "4", "5"]


class IssueCaseOut(CamelModel):
    id: uuid.UUID
    case_number: str
    category: str
    title: str
    stage: str
    owner_id: uuid.UUID | None
    owner_name: str | None
    area_path: list[str]
    gn_code: str | None
    ds_code: str | None
    district_code: str | None
    stage_entered_at: datetime
    stage_due_at: datetime | None
    overdue: bool
    visibility: str
    public_state: str
    parent_case_number: str | None
    closed_level: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, issue: StoredIssue, now: datetime) -> "IssueCaseOut":
        return cls(
            id=issue.id,
            case_number=issue.case_number,
            category=issue.category,
            title=issue.title,
            stage=issue.stage,
            owner_id=issue.owner_id,
            owner_name=issue.owner_name,
            area_path=issue.area_path,
            gn_code=issue.gn_code,
            ds_code=issue.ds_code,
            district_code=issue.district_code,
            stage_entered_at=issue.stage_entered_at,
            stage_due_at=issue.stage_due_at,
            overdue=rules.is_overdue(issue.stage, issue.stage_due_at, now),
            visibility=issue.visibility,
            public_state=issue.public_state,
            parent_case_number=issue.parent_case_number,
            closed_level=issue.closed_level,
            created_at=issue.created_at,
            updated_at=issue.updated_at,
        )


class IssueCaseListOut(CamelModel):
    items: list[IssueCaseOut]
    total: int
    limit: int
    offset: int
    counts: dict[str, int] = Field(description="Cases in the viewer's areas by stage, plus 'overdue'")


class CaseActionOut(CamelModel):
    id: uuid.UUID
    kind: str
    actor_name: str | None
    from_stage: str | None
    to_stage: str | None
    previous_owner_name: str | None
    new_owner_name: str | None
    note: str | None
    details: dict[str, Any]
    created_at: datetime

    @classmethod
    def build(cls, action: StoredAction) -> "CaseActionOut":
        return cls(
            id=action.id,
            kind=action.kind,
            actor_name=action.actor_name,
            from_stage=action.from_stage,
            to_stage=action.to_stage,
            previous_owner_name=action.previous_owner_name,
            new_owner_name=action.new_owner_name,
            note=action.note,
            details=action.details,
            created_at=action.created_at,
        )


class CaseEvidenceOut(CamelModel):
    id: uuid.UUID
    purpose: str
    from_reporter: bool
    action_id: uuid.UUID | None
    width: int
    height: int
    created_at: datetime


class CaseAdditionOut(CamelModel):
    """Added information; the person is named only as the reporter or "a member" (data minimisation)."""

    id: uuid.UUID
    body: str
    from_reporter: bool
    is_reply: bool
    state: str
    moderation_reason: str | None
    photos: int
    created_at: datetime


class LinkedReportOut(CamelModel):
    id: uuid.UUID
    case_number: str
    created_at: datetime


class ChallengeOut(CamelModel):
    note: str | None
    created_at: datetime


class IssueCaseFileOut(IssueCaseOut):
    description: str
    location_kind: str
    location_text: str | None
    public_title_en: str | None
    public_title_ta: str | None
    public_summary_en: str | None
    public_summary_ta: str | None
    implementation_due_at: datetime | None
    closed_at: datetime | None
    closing_summary_en: str | None
    closing_summary_ta: str | None
    history: list[CaseActionOut]
    evidence: list[CaseEvidenceOut]
    additions: list[CaseAdditionOut]
    linked_reports: list[LinkedReportOut]
    open_challenge: ChallengeOut | None
    allowed_actions: list[str] = Field(description="What the viewer may do now; the API checks again on every action")

    @classmethod
    def from_file(cls, case: CaseFile, now: datetime) -> "IssueCaseFileOut":
        issue = case.issue
        return cls(
            **IssueCaseOut.build(issue, now).model_dump(),
            description=issue.description,
            location_kind=issue.location_kind,
            location_text=issue.location_text,
            public_title_en=issue.public_title_en,
            public_title_ta=issue.public_title_ta,
            public_summary_en=issue.public_summary_en,
            public_summary_ta=issue.public_summary_ta,
            implementation_due_at=issue.implementation_due_at,
            closed_at=issue.closed_at,
            closing_summary_en=issue.closing_summary_en,
            closing_summary_ta=issue.closing_summary_ta,
            history=[CaseActionOut.build(action) for action in case.history],
            evidence=[
                CaseEvidenceOut(
                    id=e.id, purpose=e.purpose, from_reporter=e.uploader_id == issue.reporter_id, action_id=e.action_id,
                    width=e.width, height=e.height, created_at=e.created_at,
                )
                for e in case.evidence
            ],
            additions=[
                CaseAdditionOut(
                    id=a.id, body=a.body, from_reporter=a.member_id == issue.reporter_id, is_reply=a.is_reply,
                    state=a.state, moderation_reason=a.moderation_reason, photos=a.photos, created_at=a.created_at,
                )
                for a in case.additions
            ],
            linked_reports=[LinkedReportOut(id=c.id, case_number=c.case_number, created_at=c.created_at) for c in case.children],
            open_challenge=ChallengeOut(note=case.challenge.note, created_at=case.challenge.created_at) if case.challenge else None,
            allowed_actions=case.allowed,
        )


class OwnerOptionOut(CamelModel):
    member_id: uuid.UUID
    full_name: str
    tier: str

    @classmethod
    def build(cls, holder: Holder) -> "OwnerOptionOut":
        return cls(member_id=holder.member_id, full_name=holder.full_name, tier=holder.tier)


class OwnerOptionsOut(CamelModel):
    items: list[OwnerOptionOut]


class ReporterContactOut(CamelModel):
    full_name: str
    phone: str | None
    member_code: str


class CasePhotoOut(CamelModel):
    id: uuid.UUID
    width: int
    height: int


# --- Inputs ----------------------------------------------------------------------------------------------


class FactIn(CamelModel):
    statement: str = Field(min_length=3, max_length=1000)
    source: str = Field(min_length=2, max_length=300, description="Who or what the fact comes from (FR-WEB-015)")


class FindingIn(CamelModel):
    kind: FindingKind
    statement: str = Field(min_length=3, max_length=1500)
    source: str | None = Field(default=None, max_length=300)


class NoteIn(CamelModel):
    text: str = Field(min_length=3, max_length=2000)


class ReturnIn(CamelModel):
    question: str = Field(min_length=10, max_length=1000, description="What the reporter is asked to add")


class LinkIn(CamelModel):
    parent_case_number: str = Field(min_length=4, max_length=20)
    note: str | None = Field(default=None, max_length=1000)


class ForwardIn(CamelModel):
    location_confirmed: bool
    description_clear: bool
    evidence_reviewed: bool
    owner_id: uuid.UUID = Field(description="The named DS owner (FR-WEB-017)")
    note: str = Field(min_length=3, max_length=2000)


class DsReportIn(CamelModel):
    summary: str = Field(min_length=10, max_length=4000)
    evidence_refs: list[str] = Field(default_factory=list, max_length=20)
    recommendation: str = Field(min_length=10, max_length=2000)
    district_owner_id: uuid.UUID


class DistrictDecisionIn(CamelModel):
    decision: Literal["act", "escalate"]
    authority: str | None = Field(default=None, max_length=500)
    resources: str | None = Field(default=None, max_length=1000)
    office: str | None = Field(default=None, max_length=300)
    owner_id: uuid.UUID | None = None
    due_date: date | None = None
    reason: str | None = Field(default=None, max_length=2000)
    decision_required: str | None = Field(default=None, max_length=1000)
    regional_owner_id: uuid.UUID | None = None


class RegionalPlanIn(CamelModel):
    solution: str = Field(min_length=10, max_length=4000)
    responsible_tier: ResponsibleTierChoice
    resources: str = Field(min_length=3, max_length=2000)
    expected_outcome: str = Field(min_length=10, max_length=2000)
    reporting_plan: str = Field(min_length=10, max_length=2000)


class ExecutiveDecisionIn(CamelModel):
    decision: Literal["approve", "return", "decline"]
    conditions: str | None = Field(default=None, max_length=2000)
    implementer_id: uuid.UUID | None = None
    scope: str | None = Field(default=None, max_length=2000)
    reporting_duty: str | None = Field(default=None, max_length=1000)
    due_date: date | None = None
    question: str | None = Field(default=None, max_length=1000)
    reason: str | None = Field(default=None, max_length=2000)


class ProgressIn(CamelModel):
    step: str = Field(min_length=3, max_length=2000)
    evidence_refs: list[str] = Field(default_factory=list, max_length=20)
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=6)


class CaseCloseIn(CamelModel):
    outcome: str = Field(min_length=10, max_length=4000)
    evidence_refs: list[str] = Field(default_factory=list, max_length=20)
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=6)
    limitations: str | None = Field(default=None, max_length=2000)
    summary_en: str = Field(min_length=10, max_length=1000, description="Shown to the reporter and followers")
    summary_ta: str = Field(min_length=10, max_length=1500)


class AssignIn(CamelModel):
    owner_id: uuid.UUID
    note: str = Field(min_length=3, max_length=1000)


class ChallengeDecisionIn(CamelModel):
    accept: bool
    reason: str = Field(min_length=5, max_length=1000)
    stage: Literal["gn", "ds", "district", "implementation"] | None = None
    owner_id: uuid.UUID | None = None
    due_date: date | None = None


class PublicSummaryIn(CamelModel):
    publish: bool
    title_en: str | None = Field(default=None, min_length=5, max_length=120)
    title_ta: str | None = Field(default=None, min_length=5, max_length=160)
    summary_en: str | None = Field(default=None, min_length=10, max_length=1000)
    summary_ta: str | None = Field(default=None, min_length=10, max_length=1500)
    reason: str | None = Field(default=None, max_length=500)


class AdditionModerationIn(CamelModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)
