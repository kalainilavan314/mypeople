"""Pydantic schemas for the finance module (M1.4)."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FundConfigResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    currency: str = "LKR"
    amount_presets: list[int] = Field(..., alias="amountPresets")
    bank_name: str | None = Field(None, alias="bankName")
    account_name: str | None = Field(None, alias="accountName")
    account_number: str | None = Field(None, alias="accountNumber")
    account_number_masked: str | None = Field(None, alias="accountNumberMasked")
    branch_name: str | None = Field(None, alias="branchName")
    transfer_instructions_en: str | None = Field(None, alias="transferInstructionsEn")
    transfer_instructions_ta: str | None = Field(None, alias="transferInstructionsTa")
    disclaimer_en: str = Field(..., alias="disclaimerEn")
    disclaimer_ta: str = Field(..., alias="disclaimerTa")
    no_reward_statement_en: str = Field(..., alias="noRewardStatementEn")
    no_reward_statement_ta: str = Field(..., alias="noRewardStatementTa")
    intake_available: bool = Field(..., alias="intakeAvailable")


class ContributionCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    amount_minor: int = Field(..., gt=0, alias="amountMinor")
    currency: Literal["LKR"] = "LKR"
    transfer_date: date = Field(..., alias="transferDate")
    bank_reference: str = Field(..., min_length=1, max_length=120, alias="bankReference")
    idempotency_key: UUID | None = Field(None, alias="idempotencyKey")
    declaration_version: str = Field("v1", alias="declarationVersion")
    no_privilege_acknowledged: bool = Field(..., alias="noPrivilegeAcknowledged")
    information_accurate_acknowledged: bool = Field(..., alias="informationAccurateAcknowledged")
    paying_for_self: bool = Field(True, alias="payingForSelf")


class ReceiptResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    receipt_code: str = Field(..., alias="receiptCode")
    contribution_ref: str = Field(..., alias="contributionRef")
    amount_minor: int = Field(..., alias="amountMinor")
    currency: str = "LKR"
    transfer_date: date = Field(..., alias="transferDate")
    issued_at: datetime = Field(..., alias="issuedAt")
    status: str = "VERIFIED"
    share_payload: str = Field(..., alias="sharePayload")


class TimelineEventResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    occurred_at: datetime = Field(..., alias="occurredAt")
    description_en: str = Field(..., alias="descriptionEn")
    description_ta: str = Field(..., alias="descriptionTa")


class ContributionDetailResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    contribution_ref: str = Field(..., alias="contributionRef")
    amount_minor: int = Field(..., alias="amountMinor")
    currency: str = "LKR"
    transfer_date: date = Field(..., alias="transferDate")
    bank_reference: str = Field(..., alias="bankReference")
    status: str
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    has_slip: bool = Field(..., alias="hasSlip")
    receipt: ReceiptResponse | None = None
    timeline: list[TimelineEventResponse] = Field(...)


class MemberContributionsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[ContributionDetailResponse]
    total: int


# Staff schemas


class StaffContributionSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    contribution_ref: str = Field(..., alias="contributionRef")
    donor_member_code: str = Field(..., alias="donorMemberCode")
    amount_minor: int = Field(..., alias="amountMinor")
    currency: str = "LKR"
    transfer_date: date = Field(..., alias="transferDate")
    status: str
    risk_flags: list[str] = Field(..., alias="riskFlags")
    claimed_by: UUID | None = Field(None, alias="claimedBy")
    claimed_by_name: str | None = Field(None, alias="claimedByName")
    created_at: datetime = Field(..., alias="createdAt")
    receipt_code: str | None = Field(None, alias="receiptCode")


class StaffContributionsListResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    items: list[StaffContributionSummary]
    total: int
    limit: int
    offset: int


class StaffReconciliationDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    statement_reference: str = Field(..., alias="statementReference")
    reviewed_by: UUID = Field(..., alias="reviewedBy")
    reviewed_at: datetime = Field(..., alias="reviewedAt")
    reason: str


class StaffApprovalDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    approved_by: UUID = Field(..., alias="approvedBy")
    approved_at: datetime = Field(..., alias="approvedAt")
    reason: str
    related_party_conflict: bool = Field(..., alias="relatedPartyConflict")


class StaffTimelineEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    from_status: str | None = Field(None, alias="fromStatus")
    to_status: str = Field(..., alias="toStatus")
    occurred_at: datetime = Field(..., alias="occurredAt")
    reason: str


class StaffContributionDetail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    contribution_ref: str = Field(..., alias="contributionRef")
    donor_member_code: str = Field(..., alias="donorMemberCode")
    donor_member_id: UUID = Field(..., alias="donorMemberId")
    amount_minor: int = Field(..., alias="amountMinor")
    currency: str = "LKR"
    transfer_date: date = Field(..., alias="transferDate")
    bank_reference: str = Field(..., alias="bankReference")
    status: str
    risk_flags: list[str] = Field(..., alias="riskFlags")
    claimed_by: UUID | None = Field(None, alias="claimedBy")
    claimed_by_name: str | None = Field(None, alias="claimedByName")
    claimed_at: datetime | None = Field(None, alias="claimedAt")
    declaration_version: str = Field(..., alias="declarationVersion")
    no_privilege_acknowledged: bool = Field(..., alias="noPrivilegeAcknowledged")
    information_accurate_acknowledged: bool = Field(..., alias="informationAccurateAcknowledged")
    paying_for_self: bool = Field(..., alias="payingForSelf")
    has_slip: bool = Field(..., alias="hasSlip")
    slip_version: int | None = Field(None, alias="slipVersion")
    reconciliation: StaffReconciliationDetail | None = None
    approval: StaffApprovalDetail | None = None
    receipt: ReceiptResponse | None = None
    timeline: list[StaffTimelineEvent] = Field(...)


class StaffReconcileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: Literal["matched", "needs_correction", "reject", "hold"]
    statement_reference: str | None = Field(None, alias="statementReference")
    reason: str = Field(..., min_length=3, max_length=1000)


class StaffApproveRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: Literal["approve", "reject", "hold"]
    reason: str = Field(..., min_length=3, max_length=1000)
    related_party_conflict: bool = Field(False, alias="relatedPartyConflict")


class StaffSlipViewTokenResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str
    expires_at: datetime = Field(..., alias="expiresAt")
    view_url: str = Field(..., alias="viewUrl")
