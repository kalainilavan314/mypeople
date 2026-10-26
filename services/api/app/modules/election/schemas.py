import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AreaRef
from app.modules.election.repository import StoredNotice, StoredPeriod
from app.modules.election.rules import LABELS, ElectionType, NoticeSource
from app.modules.election.service import CurrentElection, Declared, PeriodFile

PeriodState = Literal["declared", "ended", "withdrawn"]

# Field names here never describe how anyone votes or intends to vote (FR-ELX-010); a test checks it.


class PeriodIn(CamelModel):
    election_type: ElectionType
    title_en: str = Field(min_length=1, max_length=160)
    title_ta: str = Field(min_length=1, max_length=160)
    area: AreaRef
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    silence_starts_at: AwareDatetime
    silence_ends_at: AwareDatetime
    polling_day: date = Field(description="Sri Lankan calendar day; the silence window must cover all of it")
    source_url: str = Field(pattern=r"^https://", max_length=500, description="The Election Commission publication")
    source_reference: str = Field(min_length=1, max_length=200, description="e.g. the gazette number")
    source_published_at: AwareDatetime


class CloseIn(CamelModel):
    action: Literal["end", "withdraw"] = Field(description="end when the election is over; withdraw if declared in error")
    reason: str = Field(min_length=3, max_length=500)


class NoticeIn(CamelModel):
    source: NoticeSource = Field(description="FR-ELX-004: Election Commission information or Party information")
    title_en: str = Field(min_length=1, max_length=160)
    title_ta: str = Field(min_length=1, max_length=160)
    body_en: str = Field(min_length=1, max_length=2000)
    body_ta: str = Field(min_length=1, max_length=2000)
    source_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    document_reference: str | None = Field(default=None, min_length=1, max_length=200)
    source_published_at: AwareDatetime | None = None


class PeriodOut(CamelModel):
    id: uuid.UUID
    period_ref: str
    election_type: ElectionType
    title_en: str
    title_ta: str
    area_key: str
    starts_at: datetime
    ends_at: datetime
    silence_starts_at: datetime
    silence_ends_at: datetime
    polling_day: date
    source_url: str
    source_reference: str
    source_published_at: datetime
    state: PeriodState
    declared_at: datetime
    closed_at: datetime | None

    @classmethod
    def build(cls, period: StoredPeriod) -> "PeriodOut":
        return cls(
            id=period.id,
            period_ref=period.period_ref,
            election_type=period.election_type,  # type: ignore[arg-type]
            title_en=period.title_en,
            title_ta=period.title_ta,
            area_key=period.area_key,
            starts_at=period.starts_at,
            ends_at=period.ends_at,
            silence_starts_at=period.silence_starts_at,
            silence_ends_at=period.silence_ends_at,
            polling_day=period.polling_day,
            source_url=period.source_url,
            source_reference=period.source_reference,
            source_published_at=period.source_published_at,
            state=period.state,  # type: ignore[arg-type]
            declared_at=period.declared_at,
            closed_at=period.closed_at,
        )


class DeclaredOut(PeriodOut):
    overlaps: list[str] = Field(description="Other declared periods for the same time and area (a warning, D22)")

    @classmethod
    def from_declared(cls, declared: Declared) -> "DeclaredOut":
        return cls(**PeriodOut.build(declared.period).model_dump(), overlaps=declared.overlaps)


class ElectionNoticeOut(CamelModel):
    id: uuid.UUID
    source: NoticeSource
    label_en: str
    label_ta: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    source_url: str | None
    document_reference: str | None
    source_published_at: datetime | None
    published_at: datetime
    withdrawn_at: datetime | None

    @classmethod
    def build(cls, notice: StoredNotice) -> "ElectionNoticeOut":
        label_en, label_ta = LABELS[notice.source]  # type: ignore[index]
        return cls(
            id=notice.id,
            source=notice.source,  # type: ignore[arg-type]
            label_en=label_en,
            label_ta=label_ta,
            title_en=notice.title_en,
            title_ta=notice.title_ta,
            body_en=notice.body_en,
            body_ta=notice.body_ta,
            source_url=notice.source_url,
            document_reference=notice.document_reference,
            source_published_at=notice.source_published_at,
            published_at=notice.published_at,
            withdrawn_at=notice.withdrawn_at,
        )


class PeriodFileOut(PeriodOut):
    notices: list[ElectionNoticeOut]

    @classmethod
    def from_file(cls, file: PeriodFile) -> "PeriodFileOut":
        return cls(
            **PeriodOut.build(file.period).model_dump(),
            notices=[ElectionNoticeOut.build(n) for n in file.notices],
        )


class ElectionBannerOut(CamelModel):
    """FR-ELX-001: the official date and countdown, citing the Election Commission publication and its time."""

    period_ref: str
    election_type: ElectionType
    title_en: str
    title_ta: str
    polling_day: date
    days_to_polling: int
    in_silence: bool
    silence_starts_at: datetime
    silence_ends_at: datetime
    label_en: str
    label_ta: str
    source_url: str
    source_reference: str
    source_published_at: datetime
    notices: list[ElectionNoticeOut]

    @classmethod
    def build(cls, current: CurrentElection) -> "ElectionBannerOut":
        period = current.period
        label_en, label_ta = LABELS["election_commission"]
        return cls(
            period_ref=period.period_ref,
            election_type=period.election_type,  # type: ignore[arg-type]
            title_en=period.title_en,
            title_ta=period.title_ta,
            polling_day=period.polling_day,
            days_to_polling=current.days_to_polling,
            in_silence=current.in_silence,
            silence_starts_at=period.silence_starts_at,
            silence_ends_at=period.silence_ends_at,
            label_en=label_en,
            label_ta=label_ta,
            source_url=period.source_url,
            source_reference=period.source_reference,
            source_published_at=period.source_published_at,
            notices=[ElectionNoticeOut.build(n) for n in current.notices],
        )
