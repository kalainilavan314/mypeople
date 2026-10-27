import uuid
from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from app.core.schemas import CamelModel
from app.modules.membership.schemas import MemberProfile


class SignInRequest(CamelModel):
    """The identity type and number the account registered with, and the password (FR-AUTH-005):
    either nic, or passportNumber with passportCountry."""

    nic: str | None = Field(default=None, min_length=1, max_length=32)
    passport_number: str | None = Field(default=None, min_length=1, max_length=32)
    passport_country: str | None = Field(default=None, min_length=3, max_length=3)
    # Generous upper bound: bcrypt only uses the first 72 bytes, but the limit
    # stops a client from sending megabytes to hash.
    password: str = Field(min_length=1, max_length=256)

    @model_validator(mode="after")
    def one_identity(self) -> Self:
        passport = self.passport_number is not None and self.passport_country is not None
        if (self.nic is not None) == passport or (self.passport_number is None) != (self.passport_country is None):
            raise ValueError("send either nic, or passportNumber with passportCountry")
        return self


class SignInResponse(CamelModel):
    """The tokens are returned for mobile apps and the dashboard's server; browsers use the HttpOnly cookies."""

    token: str = Field(description="Valid 15 minutes; renew it with refreshToken")
    refresh_token: str = Field(description="Good for one renewal (POST /v1/auth/refresh); keep it secret")
    member: MemberProfile


class RefreshIn(CamelModel):
    """Mobile apps send the refresh token here; browsers send the mp_refresh cookie instead."""

    refresh_token: str | None = Field(default=None, max_length=200)


class TokensOut(CamelModel):
    token: str
    refresh_token: str


class SecurityAlertOut(CamelModel):
    """M50: a flagged sign-in or a reused refresh token. A coarse device label; never an address or a place."""

    id: uuid.UUID
    kind: Literal["suspicious_sign_in", "refresh_reuse"]
    signals: list[str] = Field(description="new_device, recent_failures, unusual_velocity or refresh_token_reused")
    device_label: str
    created_at: datetime
    answered_at: datetime | None
    answer: Literal["it_was_me", "not_me"] | None
    session_active: bool


class AlertAnswerIn(CamelModel):
    answer: Literal["it_was_me", "not_me"]


class SessionOut(CamelModel):
    id: uuid.UUID
    device_label: str
    created_at: datetime
    last_seen_at: datetime
    current: bool


class MfaStatusOut(CamelModel):
    enrolled: bool
    enabled: bool
    session_verified: bool


class TotpEnrolmentOut(CamelModel):
    """Shown once, to add to an authenticator app; never shown again."""

    secret: str
    otpauth_uri: str


class MfaCodeInput(CamelModel):
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]
