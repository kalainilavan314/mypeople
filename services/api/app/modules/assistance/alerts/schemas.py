"""Request and response bodies for Alerts and safety (M35, M36, D26).

Class names start with Safety, Alert or Shelter so they stay unique in the API's OpenAPI document.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.assistance import rules as support_rules
from app.modules.assistance.alerts import rules
from app.modules.assistance.alerts.repository import Alert, ListedVolunteer, Revision, Shelter, Volunteer
from app.modules.assistance.alerts.rules import Hazard, HelpNeed, ReliefTask, Severity, ShelterStatus, SourceKey

NOT_DISPATCH_EN = (
    "This app passes on official warnings only. It is not an emergency service and cannot send help. "
    "In danger now, call the emergency numbers."
)
NOT_DISPATCH_TA = (
    "இந்தச் செயலி அதிகாரபூர்வ எச்சரிக்கைகளை மட்டுமே தெரிவிக்கிறது. இது அவசர சேவை அல்ல; உதவியை அனுப்ப முடியாது. "
    "இப்போது ஆபத்தில் இருந்தால் அவசர இலக்கங்களை அழையுங்கள்."
)


class SafetyContactOut(CamelModel):
    number: str
    name_en: str
    name_ta: str


class SafetySourceOut(CamelModel):
    key: SourceKey
    name_en: str
    name_ta: str
    domains: list[str]
    alerts: bool = Field(description="May issue hazard warnings (INT-18)")
    shelters: bool = Field(description="May publish shelter information (FR-DIS-006)")


def contacts() -> list[SafetyContactOut]:
    """FR-DIS-003: the official emergency numbers, the same list as Community Support (FR-AST-003)."""
    return [SafetyContactOut(number=n, name_en=en, name_ta=ta) for n, en, ta in support_rules.EMERGENCY_CONTACTS]


def sources() -> list[SafetySourceOut]:
    return [SafetySourceOut(key=s.key, name_en=s.name_en, name_ta=s.name_ta, domains=list(s.domains), alerts=s.alerts,
                            shelters=s.shelters) for s in rules.OFFICIAL_SOURCES]


class AlertOut(CamelModel):
    """FR-DIS-001: every alert carries its official source, the source's own link and issue time."""

    id: uuid.UUID
    alert_ref: str
    source_key: SourceKey
    source_name_en: str
    source_name_ta: str
    source_url: str
    source_issued_at: datetime
    source_ends_at: datetime = Field(description="The alert expires at the source's end time (FR-DIS-008)")
    hazard: Hazard
    severity: Severity
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    target_keys: list[str]
    state: Literal["current", "expired", "withdrawn"]
    withdrawn_reason: str | None
    relayed_at: datetime
    refreshed_at: datetime = Field(description="When someone last checked the alert against its source")
    stale: bool = Field(description="Current, and nobody has checked the source for 6 hours (FR-DIS-008)")
    emergency_contacts: list[SafetyContactOut] = Field(description="FR-DIS-003: on every alert")
    not_dispatch_en: str = NOT_DISPATCH_EN
    not_dispatch_ta: str = NOT_DISPATCH_TA

    @classmethod
    def build(cls, a: Alert, now: datetime | None = None) -> "AlertOut":
        now = now or datetime.now(UTC)
        source = rules.SOURCES[a.source_key]  # type: ignore[index]
        state = "withdrawn" if a.state == "withdrawn" else ("current" if a.source_ends_at > now else "expired")
        return cls(
            id=a.id, alert_ref=a.alert_ref, source_key=a.source_key,  # type: ignore[arg-type]
            source_name_en=source.name_en, source_name_ta=source.name_ta, source_url=a.source_url,
            source_issued_at=a.source_issued_at, source_ends_at=a.source_ends_at, hazard=a.hazard,  # type: ignore[arg-type]
            severity=a.severity, title_en=a.title_en, title_ta=a.title_ta, body_en=a.body_en,  # type: ignore[arg-type]
            body_ta=a.body_ta, target_keys=a.target_keys, state=state,  # type: ignore[arg-type]
            withdrawn_reason=a.withdrawn_reason, relayed_at=a.relayed_at, refreshed_at=a.refreshed_at,
            stale=rules.is_stale(a.state, a.source_ends_at, a.refreshed_at, now), emergency_contacts=contacts(),
        )


class ShelterOut(CamelModel):
    id: uuid.UUID
    name_en: str
    name_ta: str
    place_en: str
    place_ta: str
    area_key: str
    status: ShelterStatus
    capacity: int | None
    source_key: SourceKey
    source_name_en: str
    source_name_ta: str
    source_url: str | None
    source_reported_at: datetime
    out_of_date: bool = Field(description="Reported more than 12 hours ago: may be out of date (FR-DIS-006)")
    updated_at: datetime

    @classmethod
    def build(cls, s: Shelter, now: datetime | None = None) -> "ShelterOut":
        source = rules.SOURCES[s.source_key]  # type: ignore[index]
        return cls(
            id=s.id, name_en=s.name_en, name_ta=s.name_ta, place_en=s.place_en, place_ta=s.place_ta, area_key=s.area_key,
            status=s.status, capacity=s.capacity, source_key=s.source_key,  # type: ignore[arg-type]
            source_name_en=source.name_en, source_name_ta=source.name_ta, source_url=s.source_url,
            source_reported_at=s.source_reported_at,
            out_of_date=rules.shelter_out_of_date(s.source_reported_at, now or datetime.now(UTC)), updated_at=s.updated_at,
        )


class ReliefOfferOut(CamelModel):
    tasks: list[ReliefTask]
    available_until: date
    area_key: str
    updated_at: datetime

    @classmethod
    def build(cls, v: Volunteer) -> "ReliefOfferOut":
        return cls(tasks=v.tasks, available_until=v.available_until, area_key=v.area_key,  # type: ignore[arg-type]
                   updated_at=v.updated_at)


class SafetyHomeOut(CamelModel):
    """M35: the official emergency numbers, the statement that this is not a dispatch service, the current
    alerts for the area, nearby shelters and the member's relief offer."""

    area_keys: list[str] = Field(description="The District, DS and GN keys the alerts are for; empty when unknown")
    emergency_contacts: list[SafetyContactOut]
    not_dispatch_en: str = NOT_DISPATCH_EN
    not_dispatch_ta: str = NOT_DISPATCH_TA
    current: list[AlertOut]
    shelters: list[ShelterOut]
    relief_offer: ReliefOfferOut | None
    relief_offer_lock: Literal["identity_not_verified", "membership_not_active"] | None
    relief_tasks: list[ReliefTask]
    help_needs: list[HelpNeed]
    checked_at: datetime = Field(description="When the server answered, for the copy kept on the phone")


class SafetyAreaIn(CamelModel):
    level: Literal["district", "ds", "gn"]
    code: str = Field(min_length=2, max_length=20)


class SafetyHelpIn(CamelModel):
    """M36: an urgent request for follow-up by Community Support. Never a dispatch (OS-14)."""

    need: HelpNeed
    people: int = Field(ge=1, le=500)
    details: str = Field(min_length=10, max_length=2000)
    full_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, pattern=r"^\+?[0-9 ]{9,15}$")
    area: SafetyAreaIn | None = Field(default=None, description="Where help is needed; the home area when absent")
    alert_id: uuid.UUID | None = None
    consent: bool = Field(description="Consent to collect the case information (FR-AST-004)")


class SafetyHelpOut(CamelModel):
    case_id: uuid.UUID
    case_ref: str


class ReliefOfferIn(CamelModel):
    tasks: list[ReliefTask] = Field(min_length=1, max_length=7)
    available_until: date
    consent: bool


# --- Staff (D26) ---------------------------------------------------------------------------------------------


class AlertTextIn(CamelModel):
    source_url: str = Field(min_length=12, max_length=500)
    source_issued_at: datetime
    source_ends_at: datetime
    severity: Severity
    title_en: str = Field(min_length=5, max_length=160)
    title_ta: str = Field(min_length=5, max_length=220)
    body_en: str = Field(min_length=10, max_length=3000)
    body_ta: str = Field(min_length=10, max_length=4500)


class AlertRelayIn(AlertTextIn):
    source_key: SourceKey
    hazard: Hazard
    targets: list[SafetyAreaIn] = Field(min_length=1, max_length=rules.MAX_TARGETS)


class AlertRefreshIn(AlertTextIn):
    note: str | None = Field(default=None, max_length=500)


class AlertWithdrawIn(CamelModel):
    reason: str = Field(min_length=5, max_length=500)


class AlertRevisionOut(CamelModel):
    kind: Literal["relayed", "refreshed", "withdrawn"]
    source_url: str
    source_issued_at: datetime
    source_ends_at: datetime
    severity: Severity
    note: str | None
    changed_at: datetime

    @classmethod
    def build(cls, r: Revision) -> "AlertRevisionOut":
        return cls(kind=r.kind, source_url=r.source_url, source_issued_at=r.source_issued_at,  # type: ignore[arg-type]
                   source_ends_at=r.source_ends_at, severity=r.severity, note=r.note,  # type: ignore[arg-type]
                   changed_at=r.changed_at)


class ManagedAlertOut(AlertOut):
    recipients: int = Field(description="Members told when it was relayed (and again when its severity rose)")
    relay_minutes: int = Field(description="Minutes from the source's issue time to the relay (KPI-40)")
    revisions: list[AlertRevisionOut] = []

    @classmethod
    def managed(cls, a: Alert, revisions: list[Revision] | None = None, now: datetime | None = None) -> "ManagedAlertOut":
        base = AlertOut.build(a, now)
        minutes = max(0, int((a.relayed_at - a.source_issued_at).total_seconds() // 60))
        return cls(**base.model_dump(), recipients=a.recipients, relay_minutes=minutes,
                   revisions=[AlertRevisionOut.build(r) for r in revisions or []])


class ShelterIn(CamelModel):
    name_en: str = Field(min_length=3, max_length=160)
    name_ta: str = Field(min_length=3, max_length=220)
    place_en: str = Field(min_length=3, max_length=300)
    place_ta: str = Field(min_length=3, max_length=450)
    status: ShelterStatus
    capacity: int | None = Field(default=None, ge=1, le=100000)
    source_key: SourceKey
    source_url: str | None = Field(default=None, max_length=500)
    source_reported_at: datetime


class ShelterCreateIn(ShelterIn):
    area: SafetyAreaIn


class ReliefVolunteerOut(CamelModel):
    """FR-DIS-004: a name, the area, the tasks and until when; never a phone number."""

    full_name: str
    area_key: str
    tasks: list[ReliefTask]
    available_until: date
    updated_at: datetime

    @classmethod
    def build(cls, v: ListedVolunteer) -> "ReliefVolunteerOut":
        return cls(full_name=v.full_name, area_key=v.area_key, tasks=v.tasks,  # type: ignore[arg-type]
                   available_until=v.available_until, updated_at=v.updated_at)


class AlertComposerOut(CamelModel):
    """What the D26 composer offers: the official sources and the fixed lists."""

    sources: list[SafetySourceOut]
    hazards: list[Hazard]
    severities: list[Severity]
    longest_alert_days: int
    stale_after_hours: int
