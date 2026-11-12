"""Request and response bodies for surveys (H14, H21 and the survey manager)."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.surveys.repository import Participation, Survey
from app.modules.community.surveys.rules import QuestionKind, hide_small
from app.modules.community.surveys.service import QuestionResult, Results, SurveyView


class SurveyOptionModel(CamelModel):
    key: str = Field(pattern=r"^[a-z0-9_]{1,40}$")
    en: str = Field(min_length=1, max_length=120)
    ta: str = Field(min_length=1, max_length=160)


class SurveyQuestionOut(CamelModel):
    id: uuid.UUID
    position: int
    kind: QuestionKind
    prompt_en: str
    prompt_ta: str
    options: list[SurveyOptionModel]
    sensitive: bool = Field(description="Offers \"Prefer not to say\" (FR-SRV-004)")
    required: bool

    @classmethod
    def build(cls, row: dict[str, Any]) -> "SurveyQuestionOut":
        return cls(**{**row, "options": [SurveyOptionModel(**o) for o in row["options"]]})


class SurveyReceiptOut(CamelModel):
    receipt_ref: str
    submitted_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, receipt: Participation) -> "SurveyReceiptOut":
        return cls(receipt_ref=receipt.receipt_ref, submitted_at=receipt.submitted_at, updated_at=receipt.updated_at)


class SurveySummaryOut(CamelModel):
    id: uuid.UUID
    survey_ref: str
    title_en: str
    title_ta: str
    audience_en: str
    audience_ta: str
    anonymous: bool = Field(description="True only when the answers are stored with no link to the member")
    allow_edits: bool
    closes_at: datetime | None
    receipt: SurveyReceiptOut | None

    @classmethod
    def fields(cls, s: Survey, receipt: Participation | None) -> dict[str, Any]:
        return {
            "id": s.id, "survey_ref": s.survey_ref, "title_en": s.title_en, "title_ta": s.title_ta,
            "audience_en": s.audience_en, "audience_ta": s.audience_ta, "anonymous": s.anonymous,
            "allow_edits": s.allow_edits, "closes_at": s.closes_at,
            "receipt": SurveyReceiptOut.build(receipt) if receipt else None,
        }


class SurveyDetailOut(SurveySummaryOut):
    privacy_en: str
    privacy_ta: str
    next_steps_en: str
    next_steps_ta: str
    state: Literal["draft", "open", "closed"]
    questions: list[SurveyQuestionOut]
    my_answers: dict[str, Any] | None = Field(description="The member's own answers, for an identified survey that allows edits")
    can_answer: bool

    @classmethod
    def build(cls, view: SurveyView) -> "SurveyDetailOut":
        s = view.survey
        return cls(
            **SurveySummaryOut.fields(s, view.receipt),
            privacy_en=s.privacy_en, privacy_ta=s.privacy_ta, next_steps_en=s.next_steps_en, next_steps_ta=s.next_steps_ta,
            state=s.state,  # type: ignore[arg-type]
            questions=[SurveyQuestionOut.build(q) for q in view.questions],
            my_answers=view.my_answers if s.allow_edits else None,
            can_answer=view.can_answer,
        )


class SurveyResponseIn(CamelModel):
    answers: dict[str, Any] = Field(description="Question id to an option key, a list of keys, 1 to 5, text, or prefer_not_to_say")


# --- Managers --------------------------------------------------------------------------------------------


class SurveyQuestionIn(CamelModel):
    kind: QuestionKind
    prompt_en: str = Field(min_length=3, max_length=300)
    prompt_ta: str = Field(min_length=3, max_length=400)
    options: list[SurveyOptionModel] = Field(default_factory=list, max_length=12)
    sensitive: bool = False
    required: bool = True


class SurveyAreaIn(CamelModel):
    level: Literal["province", "district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class SurveyIn(CamelModel):
    title_en: str = Field(min_length=5, max_length=120)
    title_ta: str = Field(min_length=5, max_length=160)
    audience_en: str = Field(min_length=3, max_length=300)
    audience_ta: str = Field(min_length=3, max_length=400)
    privacy_en: str = Field(min_length=10, max_length=1000)
    privacy_ta: str = Field(min_length=10, max_length=1500)
    next_steps_en: str = Field(min_length=10, max_length=1000)
    next_steps_ta: str = Field(min_length=10, max_length=1500)
    anonymous: bool = False
    allow_edits: bool = False
    closes_at: datetime | None = None
    area: SurveyAreaIn
    questions: list[SurveyQuestionIn] = Field(max_length=50)


class ManagedSurveyOut(CamelModel):
    id: uuid.UUID
    survey_ref: str
    title_en: str
    title_ta: str
    state: Literal["draft", "open", "closed"]
    anonymous: bool
    allow_edits: bool
    area_key: str
    closes_at: datetime | None
    responses: int | None = Field(description="Hidden (null) while 1 to 9")
    created_at: datetime

    @classmethod
    def build(cls, s: Survey) -> "ManagedSurveyOut":
        return cls(
            id=s.id, survey_ref=s.survey_ref, title_en=s.title_en, title_ta=s.title_ta, state=s.state,  # type: ignore[arg-type]
            anonymous=s.anonymous, allow_edits=s.allow_edits, area_key=s.area_key, closes_at=s.closes_at,
            responses=hide_small(s.responses), created_at=s.created_at,
        )


class SurveyStateIn(CamelModel):
    state: Literal["open", "closed"]


class QuestionResultOut(CamelModel):
    question: SurveyQuestionOut
    answered: int | None
    counts: dict[str, int | None] = Field(description="Option key (or 1 to 5) to a count; null means 1 to 9")

    @classmethod
    def build(cls, result: QuestionResult) -> "QuestionResultOut":
        return cls(question=SurveyQuestionOut.build(result.question), answered=result.answered, counts=result.counts)


class SurveyResultsOut(CamelModel):
    survey: ManagedSurveyOut
    responses: int | None
    questions: list[QuestionResultOut]

    @classmethod
    def build(cls, results: Results) -> "SurveyResultsOut":
        return cls(
            survey=ManagedSurveyOut.build(results.survey), responses=results.responses,
            questions=[QuestionResultOut.build(q) for q in results.questions],
        )
