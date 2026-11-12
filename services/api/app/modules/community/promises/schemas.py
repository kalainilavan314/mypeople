"""Request and response bodies for the Promise Tracker (M18, M19, D16)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.promises.repository import Feedback, Milestone, Promise, Update
from app.modules.community.promises.rules import Kind, Status, Theme
from app.modules.community.promises.service import PromiseView


class PromiseSummaryOut(CamelModel):
    id: uuid.UUID
    promise_ref: str
    title_en: str
    title_ta: str
    kind: Kind = Field(description="Party commitment or government responsibility (FR-PRM-004)")
    theme: Theme
    area_key: str
    office_en: str
    office_ta: str
    due_date: date
    status: Status
    last_verified_at: datetime | None

    @classmethod
    def fields(cls, p: Promise) -> dict:  # type: ignore[type-arg]
        return {
            "id": p.id, "promise_ref": p.promise_ref, "title_en": p.title_en, "title_ta": p.title_ta, "kind": p.kind,
            "theme": p.theme, "area_key": p.area_key, "office_en": p.office_en, "office_ta": p.office_ta,
            "due_date": p.due_date, "status": p.status, "last_verified_at": p.last_verified_at,
        }

    @classmethod
    def build(cls, p: Promise) -> "PromiseSummaryOut":
        return cls(**cls.fields(p))


class MilestoneModel(CamelModel):
    title_en: str = Field(min_length=3, max_length=200)
    title_ta: str = Field(min_length=3, max_length=300)
    due_date: date | None = None

    @classmethod
    def build(cls, m: Milestone) -> "MilestoneModel":
        return cls(title_en=m.title_en, title_ta=m.title_ta, due_date=m.due_date)


class PromiseUpdateOut(CamelModel):
    id: uuid.UUID
    new_status: Status | None
    note_en: str
    note_ta: str
    evidence_refs: list[str]
    corrects_id: uuid.UUID | None = Field(description="Set on a correction; the original stays visible (FR-PRM-005)")
    decision: Literal["pending", "approved", "rejected", "system"]
    decision_reason: str | None
    created_at: datetime
    decided_at: datetime | None

    @classmethod
    def build(cls, u: Update) -> "PromiseUpdateOut":
        return cls(
            id=u.id, new_status=u.new_status, note_en=u.note_en, note_ta=u.note_ta,  # type: ignore[arg-type]
            evidence_refs=u.evidence_refs, corrects_id=u.corrects_id, decision=u.decision,  # type: ignore[arg-type]
            decision_reason=u.decision_reason, created_at=u.created_at, decided_at=u.decided_at,
        )


class PromiseFeedbackOut(CamelModel):
    id: uuid.UUID
    body: str
    state: Literal["pending", "published", "rejected"]
    reply_en: str | None
    reply_ta: str | None
    replied_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, f: Feedback) -> "PromiseFeedbackOut":
        return cls(id=f.id, body=f.body, state=f.state, reply_en=f.reply_en, reply_ta=f.reply_ta,  # type: ignore[arg-type]
                   replied_at=f.replied_at, created_at=f.created_at)


class PromiseDetailOut(PromiseSummaryOut):
    description_en: str
    description_ta: str
    source_reference: str
    source_published_on: date
    planned_start: date
    target_en: str
    target_ta: str
    blockers_en: str | None
    blockers_ta: str | None
    status_reason: str | None
    publication: Literal["draft", "awaiting_approval", "published"]
    published_at: datetime | None
    update_due_at: datetime | None
    milestones: list[MilestoneModel]
    updates: list[PromiseUpdateOut]
    feedback: list[PromiseFeedbackOut]

    @classmethod
    def from_view(cls, view: PromiseView) -> "PromiseDetailOut":
        p = view.promise
        return cls(
            **PromiseSummaryOut.fields(p),
            description_en=p.description_en, description_ta=p.description_ta, source_reference=p.source_reference,
            source_published_on=p.source_published_on, planned_start=p.planned_start, target_en=p.target_en,
            target_ta=p.target_ta, blockers_en=p.blockers_en, blockers_ta=p.blockers_ta, status_reason=p.status_reason,
            publication=p.publication,  # type: ignore[arg-type]
            published_at=p.published_at, update_due_at=p.update_due_at,
            milestones=[MilestoneModel.build(m) for m in view.milestones],
            updates=[PromiseUpdateOut.build(u) for u in view.updates],
            feedback=[PromiseFeedbackOut.build(f) for f in view.feedback],
        )


class PromiseFeedbackIn(CamelModel):
    body: str = Field(min_length=5, max_length=1000)


class PromiseAreaIn(CamelModel):
    level: Literal["platform", "province", "district", "ds", "gn"]
    code: str | None = Field(default=None, max_length=20)


class PromiseIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=160)
    title_ta: str = Field(min_length=5, max_length=220)
    description_en: str = Field(min_length=10, max_length=3000)
    description_ta: str = Field(min_length=10, max_length=4500)
    source_reference: str = Field(min_length=3, max_length=500, description="Where the promise was first published")
    source_published_on: date
    office_en: str = Field(min_length=3, max_length=200)
    office_ta: str = Field(min_length=3, max_length=300)
    kind: Kind
    theme: Theme
    planned_start: date
    due_date: date
    target_en: str = Field(min_length=5, max_length=1000, description="A measurable target")
    target_ta: str = Field(min_length=5, max_length=1500)
    blockers_en: str | None = Field(default=None, max_length=2000)
    blockers_ta: str | None = Field(default=None, max_length=3000)
    milestones: list[MilestoneModel] = Field(max_length=30)
    area: PromiseAreaIn | None = Field(default=None, description="Required when drafting; a promise's area never changes")


class PublicationDecisionIn(CamelModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=1000)


class PromiseUpdateIn(CamelModel):
    new_status: Literal["not_started", "in_progress", "completed", "blocked", "withdrawn"] | None = None
    note_en: str = Field(min_length=5, max_length=3000)
    note_ta: str = Field(min_length=5, max_length=4500)
    evidence_refs: list[str] = Field(default_factory=list, max_length=20)
    corrects_id: uuid.UUID | None = None


class ModerationIn(CamelModel):
    publish: bool
    reason: str | None = Field(default=None, max_length=500)


class ReplyIn(CamelModel):
    reply_en: str = Field(min_length=3, max_length=2000)
    reply_ta: str = Field(min_length=3, max_length=3000)


class PendingWorkOut(CamelModel):
    updates: list[PromiseUpdateOut]
    feedback: list[PromiseFeedbackOut]


class ReportRowOut(CamelModel):
    status: Status
    theme: Theme
    office_en: str
    area_key: str
    count: int
