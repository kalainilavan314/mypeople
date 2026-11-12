"""Development proposal rules (BRD FR-DEV-001 to 008, BR-109, BR-110) as plain functions.

A proposal is moderated before publication (content.moderate). After that each stage is recorded
by the tier that holds its authority: review notes and "not taken forward" by dev.review (Tier 2A
and above), approval for planning, funding identified and implementation by dev.approve_planning
(Tier 3A and above). Popularity never moves a proposal: there is no support count on proposals.
Approval for planning never commits funds (BR-109).
"""

from typing import Literal

Category = Literal[
    "roads_transport", "agriculture", "fisheries", "employment", "education", "drinking_water", "healthcare",
    "environment", "waste_management", "tourism_enterprise", "digital_literacy", "youth_skills", "other",
]
CATEGORIES: tuple[Category, ...] = (
    "roads_transport", "agriculture", "fisheries", "employment", "education", "drinking_water", "healthcare",
    "environment", "waste_management", "tourism_enterprise", "digital_literacy", "youth_skills", "other",
)
Stage = Literal[
    "pending_moderation", "rejected", "review", "approved_for_planning", "funding_identified", "implementation",
    "not_taken_forward", "withdrawn",
]
PUBLISHED_STAGES = ("review", "approved_for_planning", "funding_identified", "implementation", "not_taken_forward")

MODERATE = "content.moderate"  # PRM-20
REVIEW = "dev.review"  # PRM-38
APPROVE = "dev.approve_planning"  # PRM-39
STAFF_PERMISSIONS = (MODERATE, REVIEW, APPROVE)
SMALL_GROUP = 10

# (from, to) -> the permission that records the move. Moves not listed are refused.
MOVES: dict[tuple[str, str], str] = {
    ("pending_moderation", "review"): MODERATE,
    ("pending_moderation", "rejected"): MODERATE,
    ("review", "not_taken_forward"): REVIEW,
    ("review", "approved_for_planning"): APPROVE,
    ("approved_for_planning", "funding_identified"): APPROVE,
    ("approved_for_planning", "not_taken_forward"): APPROVE,
    ("funding_identified", "implementation"): APPROVE,
}
NEEDS_REASON = frozenset({"rejected", "not_taken_forward", "approved_for_planning", "funding_identified"})
AUTHOR_MAY_WITHDRAW = frozenset({"pending_moderation", "rejected", "review"})


def check_move(current: str, target: str, reason: str | None) -> tuple[str | None, str | None]:
    """(problem, permission needed)."""
    permission = MOVES.get((current, target))
    if permission is None:
        return f"not_allowed_from:{current}", None
    if target in NEEDS_REASON and not (reason and reason.strip()):
        return "reason_required", permission
    return None, permission


def needs_table(rows: list[tuple[str, str | None, str, int]]) -> list[tuple[str, str, int | None]]:
    """FR-DEV-008: proposals by area and category from (district, DS division or None, category, count).
    Every district total is shown, as None ("fewer than 10") when under 10. A DS division appears only
    where its own count is 10 or more, and only if what is left of the district figure is 0 or 10 or
    more, so that a small group cannot be found by subtraction either."""
    totals: dict[tuple[str, str], int] = {}
    shown: dict[tuple[str, str], list[tuple[str, int]]] = {}
    for district, ds, category, count in rows:
        totals[(district, category)] = totals.get((district, category), 0) + count
        if ds is not None and count >= SMALL_GROUP:
            shown.setdefault((district, category), []).append((ds, count))
    table: list[tuple[str, str, int | None]] = []
    divisions: list[tuple[str, str, int | None]] = []
    for (district, category), total in sorted(totals.items()):
        table.append((f"district:{district}", category, total if total >= SMALL_GROUP else None))
        cells = shown.get((district, category), [])
        remainder = total - sum(count for _, count in cells)
        if remainder == 0 or remainder >= SMALL_GROUP:
            divisions += [(f"ds:{ds}", category, count) for ds, count in cells]
    return table + sorted(divisions)
