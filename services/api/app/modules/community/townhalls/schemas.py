"""Request and response bodies for town halls (M21 to M23, D18)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.townhalls.repository import Question, TownHall


class TownHallOut(CamelModel):
    id: uuid.UUID
    session_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    language: Literal["ta", "en", "both"]
    speakers_en: str
    speakers_ta: str
    area_key: str
    starts_at: datetime
    ends_at: datetime
    state: Literal["draft", "scheduled", "live", "ended", "cancelled"]
    stream_url: str | None = Field(description="From the streaming provider (OD-44); null until it is set")
    audio_url: str | None = Field(description="Audio-only, 64 kbps or less (FR-THL-002)")
    captions_url: str | None
    recording_url: str | None
    transcript_en: str | None
    transcript_ta: str | None
    outcomes: list[dict[str, Any]] = Field(
        description="textEn, textTa, promiseId and caseNumber; members also get caseId, set only when they may open the case"
    )
    cancel_reason: str | None

    @classmethod
    def build(cls, t: TownHall) -> "TownHallOut":
        return cls(
            id=t.id, session_ref=t.session_ref, title_en=t.title_en, title_ta=t.title_ta, description_en=t.description_en,
            description_ta=t.description_ta, language=t.language, speakers_en=t.speakers_en,  # type: ignore[arg-type]
            speakers_ta=t.speakers_ta, area_key=t.area_key, starts_at=t.starts_at, ends_at=t.ends_at,
            state=t.state, stream_url=t.stream_url, audio_url=t.audio_url, captions_url=t.captions_url,  # type: ignore[arg-type]
            recording_url=t.recording_url, transcript_en=t.transcript_en, transcript_ta=t.transcript_ta,
            outcomes=t.outcomes, cancel_reason=t.cancel_reason,
        )


class QuestionOut(CamelModel):
    id: uuid.UUID
    body: str
    state: Literal["pending", "approved", "rejected", "merged"]
    mine: bool
    moderation_reason: str | None = Field(description="Shown to the author only")
    votes: int | None = Field(description="The total, on approved questions only")
    voted: bool
    answer_mode: Literal["live", "written"] | None
    answered_at_second: int | None
    answer_en: str | None
    answer_ta: str | None
    created_at: datetime

    @classmethod
    def build(cls, q: Question, viewer: uuid.UUID, *, staff: bool = False) -> "QuestionOut":
        mine = q.member_id == viewer
        return cls(
            id=q.id, body=q.body, state=q.state, mine=mine,  # type: ignore[arg-type]
            moderation_reason=q.moderation_reason if (mine or staff) else None,
            votes=q.votes if q.state == "approved" else None, voted=q.voted, answer_mode=q.answer_mode,  # type: ignore[arg-type]
            answered_at_second=q.answered_at_second, answer_en=q.answer_en, answer_ta=q.answer_ta, created_at=q.created_at,
        )


class TownHallSessionOut(TownHallOut):
    questions: list[QuestionOut]
    reminded: bool


class QuestionIn(CamelModel):
    body: str = Field(min_length=5, max_length=500)


class ReminderIn(CamelModel):
    remind: bool


class TownHallAreaIn(CamelModel):
    level: Literal["platform", "province", "district", "ds", "gn"]
    code: str | None = Field(default=None, max_length=20)


class TownHallIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=160)
    title_ta: str = Field(min_length=5, max_length=220)
    description_en: str = Field(min_length=10, max_length=2000)
    description_ta: str = Field(min_length=10, max_length=3000)
    language: Literal["ta", "en", "both"]
    speakers_en: str = Field(min_length=3, max_length=500)
    speakers_ta: str = Field(min_length=3, max_length=700)
    starts_at: datetime
    ends_at: datetime
    stream_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    audio_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    captions_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    legal_review_ref: str | None = Field(default=None, max_length=200, description="Needed in an election period")
    area: TownHallAreaIn | None = None


class TownHallStateIn(CamelModel):
    state: Literal["scheduled", "live", "ended", "cancelled"]
    reason: str | None = Field(default=None, max_length=500)


class TownHallModerationIn(CamelModel):
    decision: Literal["approve", "reject", "merge"]
    reason: str | None = Field(default=None, max_length=500)
    merge_into: uuid.UUID | None = None


class TownHallAnswerIn(CamelModel):
    mode: Literal["live", "written"]
    at_second: int | None = Field(default=None, ge=0)
    answer_en: str | None = Field(default=None, max_length=4000)
    answer_ta: str | None = Field(default=None, max_length=6000)


class OutcomeIn(CamelModel):
    text_en: str = Field(min_length=3, max_length=500)
    text_ta: str = Field(min_length=3, max_length=800)
    promise_id: uuid.UUID | None = Field(default=None, description="A published promise")
    case_number: str | None = Field(default=None, pattern=r"^CI-[0-9]{5,}$", max_length=20,
                                    description="An existing case, e.g. CI-00012")


class ArchiveIn(CamelModel):
    recording_url: str | None = Field(default=None, pattern=r"^https://", max_length=500)
    transcript_en: str | None = Field(default=None, max_length=200000)
    transcript_ta: str | None = Field(default=None, max_length=300000)
    outcomes: list[OutcomeIn] = Field(default_factory=list, max_length=50)


class StaffSessionOut(TownHallOut):
    legal_review_ref: str | None
    questions: list[QuestionOut]
