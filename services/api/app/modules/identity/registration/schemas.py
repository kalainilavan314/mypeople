from datetime import date
from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from app.core.schemas import CamelModel
from app.modules.identity.registration.rules import Gender, Language, Route
from app.modules.identity.registration.service import Progress
from app.modules.membership.schemas import MemberProfile

SurveyAnswer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
QuestionId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,40}$")]


class RegistrationInput(CamelModel):
    """A03 and the optional A13 to A15 details (FR-AUTH-010, FR-REG-026 to 033)."""

    full_name: str = Field(max_length=200, description="As on the NIC or passport")
    route: Route
    id_number: str = Field(max_length=32)
    passport_country: str | None = Field(default=None, max_length=3, description="ISO 3166-1 alpha-3, passport only")
    password: str = Field(max_length=256)
    # FR-AUTH-010: the terms and privacy notice must be accepted.
    accept_terms: Literal[True]
    language: Language
    dob: date | None = None
    gender: Gender | None = None
    district_code: str | None = Field(default=None, max_length=20)
    ds_code: str | None = Field(default=None, max_length=20)
    gs_code: str | None = Field(default=None, max_length=20)
    referral_code: str | None = Field(default=None, max_length=20)
    survey_answers: dict[QuestionId, SurveyAnswer] = Field(default={}, max_length=30)

    @model_validator(mode="after")
    def country_only_for_passports(self) -> Self:
        if (self.route == "passport") != (self.passport_country is not None):
            raise ValueError("passportCountry is required for passports and not allowed for NICs")
        return self


class RegistrationOut(CamelModel):
    """The tokens are returned for mobile apps; browsers use the HttpOnly cookies."""

    token: str
    refresh_token: str
    member: MemberProfile
    referral_accepted: bool | None = Field(description="null when no referral code was given (FR-REG-031)")


class ConsentInput(CamelModel):
    notice_version: str = Field(max_length=40)


class NoticesOut(CamelModel):
    """The notice versions the apps must show; consent is recorded against them."""

    terms_and_privacy: str
    identity_review: str


class StepOut(CamelModel):
    name: str
    done: bool


class ProgressOut(CamelModel):
    route: Route
    steps: list[StepOut]
    next_step: str | None
    review_state: str | None

    @classmethod
    def from_progress(cls, progress: Progress) -> Self:
        return cls(
            route=progress.route,  # type: ignore[arg-type]
            steps=[StepOut(name=s.name, done=s.done) for s in progress.steps],
            next_step=progress.next_step,
            review_state=progress.review_state,
        )
