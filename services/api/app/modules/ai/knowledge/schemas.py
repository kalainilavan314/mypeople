"""Request and response bodies for the assistant's knowledge base (D20)."""

import uuid
from datetime import date, datetime

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.ai.knowledge import rules
from app.modules.ai.knowledge.repository import Source
from app.modules.ai.knowledge.rules import Kind, State
from app.modules.ai.knowledge.service import SourceFile
from app.modules.ai.knowledge.service import today


class KbSourceIn(CamelModel):
    kind: Kind = Field(description="Policy, published manifesto material, app help or a public-service guide")
    title_ta: str = Field(min_length=3, max_length=300)
    title_en: str = Field(min_length=3, max_length=200)
    body_ta: str | None = Field(default=None, max_length=60000, description="The approved text in Tamil")
    body_en: str | None = Field(default=None, max_length=40000, description="The approved text in English")
    publisher: str = Field(min_length=2, max_length=200, description="Who issued it")
    source_url: str | None = Field(default=None, max_length=500, pattern=r"^(https://\S{4,500})?$")
    published_on: date | None = None
    change_note: str | None = Field(default=None, max_length=1000)
    review_due: date


class KbSourceSummaryOut(CamelModel):
    id: uuid.UUID
    family_id: uuid.UUID
    version: int
    kind: Kind
    title_ta: str
    title_en: str
    publisher: str
    state: State
    review_due: date
    review_overdue: bool
    passages: int
    approved_at: datetime | None
    updated_at: datetime

    @classmethod
    def fields(cls, s: Source) -> dict:  # type: ignore[type-arg]
        return {
            "id": s.id, "family_id": s.family_id, "version": s.version, "kind": s.kind, "title_ta": s.title_ta,
            "title_en": s.title_en, "publisher": s.publisher, "state": s.state, "review_due": s.review_due,
            "review_overdue": s.state == "approved" and rules.review_overdue(s.review_due, today()),
            "passages": s.passages, "approved_at": s.approved_at, "updated_at": s.updated_at,
        }

    @classmethod
    def build(cls, s: Source) -> "KbSourceSummaryOut":
        return cls(**cls.fields(s))


class KbSourceOut(KbSourceSummaryOut):
    body_ta: str | None
    body_en: str | None
    source_url: str | None
    published_on: date | None
    change_note: str | None
    return_reason: str | None = Field(description="Why a second editor sent the draft back")
    drafted_by: uuid.UUID
    drafted_by_name: str | None
    approved_by_name: str | None
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    superseded_at: datetime | None
    retired_at: datetime | None
    retire_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, s: Source) -> "KbSourceOut":
        return cls(
            **cls.fields(s), body_ta=s.body_ta, body_en=s.body_en, source_url=s.source_url, published_on=s.published_on,
            change_note=s.change_note, return_reason=s.return_reason, drafted_by=s.drafted_by,
            drafted_by_name=s.drafted_by_name, approved_by_name=s.approved_by_name, reviewed_by_name=s.reviewed_by_name,
            reviewed_at=s.reviewed_at, superseded_at=s.superseded_at, retired_at=s.retired_at, retire_reason=s.retire_reason,
            created_at=s.created_at,
        )


class KbSourceFileOut(CamelModel):
    source: KbSourceOut
    versions: list[KbSourceSummaryOut] = Field(description="Every version of this source, newest first")

    @classmethod
    def build(cls, f: SourceFile) -> "KbSourceFileOut":
        return cls(source=KbSourceOut.build(f.source), versions=[KbSourceSummaryOut.build(v) for v in f.versions])


class KbDecisionIn(CamelModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=1000, description="Required to send a draft back")


class KbReviewIn(CamelModel):
    review_due: date


class KbRetireIn(CamelModel):
    reason: str = Field(min_length=3, max_length=1000)
