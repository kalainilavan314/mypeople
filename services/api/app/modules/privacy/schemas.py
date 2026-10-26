import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.core.schemas import CamelModel
from app.modules.privacy import rules
from app.modules.privacy.repository import StoredRequest


class RetentionItemOut(CamelModel):
    data_en: str
    data_ta: str
    kept_en: str
    kept_ta: str


class PrivacyRequestOut(CamelModel):
    """The receipt (BR-028): reference, state, the statutory due date and, for a closure, what is
    kept and for how long; nothing is deleted at once (BR-079)."""

    id: uuid.UUID
    request_ref: str
    kind: Literal["copy", "closure"]
    state: Literal["open", "completed", "refused"]
    handled_by: str = "Data Protection Officer"
    created_at: datetime
    due_at: datetime = Field(description="21 working days [UNVERIFIED, PDPA], for the DPO to confirm")
    closed_at: datetime | None
    outcome_note: str | None
    retention: list[RetentionItemOut]

    @classmethod
    def build(cls, request: StoredRequest) -> "PrivacyRequestOut":
        return cls(
            id=request.id,
            request_ref=request.request_ref,
            kind=request.kind,  # type: ignore[arg-type]
            state=request.state,  # type: ignore[arg-type]
            created_at=request.created_at,
            due_at=request.due_at,
            closed_at=request.closed_at,
            outcome_note=request.outcome_note,
            retention=[RetentionItemOut(**item) for item in rules.CLOSURE_RETENTION] if request.kind == "closure" else [],
        )


class RegisterEntryOut(PrivacyRequestOut):
    member_id: uuid.UUID
    member_code: str
    note: str

    @classmethod
    def entry(cls, request: StoredRequest) -> "RegisterEntryOut":
        return cls(
            **PrivacyRequestOut.build(request).model_dump(),
            member_id=request.member_id,
            member_code=request.member_code,
            note=request.note,
        )


class PrivacyRequestIn(CamelModel):
    """A copy needs nothing more; a closure needs the password and the code sent by /closure-code."""

    kind: Literal["copy", "closure"]
    note: str = Field(default="", max_length=1000)
    password: str | None = Field(default=None, max_length=256)
    code: str | None = Field(default=None, pattern=r"^\d{6}$")

    @model_validator(mode="after")
    def closure_is_confirmed(self) -> "PrivacyRequestIn":
        if self.kind == "closure" and (self.password is None or self.code is None):
            raise ValueError("closing an account needs the password and the one-time code")
        return self


class PrivacyOutcomeIn(CamelModel):
    outcome: Literal["completed", "refused"]
    note: str = Field(min_length=3, max_length=2000, description="Shown to the member")
