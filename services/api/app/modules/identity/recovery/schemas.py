import uuid
from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import Field, StringConstraints, model_validator

from app.core.schemas import CamelModel
from app.modules.identity.recovery.repository import AssistedRequest

Code = Annotated[str, StringConstraints(pattern=r"^\d{6}$")]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class AccountNumber(CamelModel):
    """The ID number the account registered with: nic, or passportNumber with passportCountry."""

    nic: str | None = Field(default=None, min_length=1, max_length=32)
    passport_number: str | None = Field(default=None, min_length=1, max_length=32)
    passport_country: str | None = Field(default=None, min_length=3, max_length=3)

    @model_validator(mode="after")
    def one_identity(self) -> Self:
        passport = self.passport_number is not None and self.passport_country is not None
        if (self.nic is not None) == passport or (self.passport_number is None) != (self.passport_country is None):
            raise ValueError("send either nic, or passportNumber with passportCountry")
        return self


class PhoneInput(CamelModel):
    phone: str = Field(max_length=25, description="E.164, or a Sri Lankan number such as 0771234567")


class PhoneConfirmInput(PhoneInput):
    code: Code


class CodeSentOut(CamelModel):
    """devCode appears only with SMS_PROVIDER=development, for local testing."""

    sent: bool
    dev_code: str | None = None


class RecoveryContactOut(CamelModel):
    phone: str


class RecoveryCodeInput(AccountNumber):
    code: Code


class ResetTokenOut(CamelModel):
    reset_token: str
    expires_in_seconds: int


class PasswordResetInput(CamelModel):
    reset_token: str = Field(max_length=2000)
    new_password: str = Field(max_length=256)


class AssistedRecoveryInput(AccountNumber):
    contact_method: Literal["phone", "email", "in_person"]
    contact_value: str | None = Field(default=None, max_length=200, description="How the support team can reach you")
    message: str | None = Field(default=None, max_length=500)


class AssistedRecoveryReceipt(CamelModel):
    reference: str


class AssistedRequestOut(CamelModel):
    id: uuid.UUID
    reference: str
    member_id: uuid.UUID | None = Field(description="null when the ID number matched no account")
    contact_method: str
    contact_value: str | None
    message: str | None
    state: Literal["open", "contact_replaced", "declined"]
    requested_at: datetime
    resolved_by: uuid.UUID | None
    resolved_at: datetime | None
    outcome_note: str | None

    @classmethod
    def from_stored(cls, request: AssistedRequest) -> Self:
        return cls(
            id=request.id,
            reference=request.reference,
            member_id=request.member_id,
            contact_method=request.contact_method,
            contact_value=request.contact_value,
            message=request.message,
            state=request.state,  # type: ignore[arg-type]
            requested_at=request.requested_at,
            resolved_by=request.resolved_by,
            resolved_at=request.resolved_at,
            outcome_note=request.outcome_note,
        )


class AssistedResolutionInput(CamelModel):
    outcome: Literal["contact_replaced", "declined"]
    new_phone: str | None = Field(default=None, max_length=25)
    note: Note
