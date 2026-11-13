"""Request and response bodies for Community Support (M11 to M14, S11, S12, D13, D14).

No body here carries membership, verification, donations, events or campaign data (FR-AST-009).
"""

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.assistance.repository import Appeal, Case, Decision, Partner, Programme
from app.modules.assistance.rules import Category, Outcome
from app.modules.assistance.service import ApplicantView, CaseFile


class EmergencyContactOut(CamelModel):
    number: str
    name_en: str
    name_ta: str


class SupportHomeOut(CamelModel):
    """M11: the official emergency numbers first, the categories, and the member's own requests."""

    emergency_contacts: list[EmergencyContactOut]
    categories: list[Category]
    requests: list["MyRequestSummaryOut"]


class SupportAreaIn(CamelModel):
    level: Literal["district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class SupportRequestIn(CamelModel):
    category: Category
    summary: str = Field(min_length=10, max_length=3000)
    emergency: bool = False
    consent: bool = Field(description="Consent to collect the case information (FR-AST-004)")
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9 ]{9,15}$")
    household: str | None = Field(default=None, max_length=120)
    area: SupportAreaIn | None = None


class MyRequestSummaryOut(CamelModel):
    id: uuid.UUID
    case_ref: str = Field(description="AS- reference that reveals nothing about the person, place or category")
    category: Category
    state: Literal["screening", "assessment", "decided", "closed", "withdrawn"]
    emergency: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, case: Case) -> "MyRequestSummaryOut":
        return cls(id=case.id, case_ref=case.case_ref, category=case.category, state=case.state,  # type: ignore[arg-type]
                   emergency=case.emergency, created_at=case.created_at, updated_at=case.updated_at)


SupportHomeOut.model_rebuild()


class SupportDecisionOut(CamelModel):
    id: uuid.UUID
    outcome: Outcome
    criteria_version: int
    programme_name_en: str
    reason_en: str
    reason_ta: str
    replaces_id: uuid.UUID | None
    decided_at: datetime

    @classmethod
    def build(cls, d: Decision) -> "SupportDecisionOut":
        return cls(id=d.id, outcome=d.outcome, criteria_version=d.criteria_version,  # type: ignore[arg-type]
                   programme_name_en=d.programme_name_en, reason_en=d.reason_en, reason_ta=d.reason_ta,
                   replaces_id=d.replaces_id, decided_at=d.decided_at)


class DeliveryOut(CamelModel):
    kind: str
    amount: str
    delivered_on: date
    provider: str
    evidence: str


class SupportAppealOut(CamelModel):
    id: uuid.UUID
    decision_id: uuid.UUID
    case_id: uuid.UUID
    case_ref: str
    kind: Literal["appeal", "complaint"]
    body: str
    state: Literal["open", "upheld", "changed"]
    due_at: datetime
    reason: str | None
    created_at: datetime
    decided_at: datetime | None

    @classmethod
    def build(cls, a: Appeal) -> "SupportAppealOut":
        return cls(id=a.id, decision_id=a.decision_id, case_id=a.case_id, case_ref=a.case_ref, kind=a.kind, body=a.body, state=a.state,  # type: ignore[arg-type]
                   due_at=a.due_at, reason=a.reason, created_at=a.created_at, decided_at=a.decided_at)


class MyRequestOut(MyRequestSummaryOut):
    """M13: status and what happened; never internal notes or who handled it."""

    decisions: list[SupportDecisionOut]
    deliveries: list[DeliveryOut]
    appeals: list[SupportAppealOut]

    @classmethod
    def from_view(cls, view: ApplicantView) -> "MyRequestOut":
        return cls(
            **MyRequestSummaryOut.build(view.case).model_dump(),
            decisions=[SupportDecisionOut.build(d) for d in view.decisions],
            deliveries=[DeliveryOut(**{k: d[k] for k in ("kind", "amount", "delivered_on", "provider", "evidence")})
                        for d in view.deliveries],
            appeals=[SupportAppealOut.build(a) for a in view.appeals],
        )


class AppealIn(CamelModel):
    decision_id: uuid.UUID
    kind: Literal["appeal", "complaint"]
    body: str = Field(min_length=10, max_length=2000)


class PublicReceiptOut(CamelModel):
    case_ref: str


# --- Staff ----------------------------------------------------------------------------------------------


class IntakeIn(SupportRequestIn):
    channel: Literal["hotline", "partner"]
    partner_id: uuid.UUID | None = None
    area: SupportAreaIn  # type: ignore[assignment]


class StaffCaseSummaryOut(CamelModel):
    id: uuid.UUID
    case_ref: str
    category: Category
    emergency: bool
    channel: str
    state: str
    caseworker_name: str | None
    area_key: str
    created_at: datetime

    @classmethod
    def build(cls, c: Case) -> "StaffCaseSummaryOut":
        return cls(id=c.id, case_ref=c.case_ref, category=c.category, emergency=c.emergency,  # type: ignore[arg-type]
                   channel=c.channel, state=c.state, caseworker_name=c.caseworker_name, area_key=c.area_key,
                   created_at=c.created_at)


class NoteOut(CamelModel):
    body: str
    author: str
    created_at: datetime


class ReferralOut(CamelModel):
    id: uuid.UUID
    partner: str
    kind: str
    state: str
    outcome: str | None
    consent_at: datetime
    created_at: datetime


class StaffCaseFileOut(StaffCaseSummaryOut):
    applicant_name: str
    applicant_phone: str | None
    household: str | None
    summary: str
    linked_case_ref: str | None
    notes: list[NoteOut]
    decisions: list[SupportDecisionOut]
    deliveries: list[DeliveryOut]
    referrals: list[ReferralOut]
    appeals: list[SupportAppealOut]
    possible_duplicates: list[StaffCaseSummaryOut] = Field(description="Suggestions to link, never grounds to reject (FR-AST-006)")
    may_decide: bool
    may_work: bool

    @classmethod
    def from_file(cls, f: CaseFile) -> "StaffCaseFileOut":
        c = f.case
        return cls(
            **StaffCaseSummaryOut.build(c).model_dump(),
            applicant_name=c.applicant_name, applicant_phone=c.applicant_phone, household=c.household, summary=c.summary,
            linked_case_ref=c.linked_case_ref,
            notes=[NoteOut(**n) for n in f.notes],
            decisions=[SupportDecisionOut.build(d) for d in f.decisions],
            deliveries=[DeliveryOut(**{k: d[k] for k in ("kind", "amount", "delivered_on", "provider", "evidence")})
                        for d in f.deliveries],
            referrals=[ReferralOut(**r) for r in f.referrals],
            appeals=[SupportAppealOut.build(a) for a in f.appeals],
            possible_duplicates=[StaffCaseSummaryOut.build(d) for d in f.duplicates],
            may_decide=f.may_decide, may_work=f.may_work,
        )


class CaseworkerOut(CamelModel):
    member_id: uuid.UUID
    full_name: str


class SupportAssignIn(CamelModel):
    caseworker_id: uuid.UUID


class SupportLinkIn(CamelModel):
    other_case_id: uuid.UUID


class CaseNoteIn(CamelModel):
    body: str = Field(min_length=3, max_length=3000)


class DecisionIn(CamelModel):
    outcome: Outcome
    criteria_version_id: uuid.UUID
    reason_en: str = Field(min_length=10, max_length=2000)
    reason_ta: str = Field(min_length=10, max_length=3000)


class DeliveryIn(CamelModel):
    kind: str = Field(min_length=3, max_length=120)
    amount: str = Field(min_length=1, max_length=120, description="Quantity or value")
    delivered_on: date
    provider: str = Field(min_length=2, max_length=200)
    evidence: str = Field(min_length=3, max_length=500)


class ReferralIn(CamelModel):
    partner_id: uuid.UUID
    consent: bool = Field(description="The applicant agreed to this partner seeing the case")


class ReferralUpdateIn(CamelModel):
    state: Literal["accepted", "completed", "declined"]
    outcome: str | None = Field(default=None, max_length=1000)


class SupportCloseIn(CamelModel):
    note: str = Field(min_length=5, max_length=1000)


class AppealDecisionIn(CamelModel):
    change: bool
    reason: str = Field(min_length=10, max_length=2000)
    outcome: Outcome | None = None
    criteria_version_id: uuid.UUID | None = None
    reason_ta: str | None = Field(default=None, max_length=3000)


class ProgrammeIn(CamelModel):
    name_en: str = Field(min_length=3, max_length=160)
    name_ta: str = Field(min_length=3, max_length=220)
    description_en: str = Field(min_length=10, max_length=3000)
    description_ta: str = Field(min_length=10, max_length=4500)
    categories: list[Category] = Field(min_length=1)


class ProgrammeOut(CamelModel):
    id: uuid.UUID
    name_en: str
    name_ta: str
    description_en: str
    description_ta: str
    categories: list[Category]
    active: bool
    criteria_version_id: uuid.UUID | None
    criteria_version: int | None
    criteria_en: str | None
    criteria_ta: str | None

    @classmethod
    def build(cls, p: Programme) -> "ProgrammeOut":
        return cls(id=p.id, name_en=p.name_en, name_ta=p.name_ta, description_en=p.description_en,
                   description_ta=p.description_ta, categories=p.categories, active=p.active,  # type: ignore[arg-type]
                   criteria_version_id=p.criteria_version_id, criteria_version=p.criteria_version,
                   criteria_en=p.criteria_en, criteria_ta=p.criteria_ta)


class CriteriaIn(CamelModel):
    criteria_en: str = Field(min_length=10, max_length=6000)
    criteria_ta: str = Field(min_length=10, max_length=9000)


class ActiveIn(CamelModel):
    active: bool


class PartnerIn(CamelModel):
    name: str = Field(min_length=3, max_length=200)
    kind: Literal["ngo", "public_service", "hospital", "other"]
    contact: str = Field(min_length=3, max_length=300)


class PartnerOut(CamelModel):
    id: uuid.UUID
    name: str
    kind: str
    contact: str
    active: bool

    @classmethod
    def build(cls, p: Partner) -> "PartnerOut":
        return cls(id=p.id, name=p.name, kind=p.kind, contact=p.contact, active=p.active)


class StatisticOut(CamelModel):
    area_key: str
    category: Category
    state: str
    count: int | None = Field(description="Null means fewer than 10")


class StatisticsOut(CamelModel):
    cells: list[StatisticOut]

    @classmethod
    def build(cls, rows: list[Any]) -> "StatisticsOut":
        return cls(cells=[StatisticOut(area_key=a, category=c, state=s, count=n) for a, c, s, n in rows])
