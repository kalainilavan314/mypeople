"""Request and response bodies for the livelihood guide (M39, M40, D28)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.content.guide import rules
from app.modules.content.guide.repository import Entry, Report
from app.modules.content.guide.rules import Category, ReportOutcome, ReportReason, State


class GuideEntrySummaryOut(CamelModel):
    """M39: one published entry in the list. Every published entry has both languages."""

    id: uuid.UUID
    entry_ref: str
    category: Category
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    provider_en: str
    provider_ta: str
    published_on: date
    verified_on: date
    expires_on: date | None

    @classmethod
    def fields(cls, e: Entry) -> dict:  # type: ignore[type-arg]
        return {
            "id": e.id, "entry_ref": e.entry_ref, "category": e.category, "title_en": e.title_en or "",
            "title_ta": e.title_ta or "", "summary_en": e.summary_en or "", "summary_ta": e.summary_ta or "",
            "provider_en": e.provider_en or "", "provider_ta": e.provider_ta or "", "published_on": e.published_on,
            "verified_on": e.verified_on, "expires_on": e.expires_on,
        }

    @classmethod
    def build(cls, e: Entry) -> "GuideEntrySummaryOut":
        return cls(**cls.fields(e))


class GuideReportOut(CamelModel):
    id: uuid.UUID
    entry_id: uuid.UUID
    reason: ReportReason
    note: str | None
    state: Literal["open", "fixed", "dismissed"]
    resolution_note: str | None
    resolved_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, r: Report) -> "GuideReportOut":
        return cls(id=r.id, entry_id=r.entry_id, reason=r.reason, note=r.note, state=r.state,  # type: ignore[arg-type]
                   resolution_note=r.resolution_note, resolved_at=r.resolved_at, created_at=r.created_at)


class GuideEntryOut(GuideEntrySummaryOut):
    """M40: the entry with its source and the eligibility disclaimer (FR-LIV-002, 004)."""

    body_en: str
    body_ta: str
    contact: str | None = Field(description="An official office's public contact, never a private person's")
    source_url: str
    disclaimer_en: str = Field(description="Shown with every entry: the guide never says who qualifies (FR-LIV-004)")
    disclaimer_ta: str
    my_open_report: GuideReportOut | None = Field(description="The member's own report waiting for the editors")

    @classmethod
    def from_view(cls, e: Entry, my_open_report: Report | None) -> "GuideEntryOut":
        return cls(
            **GuideEntrySummaryOut.fields(e), body_en=e.body_en or "", body_ta=e.body_ta or "", contact=e.contact,
            source_url=e.source_url or "", disclaimer_en=rules.DISCLAIMER_EN, disclaimer_ta=rules.DISCLAIMER_TA,
            my_open_report=GuideReportOut.build(my_open_report) if my_open_report else None,
        )


class GuideReportIn(CamelModel):
    reason: ReportReason
    note: str | None = Field(default=None, max_length=500, description="What looks outdated; optional")


class GuideEntryIn(CamelModel):
    """D28: a draft may be saved incomplete; review asks for every field in both languages."""

    category: Category
    title_en: str | None = Field(default=None, max_length=160)
    title_ta: str | None = Field(default=None, max_length=220)
    summary_en: str | None = Field(default=None, max_length=400)
    summary_ta: str | None = Field(default=None, max_length=600)
    body_en: str | None = Field(default=None, max_length=4000)
    body_ta: str | None = Field(default=None, max_length=6000)
    provider_en: str | None = Field(default=None, max_length=200)
    provider_ta: str | None = Field(default=None, max_length=300)
    contact: str | None = Field(default=None, max_length=300, description="An official office's public contact only")
    source_url: str | None = Field(default=None, max_length=500, pattern=r"^https?://\S+$")
    published_on: date | None = Field(default=None, description="When the provider published the information")
    verified_on: date | None = Field(default=None, description="When an editor last checked it against the source")
    expires_on: date | None = Field(default=None, description="The end date; the entry leaves the guide after it")


class GuideEntryManagedOut(CamelModel):
    """D28: an entry in any state, with what still stops it being published."""

    id: uuid.UUID
    entry_ref: str
    category: Category
    title_en: str | None
    title_ta: str | None
    summary_en: str | None
    summary_ta: str | None
    body_en: str | None
    body_ta: str | None
    provider_en: str | None
    provider_ta: str | None
    contact: str | None
    source_url: str | None
    published_on: date | None
    verified_on: date | None
    expires_on: date | None
    state: State
    expired: bool = Field(description="Published but past its end date, so members no longer see it")
    needs_reverification: bool = Field(description=f"Not checked against its source for over {rules.REVERIFY_AFTER_DAYS} days")
    missing: list[str] = Field(description="Problems that stop review or publication now (empty when complete)")
    review_note: str | None = Field(description="The reviewer's note, or the reason it was returned")
    withdrawn_reason: str | None
    open_reports: int
    review_requested_by_me: bool
    last_changed_by_me: bool
    published_at: datetime | None
    updated_at: datetime

    @classmethod
    def build(cls, e: Entry, me: uuid.UUID, today: date) -> "GuideEntryManagedOut":
        values = {name: getattr(e, name) for name in (
            "category", "title_en", "title_ta", "summary_en", "summary_ta", "body_en", "body_ta", "provider_en",
            "provider_ta", "contact", "source_url", "published_on", "verified_on", "expires_on",
        )}
        return cls(
            id=e.id, entry_ref=e.entry_ref, **values, state=e.state,  # type: ignore[arg-type]
            expired=e.state == "published" and rules.is_expired(e.expires_on, today),
            needs_reverification=e.state == "published" and rules.needs_reverification(e.verified_on, today),
            missing=rules.check_publishable(values, today) if e.state in ("draft", "in_review") else [],
            review_note=e.review_note, withdrawn_reason=e.withdrawn_reason, open_reports=e.open_reports,
            review_requested_by_me=e.review_requested_by == me, last_changed_by_me=e.updated_by == me,
            published_at=e.published_at, updated_at=e.updated_at,
        )


class GuideManagedReportOut(GuideReportOut):
    """D28's queue: the report with the entry it is about. The reporter is never named."""

    entry_ref: str
    entry_title_en: str | None
    entry_title_ta: str | None

    @classmethod
    def build(cls, r: Report) -> "GuideManagedReportOut":  # type: ignore[override]
        return cls(**GuideReportOut.build(r).model_dump(), entry_ref=r.entry_ref, entry_title_en=r.entry_title_en,
                   entry_title_ta=r.entry_title_ta)


class GuideEntryDetailManagedOut(GuideEntryManagedOut):
    reports: list[GuideManagedReportOut]


class GuideReviewIn(CamelModel):
    approve: bool
    note: str | None = Field(default=None, max_length=1000, description="Required when returning the entry")


class GuideWithdrawIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class GuideReportResolutionIn(CamelModel):
    outcome: ReportOutcome
    note: str | None = Field(default=None, max_length=500, description="Required when dismissing the report")
