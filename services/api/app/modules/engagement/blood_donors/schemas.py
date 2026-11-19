"""Request and response bodies for the blood donor network (M37, M38, D27). Class names start with Blood.

No body here lists donors: a donor sees only their own record and the requests they were told about;
a partner sees counts, and the contact of donors who accepted and consented (FR-BLD-002, 004, 005).
"""

import uuid
from datetime import UTC, date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.engagement.blood_donors import rules
from app.modules.engagement.blood_donors.repository import Donor, Partner, Request, Requester, Response, SharedContact
from app.modules.engagement.blood_donors.rules import BloodGroup, ContactMethod, Outcome, PartnerKind, RequestState, Urgency


class BloodAreaIn(CamelModel):
    level: Literal["district", "ds"] = Field(description="A broad area only: a District or DS division")
    code: str = Field(min_length=2, max_length=20)


class BloodDonorIn(CamelModel):
    """M37: explicit opt-in (FR-BLD-001); the blood group is self-declared."""

    blood_group: BloodGroup
    area: BloodAreaIn
    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str = Field(pattern=r"^\+?[0-9 ]{9,15}$")
    contact_methods: list[ContactMethod] = Field(min_length=1, max_length=3)
    available: bool = True
    paused_until: date | None = Field(default=None, description="Not asked until after this date")
    consent: bool


class BloodDonorOut(CamelModel):
    blood_group: BloodGroup
    area_key: str
    district_key: str = Field(description="The district of the area, for the form")
    contact_name: str
    contact_phone: str
    contact_methods: list[ContactMethod]
    available: bool
    paused_until: date | None
    consented_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, d: Donor) -> "BloodDonorOut":
        district = next((key for key in d.area_path if key.startswith("district:")), d.area_key)
        return cls(blood_group=d.blood_group, area_key=d.area_key, district_key=district,  # type: ignore[arg-type]
                   contact_name=d.contact_name,
                   contact_phone=d.contact_phone, contact_methods=d.contact_methods,  # type: ignore[arg-type]
                   available=d.available, paused_until=d.paused_until, consented_at=d.consented_at, updated_at=d.updated_at)


class BloodNoticeOut(CamelModel):
    """M38: what the donor needs to decide, and nothing about the patient."""

    request_id: uuid.UUID
    request_ref: str
    partner_name: str
    partner_kind: PartnerKind
    blood_group: BloodGroup
    area_key: str
    urgency: Urgency
    needed_by: datetime
    state: Literal["open", "closed", "expired"]
    answer: Literal["notified", "accepted", "declined"]
    answered_at: datetime | None
    notified_at: datetime
    medical_statement_en: str = rules.MEDICAL_STATEMENT_EN
    medical_statement_ta: str = rules.MEDICAL_STATEMENT_TA

    @classmethod
    def build(cls, response: Response, request: Request, now: datetime | None = None) -> "BloodNoticeOut":
        return cls(
            request_id=request.id, request_ref=request.request_ref, partner_name=request.partner_name,
            partner_kind=request.partner_kind, blood_group=request.blood_group,  # type: ignore[arg-type]
            area_key=request.area_key, urgency=request.urgency, needed_by=request.needed_by,  # type: ignore[arg-type]
            state=rules.notice_state(request.state, request.needed_by, now or datetime.now(UTC)),
            answer=response.state, answered_at=response.answered_at, notified_at=response.created_at,  # type: ignore[arg-type]
        )


class BloodDonorHomeOut(CamelModel):
    """M37: the member's own donor record, if any, and the requests they were told about."""

    donor: BloodDonorOut | None
    notices: list[BloodNoticeOut]
    blood_groups: list[BloodGroup]
    consent_version: str = rules.CONSENT_VERSION
    medical_statement_en: str = rules.MEDICAL_STATEMENT_EN
    medical_statement_ta: str = rules.MEDICAL_STATEMENT_TA


class BloodAnswerIn(CamelModel):
    accept: bool
    consent: bool = Field(description="Consent to pass the donor's name, phone and contact ways to the partner")


# --- Partners (D27) ------------------------------------------------------------------------------------------


class BloodPartnerOut(CamelModel):
    id: uuid.UUID
    name: str
    kind: PartnerKind
    district_key: str
    agreement_ref: str
    active: bool
    created_at: datetime

    @classmethod
    def build(cls, p: Partner) -> "BloodPartnerOut":
        return cls(id=p.id, name=p.name, kind=p.kind, district_key=p.district_key,  # type: ignore[arg-type]
                   agreement_ref=p.agreement_ref, active=p.active, created_at=p.created_at)


class BloodDeskAccessOut(CamelModel):
    """What the dashboard may show this account: its partner's request desk, the Tier 5 oversight, or neither."""

    partner: BloodPartnerOut | None
    oversight: bool


class BloodRequestIn(CamelModel):
    blood_group: BloodGroup
    area: BloodAreaIn
    units: int = Field(ge=1, le=20)
    urgency: Urgency
    needed_by: datetime


class BloodRequestOut(CamelModel):
    """Counts only (FR-BLD-004)."""

    id: uuid.UUID
    request_ref: str
    partner_id: uuid.UUID
    partner_name: str
    blood_group: BloodGroup
    area_key: str
    units: int
    urgency: Urgency
    needed_by: datetime
    state: RequestState
    expired: bool = Field(description="Open, but past the time it was needed by")
    over_limit: bool
    decision_reason: str | None
    outcome: Outcome | None
    notified: int
    accepted: int
    declined: int
    created_at: datetime
    closed_at: datetime | None

    @classmethod
    def build(cls, q: Request, now: datetime | None = None) -> "BloodRequestOut":
        return cls(
            id=q.id, request_ref=q.request_ref, partner_id=q.partner_id, partner_name=q.partner_name,
            blood_group=q.blood_group, area_key=q.area_key, units=q.units, urgency=q.urgency,  # type: ignore[arg-type]
            needed_by=q.needed_by, state=q.state,  # type: ignore[arg-type]
            expired=q.state == "open" and q.needed_by <= (now or datetime.now(UTC)), over_limit=q.over_limit,
            decision_reason=q.decision_reason, outcome=q.outcome,  # type: ignore[arg-type]
            notified=q.notified, accepted=q.accepted, declined=q.declined, created_at=q.created_at, closed_at=q.closed_at,
        )


class BloodContactOut(CamelModel):
    """A donor who accepted and consented to share this (FR-BLD-005)."""

    name: str
    phone: str
    methods: list[ContactMethod]
    accepted_at: datetime

    @classmethod
    def build(cls, c: SharedContact) -> "BloodContactOut":
        return cls(name=c.name, phone=c.phone, methods=c.methods, accepted_at=c.accepted_at)  # type: ignore[arg-type]


class BloodRequestDetailOut(BloodRequestOut):
    contacts: list[BloodContactOut]


class BloodDeskOut(CamelModel):
    partner: BloodPartnerOut
    requests: list[BloodRequestOut]
    requests_per_hour: int = rules.REQUESTS_PER_HOUR
    medical_statement_en: str = rules.MEDICAL_STATEMENT_EN
    medical_statement_ta: str = rules.MEDICAL_STATEMENT_TA


class BloodCloseIn(CamelModel):
    outcome: Outcome


# --- Tier 5 oversight (D27) ----------------------------------------------------------------------------------


class BloodRequesterOut(CamelModel):
    id: uuid.UUID
    partner_id: uuid.UUID
    full_name: str
    member_code: str
    granted_at: datetime
    revoked_at: datetime | None

    @classmethod
    def build(cls, r: Requester) -> "BloodRequesterOut":
        return cls(id=r.id, partner_id=r.partner_id, full_name=r.full_name, member_code=r.member_code,
                   granted_at=r.granted_at, revoked_at=r.revoked_at)


class BloodOversightOut(CamelModel):
    partners: list[BloodPartnerOut]
    requesters: list[BloodRequesterOut]
    awaiting: list[BloodRequestOut]
    recent: list[BloodRequestOut]


class BloodPartnerIn(CamelModel):
    name: str = Field(min_length=3, max_length=200)
    kind: PartnerKind
    district_code: str = Field(min_length=2, max_length=20)
    agreement_ref: str = Field(min_length=3, max_length=120, description="The signed partner agreement (DEP-18)")


class BloodPartnerActiveIn(CamelModel):
    active: bool


class BloodRequesterIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)


class BloodDecisionIn(CamelModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)
