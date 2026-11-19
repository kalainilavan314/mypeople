"""Diaspora participation (BRD v1.1 M46; FR-DSP-001 to 006, BR-147, OS-16, OD-40, ENT-59).

An overseas supporter registers their country of residence, time zone, contact preferences and the
skills they could offer remotely. Registration is separate from identity verification: it neither
needs nor grants verification, membership or any right to contribute. With it the supporter sees
international events in their own time, remote volunteering, how to propose a project for their home
area, and the diaspora committees they may apply to. Staff see aggregate counts only.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.rules import area_from_key
from app.modules.access.service import Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.diaspora import repository, rules
from app.modules.diaspora.repository import EventRow, RemoteOpportunity, Supporter
from app.modules.engagement.volunteering import repository as volunteering_repository
from app.modules.messaging.notifications import service as notifications

MARK_EVENTS = "events.manage"  # PRM-16 [ASSUMPTION]: whoever manages an event decides it is open to supporters abroad
SUMMARY = "analytics.view"  # PRM-24, platform scope [ASSUMPTION]: counts by country are platform-wide figures


class DiasporaRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class DiasporaNotFound(Exception):
    pass


@dataclass(frozen=True)
class Options:
    countries: dict[str, tuple[str, ...]]
    topics: tuple[str, ...]
    skills: list[volunteering_repository.Skill]


def options(db: Session) -> Options:
    return Options(rules.COUNTRY_ZONES, rules.TOPICS, volunteering_repository.skills(db))


def me(db: Session, member_id: uuid.UUID) -> Supporter | None:
    return repository.find_supporter(db, member_id)


def register(db: Session, member_id: uuid.UUID, *, country_code: str, time_zone: str, topics: list[str],
             skills: list[str], consent: bool, ip: str) -> Supporter:
    """FR-DSP-001: the profile exists without any contribution rights (BR-147)."""
    problems = rules.check_registration(country_code=country_code, time_zone=time_zone, topics=topics, skills=skills,
                                        known_skills=repository.skill_keys(db), consent=consent)
    if problems:
        raise DiasporaRefused(problems)
    first = repository.find_supporter(db, member_id) is None
    repository.save_supporter(db, member_id, {
        "country_code": country_code, "time_zone": time_zone, "contact_topics": sorted(set(topics)),
        "skills": sorted(set(skills)), "consent_version": rules.CONSENT_VERSION,
    })
    audit.record(db, actor_id=member_id, action="diaspora.registered" if first else "diaspora.updated",
                 target_type="diaspora_supporter", target_id=str(member_id),
                 details={"consent": rules.CONSENT_VERSION}, ip=ip)
    db.commit()
    saved = repository.find_supporter(db, member_id)
    assert saved is not None
    return saved


def withdraw(db: Session, member_id: uuid.UUID, ip: str) -> None:
    """Withdrawing deletes the profile (ENT-59: kept until withdrawal)."""
    if repository.delete_supporter(db, member_id):
        audit.record(db, actor_id=member_id, action="diaspora.withdrawn", target_type="diaspora_supporter",
                     target_id=str(member_id), ip=ip)
    db.commit()


@dataclass(frozen=True)
class InternationalEvent:
    event: EventRow
    sri_lanka: tuple[str, str, str]
    local: tuple[str, str, str] | None
    time_zone: str | None


def events(db: Session, member_id: uuid.UUID) -> list[InternationalEvent]:
    """FR-DSP-002: each international event in Sri Lanka time and in the supporter's own time zone."""
    supporter = repository.find_supporter(db, member_id)
    zone = supporter.time_zone if supporter else None
    return [
        InternationalEvent(event, rules.local_time(event.starts_at, "Asia/Colombo"),
                           rules.local_time(event.starts_at, zone) if zone else None, zone)
        for event in repository.international_events(db, datetime.now(UTC))
    ]


@dataclass(frozen=True)
class RemoteView:
    opportunity: RemoteOpportunity
    matches_my_skills: bool


def opportunities(db: Session, member_id: uuid.UUID) -> list[RemoteView]:
    """FR-DSP-003: open remote opportunities, those matching the supporter's skills first."""
    supporter = repository.find_supporter(db, member_id)
    mine = set(supporter.skills) if supporter else set()
    found = [RemoteView(o, bool(mine & set(o.skills))) for o in repository.remote_opportunities(db, datetime.now(UTC))]
    return sorted(found, key=lambda view: not view.matches_my_skills)


# --- Staff ------------------------------------------------------------------------------------------------


def managed_events(db: Session, staff: Staff) -> list[EventRow]:
    return repository.upcoming_events(db, datetime.now(UTC), visible_areas(staff, MARK_EVENTS))


def set_international(db: Session, staff: Staff, event_id: uuid.UUID, international: bool, ip: str) -> EventRow:
    event = repository.find_event(db, event_id)
    if event is None:
        raise DiasporaNotFound()
    path = tuple(area_from_key(key) for key in event.area_path)
    if not access_rules.holds(staff.rule_assignments(), MARK_EVENTS, path):
        refuse(db, staff, MARK_EVENTS, "outside_your_area", ip, target=("event", str(event_id)), area_path=path)
    if international:
        if repository.mark_international(db, event_id, staff.member_id):
            for supporter in repository.supporters_with_topic(db, "international_events"):
                notifications.notify(db, supporter, "diaspora_event_listed", event_id)
    else:
        repository.unmark_international(db, event_id)
    audit.record(db, actor_id=staff.member_id, action="diaspora.event." + ("listed" if international else "unlisted"),
                 target_type="event", target_id=str(event_id), area_path=path, ip=ip)
    db.commit()
    found = repository.find_event(db, event_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class Summary:
    total: int
    by_country: list[tuple[str, int | None]]
    by_topic: list[tuple[str, int | None]]
    proposals_by_stage: list[tuple[str, int | None]]


def summary(db: Session, staff: Staff, ip: str) -> Summary:
    """Aggregate counts only, small numbers hidden; never a list of supporters (ENT-59 minimal access)."""
    if not any(SUMMARY in a.permissions and a.area.level == "platform" for a in staff.assignments):
        refuse(db, staff, SUMMARY, "platform_scope_required", ip, target=("diaspora", "summary"), area_path=None)
    return Summary(
        total=repository.total_supporters(db),
        by_country=[(code, rules.hide_small(n)) for code, n in repository.counts_by_country(db)],
        by_topic=[(topic, rules.hide_small(n)) for topic, n in repository.counts_by_topic(db)],
        proposals_by_stage=[(stage, rules.hide_small(n)) for stage, n in repository.tagged_proposals_by_stage(db)],
    )


