"""Staff broadcast rules (BRD GAP-05; FR-ADM-007, FR-MSG-007, BR-083, BR-145) as plain functions.

A holder of notifications.send writes a bilingual announcement for an area
inside their own scope, previews who it reaches, and schedules or sends it.
Anything wider than a district needs a second person's approval
(FR-ADM-007). No message may carry an ID number (BR-145).
"""

import re
from typing import Literal

from app.core.permissions import TIER_RANK, Tier

SEND = "notifications.send"  # PRM-21

BroadcastTopic = Literal["announcements", "emergency"]
Action = Literal["edit", "submit", "approve", "cancel"]

# "Approval required above district scope."
APPROVAL_LEVELS = frozenset({"province", "platform"})
# [ASSUMPTION] Approval comes from a regional coordinator or above (Tier 4 or 5) with
# notifications.send over the area, who is not the person who submitted it.
MIN_APPROVER_RANK = TIER_RANK["4"]

TRANSITIONS: dict[Action, frozenset[str]] = {
    "edit": frozenset({"draft"}),
    "submit": frozenset({"draft"}),
    "approve": frozenset({"pending_approval"}),
    "cancel": frozenset({"draft", "pending_approval", "scheduled"}),
}

# A Sri Lankan NIC (12 digits, or 9 digits and V or X) anywhere in the text.
_ID_NUMBER = re.compile(r"(?<![0-9])(?:[0-9]{12}|[0-9]{9}[VvXx])(?![0-9A-Za-z])")


def check_transition(action: Action, state: str) -> str | None:
    return None if state in TRANSITIONS[action] else f"not_allowed_from:{state}"


def check_content(*texts: str) -> list[str]:
    """FR-MSG-007: sending is blocked for a message containing an ID number."""
    return ["contains_id_number"] if any(_ID_NUMBER.search(text) for text in texts) else []


def needs_approval(area_level: str) -> bool:
    return area_level in APPROVAL_LEVELS


def check_approver(approver_id: object, submitted_by: object, approver_tier: Tier | None) -> str | None:
    if approver_id == submitted_by:
        return "own_submission"
    if approver_tier is None or TIER_RANK[approver_tier] < MIN_APPROVER_RANK:
        return "approver_tier_too_low"
    return None
