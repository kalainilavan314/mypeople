import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel

ControlKey = Literal["offline_attendance_replay_hours", "aggregate_minimum_group_size"]
DutyType = Literal[
    "registration", "scanning", "member_assistance", "accessibility_support",
    "logistics", "coordination", "administration",
]


class ControlIn(CamelModel):
    control_key: ControlKey
    integer_value: int = Field(gt=0)
    decision_revision_id: uuid.UUID
    reason: str = Field(min_length=10, max_length=1000)
    confirm_approved_basis: bool


class ControlOut(CamelModel):
    id: uuid.UUID
    control_key: ControlKey
    integer_value: int
    decision_key: str
    decision_revision: int
    decision_revision_id: uuid.UUID
    reason: str
    recorded_by: uuid.UUID
    recorded_at: datetime


class ReadinessItem(CamelModel):
    key: str
    ready: bool
    decision_key: str | None = None
    value: int | None = None
    reason: str


class OperationalReadinessOut(CamelModel):
    items: list[ReadinessItem]
    tier5_assignments: int
    tier5_certified: int


class VolunteerAssignmentIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)
    event_id: uuid.UUID
    consent_version: str = Field(min_length=1, max_length=40)
    duty_type: DutyType
    shift_start: AwareDatetime
    shift_end: AwareDatetime


class VolunteerAssignmentOut(CamelModel):
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    member_code: str
    event_id: uuid.UUID
    event_ref: str
    event_title_en: str
    event_title_ta: str
    consent_version: str
    duty_type: DutyType
    area_key: str
    shift_start: datetime
    shift_end: datetime
    state: Literal["offered", "accepted", "declined", "cancelled", "completed"]
    acknowledged_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AssignmentEventOut(CamelModel):
    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    starts_at: datetime
    ends_at: datetime
    area_key: str
    state: str


class AssignmentTransitionIn(CamelModel):
    state: Literal["accepted", "declined", "cancelled", "completed"]
    reason: str = Field(min_length=3, max_length=1000)


class DeviceRegisterIn(CamelModel):
    label: str = Field(min_length=1, max_length=80)


class DeviceRegisteredOut(CamelModel):
    id: uuid.UUID
    label: str
    device_token: str = Field(description="Shown once. Store only in the operating system secure store.")
    registered_at: datetime


class RegisteredDeviceOut(CamelModel):
    id: uuid.UUID
    label: str
    registered_at: datetime
    last_seen_at: datetime | None
    revoked_at: datetime | None


class PolicyPublishIn(CamelModel):
    policy_key: str = Field(min_length=1, max_length=80)
    policy_type: Literal["privacy_notice", "terms", "optional_consent", "election_rule"]
    version: str = Field(min_length=1, max_length=40)
    locale: Literal["en", "ta"]
    content_text: str = Field(min_length=1, max_length=100000)
    approval_reference: str = Field(min_length=3, max_length=300)
    approved_at: AwareDatetime
    effective_from: AwareDatetime
    confirm_immutable_publication: bool


class PolicyVersionOut(CamelModel):
    id: uuid.UUID
    policy_key: str
    policy_type: str
    version: str
    locale: str
    content_sha256: str
    approval_reference: str | None
    approved_at: datetime
    effective_from: datetime
    created_at: datetime


class EffectivePolicyOut(PolicyVersionOut):
    content_text: str
    my_action: str | None
    my_action_at: datetime | None


class ConsentActionIn(CamelModel):
    action: Literal["acknowledged", "granted", "withdrawn"]
    legal_basis: str = Field(min_length=2, max_length=80)


class ConsentActionOut(CamelModel):
    policy_version_id: uuid.UUID
    action: str
    occurred_at: datetime


class Tier5CertificationIn(CamelModel):
    assignment_id: uuid.UUID
    decision: Literal["certified", "revoked_required"]
    period_start: date
    period_end: date
    reviewer_name: str = Field(min_length=2, max_length=160)
    reviewer_title: str = Field(min_length=2, max_length=160)
    evidence_ref: str = Field(min_length=3, max_length=300)
    reason: str = Field(min_length=10, max_length=1000)
    certified_at: date
    confirm_external_review: bool


class Tier5AssignmentOut(CamelModel):
    assignment_id: uuid.UUID
    member_id: uuid.UUID
    full_name: str
    member_code: str
    state: str
    granted_at: datetime
    ended_at: datetime | None


class Tier5CertificationOut(CamelModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    member_id: uuid.UUID
    full_name: str
    member_code: str
    decision: str
    period_start: date
    period_end: date
    reviewer_name: str
    reviewer_title: str
    evidence_ref: str
    reason: str
    certified_at: date
    recorded_by: uuid.UUID
    recorded_at: datetime


class AggregateCellOut(CamelModel):
    key: str
    count: int | None
    suppressed: bool


class VolunteerAggregateOut(CamelModel):
    event_id: uuid.UUID
    minimum_group_size: int
    total: int | None
    cells: list[AggregateCellOut]
