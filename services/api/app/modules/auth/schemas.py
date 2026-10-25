from typing import Self

from pydantic import BaseModel, Field, model_validator

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


class SignInResponse(BaseModel):
    """The token is returned for mobile apps; browsers use the HttpOnly cookie."""

    token: str
    member: MemberProfile
