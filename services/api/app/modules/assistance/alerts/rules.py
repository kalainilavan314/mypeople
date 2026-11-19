"""Alerts and safety rules (BRD v1.1 FR-DIS-001 to 004, 006 to 008, BR-138, OS-14) as plain functions.

The app relays official warnings only and never dispatches help (OS-14): an alert names the official
source, links to the source's own page and keeps the source's issue time. It reaches the members of the
District, DS or GN divisions it targets, by their home area, never by GPS (FR-DIS-002, BR-135); it
expires at the source's end time and is flagged when nobody has checked the source for 6 hours
(FR-DIS-008). Shelter information comes only from authorised sources, with the time it was reported,
and is marked as possibly out of date after 12 hours (FR-DIS-006).
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal
from urllib.parse import urlsplit

RELAY = "disaster.relay"  # PRM-53
LOGISTICS = "relief.logistics"  # PRM-54

STALE_AFTER = timedelta(hours=6)  # FR-DIS-008
SHELTER_OUT_OF_DATE_AFTER = timedelta(hours=12)  # FR-DIS-006
# [ASSUMPTION] An official warning covers at most 14 days; a longer one is relayed again when the source renews it.
LONGEST_ALERT = timedelta(days=14)
# The source's clock and ours may differ a little; an issue time further ahead than this is a typing mistake.
CLOCK_TOLERANCE = timedelta(minutes=10)
MAX_TARGETS = 50
HISTORY_DAYS = 90  # what M35 shows of expired and withdrawn alerts
KEEP_ALERTS = timedelta(days=730)  # ENT-54: alerts are kept for 2 years

Hazard = Literal["flood", "cyclone", "heavy_rain", "strong_wind", "landslide", "lightning", "tsunami", "drought", "other"]
HAZARDS: tuple[Hazard, ...] = (
    "flood", "cyclone", "heavy_rain", "strong_wind", "landslide", "lightning", "tsunami", "drought", "other",
)
Severity = Literal["advisory", "watch", "warning"]
SEVERITIES: tuple[Severity, ...] = ("advisory", "watch", "warning")
ShelterStatus = Literal["open", "full", "closed"]
SourceKey = Literal["dmc", "meteorology", "district_secretariat", "divisional_secretariat"]


@dataclass(frozen=True)
class Source:
    key: SourceKey
    name_en: str
    name_ta: str
    domains: tuple[str, ...]  # the source's own web addresses; a link must be on one of them
    alerts: bool  # may issue hazard warnings (INT-18)
    shelters: bool  # may publish shelter information (FR-DIS-006)


# [ASSUMPTION] INT-18 and DEP-23: warnings only from the Disaster Management Centre and the Department of
# Meteorology; shelters only from the Disaster Management Centre and the District and Divisional
# Secretariats that run them. A new source needs a code change, and so a review.
OFFICIAL_SOURCES: tuple[Source, ...] = (
    Source("dmc", "Disaster Management Centre", "அனர்த்த முகாமைத்துவ நிலையம்", ("dmc.gov.lk",), alerts=True, shelters=True),
    Source("meteorology", "Department of Meteorology", "வளிமண்டலவியல் திணைக்களம்", ("meteo.gov.lk",), alerts=True,
           shelters=False),
    Source("district_secretariat", "District Secretariat", "மாவட்டச் செயலகம்", ("dist.gov.lk",), alerts=False, shelters=True),
    Source("divisional_secretariat", "Divisional Secretariat", "பிரதேச செயலகம்", ("ds.gov.lk",), alerts=False, shelters=True),
)
SOURCES = {source.key: source for source in OFFICIAL_SOURCES}

# What a member may offer to do in relief work (FR-DIS-004).
ReliefTask = Literal["distribution", "cooking", "transport", "shelter_support", "cleaning", "loading", "first_aid"]
RELIEF_TASKS: tuple[ReliefTask, ...] = (
    "distribution", "cooking", "transport", "shelter_support", "cleaning", "loading", "first_aid",
)
VOLUNTEER_CONSENT_VERSION = "relief-availability-2026-11"
LONGEST_AVAILABILITY = timedelta(days=90)

# M36: what kind of urgent help, so the caseworker can route it. Never a dispatch (OS-14).
HelpNeed = Literal["food_water", "shelter", "evacuation", "medical", "missing_person", "other"]
HELP_NEEDS: tuple[HelpNeed, ...] = ("food_water", "shelter", "evacuation", "medical", "missing_person", "other")
HELP_NEED_WORDS = {
    "food_water": "food or drinking water",
    "shelter": "a safe place to stay",
    "evacuation": "help to leave an unsafe place",
    "medical": "medical help",
    "missing_person": "a missing family member",
    "other": "other urgent help",
}


def link_from(source: Source, url: str) -> bool:
    """The link opens the source's own page: https, on one of its addresses or a sub-address of one."""
    try:
        parts = urlsplit(url.strip())
        host = (parts.hostname or "").lower()
    except ValueError:
        return False
    return parts.scheme == "https" and any(host == domain or host.endswith(f".{domain}") for domain in source.domains)


def check_alert(*, source_key: str, source_url: str, issued_at: datetime, ends_at: datetime, now: datetime) -> list[str]:
    """FR-DIS-001: only an official warning source, a link to its own page and its issue time;
    FR-DIS-008: the source's end time, which must still be ahead."""
    problems = []
    source = SOURCES.get(source_key)  # type: ignore[call-overload]
    if source is None or not source.alerts:
        problems.append("unofficial_source")
    elif not link_from(source, source_url):
        problems.append("link_not_from_source")
    if issued_at > now + CLOCK_TOLERANCE:
        problems.append("issued_in_future")
    if ends_at <= issued_at:
        problems.append("ends_before_issue")
    elif ends_at <= now:
        problems.append("already_ended")
    elif ends_at - issued_at > LONGEST_ALERT:
        problems.append("alert_too_long")
    return problems


def check_targets(levels: list[str]) -> list[str]:
    """FR-DIS-002: one or more Districts, DS divisions or GN divisions."""
    if not levels:
        return ["targets_required"]
    if len(levels) > MAX_TARGETS:
        return ["too_many_targets"]
    if any(level not in ("district", "ds", "gn") for level in levels):
        return ["target_level"]
    return []


def check_shelter(*, source_key: str, source_url: str | None, reported_at: datetime, now: datetime) -> list[str]:
    """FR-DIS-006: an authorised source and the time it reported; a link, when given, is the source's own."""
    problems = []
    source = SOURCES.get(source_key)  # type: ignore[call-overload]
    if source is None or not source.shelters:
        problems.append("unauthorised_shelter_source")
    elif source_url and not link_from(source, source_url):
        problems.append("link_not_from_source")
    if reported_at > now + CLOCK_TOLERANCE:
        problems.append("reported_in_future")
    return problems


def is_current(state: str, ends_at: datetime, now: datetime) -> bool:
    """FR-DIS-008: an alert withdrawn by its source, or past the source's end time, is history."""
    return state == "active" and ends_at > now


def is_stale(state: str, ends_at: datetime, refreshed_at: datetime, now: datetime) -> bool:
    """FR-DIS-008: a current alert nobody has checked against its source for 6 hours."""
    return is_current(state, ends_at, now) and now - refreshed_at >= STALE_AFTER


def shelter_out_of_date(reported_at: datetime, now: datetime) -> bool:
    """FR-DIS-006: shelter data older than 12 hours is marked "may be out of date"."""
    return now - reported_at > SHELTER_OUT_OF_DATE_AFTER


def check_volunteer(*, consent: bool, tasks: list[str], available_until: date, today: date) -> list[str]:
    problems = []
    if not consent:
        problems.append("consent_required")
    if not tasks:
        problems.append("tasks_required")
    if available_until < today:
        problems.append("availability_in_past")
    elif available_until - today > LONGEST_AVAILABILITY:
        problems.append("availability_too_long")
    return problems


def severity_raised(before: str, after: str) -> bool:
    return SEVERITIES.index(after) > SEVERITIES.index(before)  # type: ignore[arg-type]


def help_summary(*, need: str, people: int, details: str, alert_ref: str | None) -> str:
    """The text of the Community Support case M36 opens (FR-DIS-007). It says the request came from the
    safety screen and which alert was current, and nothing about the person's membership (BR-102)."""
    lead = f"Emergency help request from Alerts and safety: {HELP_NEED_WORDS[need]} for {people} people."
    if alert_ref:
        lead += f" Sent while alert {alert_ref} was current."
    return f"{lead}\n\n{details.strip()}"
