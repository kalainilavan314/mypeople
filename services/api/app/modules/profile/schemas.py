import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.identity.registration.schemas import QuestionId, SurveyAnswer
from app.modules.profile import rules
from app.modules.profile.area_changes.repository import StoredChange
from app.modules.profile.repository import ActivityItem
from app.modules.profile.service import Profile


class AreaChangeOut(CamelModel):
    """The receipt for an area-change request (FR-PROF-005): the current area stays until it is approved."""

    id: uuid.UUID
    request_ref: str
    to_gn: str
    to_gn_name: str
    state: Literal["awaiting_proof", "submitted", "approved", "declined", "withdrawn"]
    created_at: datetime
    submitted_at: datetime | None
    decided_at: datetime | None
    decision_reason: str | None

    @classmethod
    def build(cls, change: StoredChange) -> "AreaChangeOut":
        return cls(
            id=change.id,
            request_ref=change.request_ref,
            to_gn=change.to_gn,
            to_gn_name=change.to_gn_name,
            state=change.state,  # type: ignore[arg-type]
            created_at=change.created_at,
            submitted_at=change.submitted_at,
            decided_at=change.decided_at,
            decision_reason=change.decision_reason,
        )


class QueuedAreaChangeOut(AreaChangeOut):
    member_id: uuid.UUID
    from_gn: str | None
    has_proof: bool

    @classmethod
    def queued(cls, change: StoredChange) -> "QueuedAreaChangeOut":
        return cls(
            **AreaChangeOut.build(change).model_dump(),
            member_id=change.member_id,
            from_gn=change.from_gn,
            has_proof=change.proof_id is not None,
        )


class LockedFieldOut(CamelModel):
    field: Literal["legal_name", "date_of_birth", "id_number"]
    reason: Literal["re_review_required"] = "re_review_required"


class ProfileOut(CamelModel):
    """P01 and P02. Locked fields change only through a new identity review (BR-073)."""

    member_code: str
    legal_name: str
    display_name: str | None = Field(description="Greets the member; never replaces the legal name (BR-074)")
    date_of_birth: date | None
    gender: Literal["male", "female", "other"] | None
    language: Literal["ta", "en"] = "ta"
    tier: str = Field(description="As assigned; there is no way to change it here (FR-PROF-002)")
    identity_state: Literal["not_submitted", "submitted", "in_review", "needs_update", "verified", "unable_to_verify"]
    membership_state: Literal["pending", "active", "suspended", "inactive"]
    district_name: str | None
    ds_name: str | None
    gn_name: str | None
    mobile_masked: str | None = Field(description="Changed only through a code to the new number (/v1/identity/me/phone)")
    verified_at: datetime | None
    verification_valid_until: datetime | None = Field(description="OD-17 [ASSUMPTION]: a year after verification")
    locked_fields: list[LockedFieldOut]
    open_area_change: AreaChangeOut | None

    @classmethod
    def build(cls, profile: Profile) -> "ProfileOut":
        return cls(
            member_code=profile.member_code,
            legal_name=profile.legal_name,
            display_name=profile.display_name,
            date_of_birth=profile.date_of_birth,  # type: ignore[arg-type]
            gender=profile.gender,  # type: ignore[arg-type]
            language=profile.language if profile.language in ("ta", "en") else "ta",  # type: ignore[arg-type]
            tier=profile.tier,
            identity_state=profile.identity_state,  # type: ignore[arg-type]
            membership_state=profile.membership_state,  # type: ignore[arg-type]
            district_name=profile.district_name,
            ds_name=profile.ds_name,
            gn_name=profile.gn_name,
            mobile_masked=profile.mobile_masked,
            verified_at=profile.verified_at,
            verification_valid_until=profile.verification_valid_until,
            locked_fields=[LockedFieldOut(field=name) for name in rules.LOCKED_FIELDS],  # type: ignore[arg-type]
            open_area_change=AreaChangeOut.build(profile.open_area_change) if profile.open_area_change else None,
        )


class ProfileUpdateIn(CamelModel):
    """Only these; anything else is refused by the schema. An empty display name greets by the legal name."""

    display_name: str | None = Field(default=None, max_length=60)
    gender: Literal["male", "female", "other"] | None = None
    language: Literal["ta", "en"] | None = None


class ActivityItemOut(CamelModel):
    kind: rules.ActivityKind
    reference: str
    title: str | None
    state: str
    at: datetime
    target_id: uuid.UUID = Field(description="What the item opens: the review, appeal, event, request or receipt")

    @classmethod
    def build(cls, item: ActivityItem) -> "ActivityItemOut":
        return cls(
            kind=item.kind,  # type: ignore[arg-type]
            reference=item.reference,
            title=item.title,
            state=item.state,
            at=item.at,
            target_id=item.target_id,
        )


class SurveyAnswersIn(CamelModel):
    answers: dict[QuestionId, SurveyAnswer] = Field(max_length=30, description="An empty set deletes every answer")


class IdentityDataItemOut(CamelModel):
    data_en: str
    data_ta: str
    purpose_en: str
    purpose_ta: str
    retention_en: str
    retention_ta: str


class AreaChangeIn(CamelModel):
    gn_code: str = Field(min_length=1, max_length=20)


class AreaDecisionIn(CamelModel):
    decision: Literal["approve", "decline"]
    reason: str = Field(min_length=3, max_length=1000)
