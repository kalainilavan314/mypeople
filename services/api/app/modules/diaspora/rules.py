"""Diaspora participation rules (BRD v1.1 FR-DSP-001 to 006, BR-147, OS-16, OD-40) as plain functions.

Tamil supporters living abroad register their country of residence, time zone and contact
preferences. Registration is separate from identity verification and membership: it confers no
right to contribute, and foreign or cross-border contributions stay switched off until legal,
banking, currency, source-of-funds and app-store approvals are recorded (OD-40). Taking part in a
feature still follows that feature's own rules.
"""

from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

CONSENT_VERSION = "diaspora-2026-11"  # FR-DSP-001: what the supporter agreed to share, and why

# OD-40 [ASSUMPTION, BRD recommendation]: keep disabled until approvals are recorded. One constant,
# so the decision has one place to change once Legal Counsel and the Treasurer record it.
FOREIGN_CONTRIBUTIONS_ENABLED = False

Topic = Literal["international_events", "committee_networking"]
TOPICS: tuple[Topic, ...] = ("international_events", "committee_networking")

SRI_LANKA = ZoneInfo("Asia/Colombo")

# [ASSUMPTION] The countries where most Tamil supporters live, and their time zones (IANA names).
# Adding a country is a one-line change; the app reads the list from the API.
COUNTRY_ZONES: dict[str, tuple[str, ...]] = {
    "CA": ("America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax"),
    "GB": ("Europe/London",),
    "FR": ("Europe/Paris",),
    "CH": ("Europe/Zurich",),
    "DE": ("Europe/Berlin",),
    "NO": ("Europe/Oslo",),
    "DK": ("Europe/Copenhagen",),
    "SE": ("Europe/Stockholm",),
    "NL": ("Europe/Amsterdam",),
    "IT": ("Europe/Rome",),
    "AU": ("Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Adelaide", "Australia/Perth"),
    "NZ": ("Pacific/Auckland",),
    "US": ("America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"),
    "IN": ("Asia/Kolkata",),
    "MY": ("Asia/Kuala_Lumpur",),
    "SG": ("Asia/Singapore",),
    "AE": ("Asia/Dubai",),
    "QA": ("Asia/Qatar",),
    "SA": ("Asia/Riyadh",),
    "KW": ("Asia/Kuwait",),
}


def check_registration(*, country_code: str, time_zone: str, topics: list[str], skills: list[str],
                       known_skills: set[str], consent: bool) -> list[str]:
    problems = []
    if not consent:
        problems.append("consent_required")
    zones = COUNTRY_ZONES.get(country_code)
    if zones is None:
        problems.append("country_not_listed")
    elif time_zone not in zones:
        problems.append("time_zone_not_in_country")
    if any(topic not in TOPICS for topic in topics):
        problems.append("unknown_topic")
    if any(skill not in known_skills for skill in skills):
        problems.append("unknown_skill")
    return problems


def local_time(moment: datetime, time_zone: str) -> tuple[str, str, str]:
    """FR-DSP-002: the wall-clock date, time and UTC offset of a moment in a time zone, e.g.
    18:00 in Sri Lanka on 15 July is ('2026-07-15', '08:30', '-04:00') in Toronto."""
    local = moment.astimezone(ZoneInfo(time_zone))
    offset = local.strftime("%z")
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M"), f"{offset[:3]}:{offset[3:]}"


def contribution_status() -> tuple[bool, str | None]:
    """FR-DSP-006, BR-147: whether an overseas supporter may contribute, and why not."""
    if FOREIGN_CONTRIBUTIONS_ENABLED:
        return True, None
    return False, "foreign_contributions_disabled"


# FP-03 [ASSUMPTION]: aggregate counts below this are shown as "fewer than 5" so a small group
# abroad cannot be singled out.
SMALL_NUMBER = 5


def hide_small(count: int) -> int | None:
    return None if count < SMALL_NUMBER else count
