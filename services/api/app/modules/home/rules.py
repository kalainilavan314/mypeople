"""Home rules (BRD H01, H02, H04; FR-HOME-001 to 008, 012, 013, BR-014, BR-025, BR-026, BR-048).

Home shows the active layout (H01) only when identity is Verified and
membership Active; everyone else sees the awaiting-review layout (H02)
with their verification status, and every feature they cannot use yet is
shown locked with a plain reason and a next step, never silently failing
(BR-026). Exactly one "Your next step" is chosen (BR-025).
"""

from datetime import timedelta
from typing import Literal

NextStep = Literal["correct_identity", "submit_identity", "event_soon", "confirm_recovery_number", "complete_profile"]

# FR-HOME-003 [ASSUMPTION]: action-needed items first, then an event within 48 hours the member
# is going to, then completing the profile. Case updates and learning join when those modules exist.
NEXT_STEP_ORDER: tuple[NextStep, ...] = (
    "correct_identity",
    "submit_identity",
    "event_soon",
    "confirm_recovery_number",
    "complete_profile",
)
EVENT_SOON = timedelta(hours=48)

# FR-HOME-004: exactly these four, none duplicating a bottom tab.
QUICK_ACTIONS = ("report_issue", "volunteer", "my_area", "community")

# FR-HOME-012, 013: the eight services in this order. The party fund follows ideas, surveys and
# learning and is never styled more prominently (BR-048).
HUB_SERVICES = (
    "ideas",
    "surveys",
    "learning",
    "party_fund",
    "invite",
    "volunteering",
    "local_reports",
    "area_projects",
)

# Services whose routes sit behind a v1.1 module switch (FR-ARCH-011). While the switch is off the
# routes answer 404, so Home must show the service as not open yet instead of opening a page that
# cannot load (the party fund's page was empty on production on 12 November 2026).
GATED_BY_MODULE = {"party_fund": "community_finance"}

# FR-HOME-007 [ASSUMPTION, policy for sponsor confirmation]: what a member who is not yet
# Verified and Active may use. Reading, reporting a local issue and events stay open to
# everyone; taking part in decisions, volunteering, inviting and contributing wait for an
# Active membership. The card itself is open: it explains why it is not official yet.
OPEN_TO_EVERYONE = frozenset(
    {"report_issue", "my_area", "events", "card", "gallery", "learning", "local_reports", "area_projects"}
)


def next_step(candidates: set[str]) -> str | None:
    """The single highest-priority step present, or None when nothing is waiting."""
    return next((step for step in NEXT_STEP_ORDER if step in candidates), None)


def feature_lock(feature: str, *, identity_verified: bool, membership_active: bool) -> tuple[str, str] | None:
    """None when the feature can be used; otherwise (reason, next step) for the padlock (FR-HOME-008)."""
    if feature in OPEN_TO_EVERYONE or (identity_verified and membership_active):
        return None
    if not identity_verified:
        return "identity_not_verified", "view_verification"
    return "membership_not_active", "view_membership"
