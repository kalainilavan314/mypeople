"""Volunteering rules (BRD v1.1 FR-VOL-001 to 008, BR-040 to 043) as plain functions.

A member offers to help; a coordinator with volunteers.manage over the opportunity's area
confirms or declines the offer. Coordinators never see a volunteer's phone number and nobody is
ranked: lists are ordered by name or time, never by how much someone has done.
"""

from datetime import datetime
from typing import Literal

PERMISSION = "volunteers.manage"  # PRM-23
CONSENT_VERSION = "vol-skills-2026-11"  # FR-VOL-003: what the member agreed to share, and with whom

Availability = Literal["weekday_mornings", "weekday_afternoons", "weekday_evenings", "weekends", "public_holidays"]
TravelArea = Literal["my_gn", "my_ds"]
OpportunityState = Literal["draft", "open", "closed", "cancelled"]
OfferState = Literal["offered", "confirmed", "declined", "withdrawn", "cancelled"]

# Which opportunity states a coordinator may move to from each.
OPPORTUNITY_MOVES: dict[str, frozenset[str]] = {
    "draft": frozenset({"open", "cancelled"}),
    "open": frozenset({"closed", "cancelled"}),
    "closed": frozenset({"open", "cancelled"}),
    "cancelled": frozenset(),
}


def check_profile(*, consent: bool, skills: list[str], known_skills: set[str]) -> list[str]:
    problems = []
    if not consent:
        problems.append("consent_required")
    if not skills:
        problems.append("skills_required")
    if any(skill not in known_skills for skill in skills):
        problems.append("unknown_skill")
    return problems


def check_offer(*, identity_verified: bool, membership_active: bool, state: str, starts_at: datetime, now: datetime,
                existing_state: str | None) -> str | None:
    if not identity_verified:
        return "identity_not_verified"
    if not membership_active:
        return "membership_not_active"
    if state != "open" or starts_at <= now:
        return "opportunity_not_open"
    if existing_state in ("offered", "confirmed"):
        return "already_offered"
    return None


def check_opportunity_times(starts_at: datetime, ends_at: datetime, now: datetime) -> list[str]:
    problems = []
    if ends_at <= starts_at:
        problems.append("ends_before_start")
    if starts_at <= now:
        problems.append("starts_in_past")
    return problems


def check_move(current: str, target: str, reason: str | None) -> str | None:
    if target not in OPPORTUNITY_MOVES.get(current, frozenset()):
        return f"not_allowed_from:{current}"
    if target == "cancelled" and not (reason and reason.strip()):
        return "reason_required"
    return None


def check_decision(*, offer_state: str, confirm: bool, confirmed: int, places: int, reason: str | None,
                   meeting_point_en: str | None, meeting_point_ta: str | None) -> str | None:
    if offer_state != "offered":
        return "not_awaiting_decision"
    if confirm:
        if confirmed >= places:
            return "places_filled"
        if not (meeting_point_en and meeting_point_en.strip() and meeting_point_ta and meeting_point_ta.strip()):
            return "meeting_point_required"
        return None
    return None if reason and reason.strip() else "reason_required"


def visible_to(opportunity_area_key: str, member_area_keys: list[str]) -> bool:
    """An opportunity set for a GN, DS division or district reaches the members inside it."""
    return opportunity_area_key == "platform" or opportunity_area_key in member_area_keys
