"""Who may review a staff grant (BRD FR-AUTH-027, NFR-SEC-13, PRM-25) as plain functions.

A reviewer holds audit.view over the grant's area (PRM-25 covers
privileged-access reviews, BRD §9.8) through a tier above the grant's, and
never reviews their own grant. Ranking reviews as revocations are ranked
keeps a coordinator from confirming a peer; Tier 4 grants go to the Super
Administrator, whose own grant is never due (access.rules.review_due).
"""

import uuid
from datetime import datetime

from app.core.permissions import TIER_RANK
from app.modules.access.rules import Assignment, AreaPath, highest_tier, quarter_end

PERMISSION = "audit.view"


def check_review(
    *,
    reviewer_id: uuid.UUID,
    reviewer_assignments: list[Assignment],
    member_id: uuid.UUID,
    assignment: Assignment,
    area_path: AreaPath,
) -> list[str]:
    """Everything that stops this person reviewing this grant; empty means they may."""
    if member_id == reviewer_id:
        return ["own_assignment"]
    if assignment.tier == "5":
        return ["tier_5_by_bootstrap_only"]
    reviewer_tier = highest_tier(reviewer_assignments, PERMISSION, area_path)
    if reviewer_tier is None:
        return ["outside_your_area"]
    if TIER_RANK[assignment.tier] >= TIER_RANK[reviewer_tier]:
        return ["tier_not_below_yours"]
    return []


def is_due(review_due_at: datetime | None, now: datetime) -> bool:
    """Due by the end of this quarter, or already overdue and suspended until someone reviews it.
    A grant confirmed this quarter is next due at the end of the following one, so it is not
    reviewed twice in a quarter (KPI-42 counts each once)."""
    return review_due_at is not None and review_due_at <= quarter_end(now)
