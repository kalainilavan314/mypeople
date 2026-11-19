"""Request and response bodies for diaspora participation (M46 and the dashboard's diaspora page)."""

import uuid
from datetime import datetime

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.diaspora import repository
from app.modules.diaspora.rules import Topic, contribution_status
from app.modules.diaspora.service import InternationalEvent, Options, RemoteView, Summary


class DiasporaCountryOut(CamelModel):
    code: str
    time_zones: list[str]


class DiasporaSkillOut(CamelModel):
    key: str
    name_en: str
    name_ta: str


class DiasporaOptionsOut(CamelModel):
    countries: list[DiasporaCountryOut]
    topics: list[Topic]
    skills: list[DiasporaSkillOut]

    @classmethod
    def build(cls, options: Options) -> "DiasporaOptionsOut":
        return cls(
            countries=[DiasporaCountryOut(code=code, time_zones=list(zones)) for code, zones in options.countries.items()],
            topics=list(options.topics),
            skills=[DiasporaSkillOut(key=s.key, name_en=s.name_en, name_ta=s.name_ta) for s in options.skills],
        )


class DiasporaSupporterOut(CamelModel):
    country_code: str
    time_zone: str
    contact_topics: list[Topic]
    skills: list[str]
    registered_at: datetime
    updated_at: datetime

    @classmethod
    def build(cls, supporter: repository.Supporter) -> "DiasporaSupporterOut":
        return cls(country_code=supporter.country_code, time_zone=supporter.time_zone,
                   contact_topics=supporter.contact_topics,  # type: ignore[arg-type]
                   skills=supporter.skills, registered_at=supporter.registered_at, updated_at=supporter.updated_at)


class DiasporaContributionStatusOut(CamelModel):
    """FR-DSP-006: whether contributions from abroad are open, and why not (OD-40)."""

    available: bool
    reason: str | None


class DiasporaMeOut(CamelModel):
    supporter: DiasporaSupporterOut | None
    contributions: DiasporaContributionStatusOut

    @classmethod
    def build(cls, supporter: repository.Supporter | None) -> "DiasporaMeOut":
        available, reason = contribution_status()
        return cls(supporter=DiasporaSupporterOut.build(supporter) if supporter else None,
                   contributions=DiasporaContributionStatusOut(available=available, reason=reason))


class DiasporaSupporterIn(CamelModel):
    country_code: str = Field(pattern=r"^[A-Z]{2}$")
    time_zone: str = Field(min_length=3, max_length=64)
    contact_topics: list[Topic] = Field(default_factory=list, max_length=2)
    skills: list[str] = Field(default_factory=list, max_length=10)
    consent: bool = Field(description="Agreement to keep these details to tailor diaspora participation (FR-DSP-001)")


class DiasporaWallClockOut(CamelModel):
    date: str
    time: str
    utc_offset: str


class DiasporaInternationalEventOut(CamelModel):
    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    starts_at: datetime
    ends_at: datetime
    venue: str
    sri_lanka: DiasporaWallClockOut
    local: DiasporaWallClockOut | None
    time_zone: str | None

    @classmethod
    def build(cls, view: InternationalEvent) -> "DiasporaInternationalEventOut":
        e = view.event
        return cls(
            id=e.id, event_ref=e.event_ref, title_en=e.title_en, title_ta=e.title_ta, description_en=e.description_en,
            description_ta=e.description_ta, starts_at=e.starts_at, ends_at=e.ends_at, venue=e.venue,
            sri_lanka=DiasporaWallClockOut(date=view.sri_lanka[0], time=view.sri_lanka[1], utc_offset=view.sri_lanka[2]),
            local=DiasporaWallClockOut(date=view.local[0], time=view.local[1], utc_offset=view.local[2]) if view.local else None,
            time_zone=view.time_zone,
        )


class DiasporaOpportunityOut(CamelModel):
    id: uuid.UUID
    opportunity_ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    starts_at: datetime
    ends_at: datetime
    skills: list[str]
    places_left: int
    matches_my_skills: bool

    @classmethod
    def build(cls, view: RemoteView) -> "DiasporaOpportunityOut":
        o = view.opportunity
        return cls(id=o.id, opportunity_ref=o.opportunity_ref, title_en=o.title_en, title_ta=o.title_ta, role_en=o.role_en,
                   role_ta=o.role_ta, starts_at=o.starts_at, ends_at=o.ends_at, skills=o.skills,
                   places_left=max(0, o.places - o.confirmed), matches_my_skills=view.matches_my_skills)


class DiasporaEventOut(CamelModel):
    id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    starts_at: datetime
    venue: str
    area_key: str
    international: bool

    @classmethod
    def build(cls, e: repository.EventRow) -> "DiasporaEventOut":
        return cls(id=e.id, event_ref=e.event_ref, title_en=e.title_en, title_ta=e.title_ta, starts_at=e.starts_at,
                   venue=e.venue, area_key=e.area_key, international=e.international)


class DiasporaInternationalIn(CamelModel):
    international: bool


class DiasporaCountOut(CamelModel):
    """A count, or null when fewer than 5 (small numbers are hidden)."""

    key: str
    count: int | None


class DiasporaSummaryOut(CamelModel):
    total: int
    by_country: list[DiasporaCountOut]
    by_topic: list[DiasporaCountOut]
    proposals_by_stage: list[DiasporaCountOut]

    @classmethod
    def build(cls, summary: Summary) -> "DiasporaSummaryOut":
        return cls(
            total=summary.total,
            by_country=[DiasporaCountOut(key=k, count=n) for k, n in summary.by_country],
            by_topic=[DiasporaCountOut(key=k, count=n) for k, n in summary.by_topic],
            proposals_by_stage=[DiasporaCountOut(key=k, count=n) for k, n in summary.proposals_by_stage],
        )
