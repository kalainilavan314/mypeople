"""The access rules (BRD §9.5 RB-01 to RB-07, §9.9 RB-12, BR-083, BR-097) as plain functions.

Nothing here touches the database: the service gathers the facts and these
functions decide, which keeps every rule testable on its own. Each refusal
is a short code that the dashboard can explain (BR-089).

How RB-03 ("a person cannot grant a permission they do not hold, or a scope
wider than their own") is applied, pending sponsor confirmation: the new
area must lie inside the administrator's own roles.assign area; the new tier
must rank below theirs (PRM-06: Tier 4 assigns Tier 3 and below); and any
permission the administrator's own tier could hold, they must actually hold
there. Permissions their tier can never hold, such as a GN coordinator's
cases.collect, may still be assigned to the tiers the matrix allows;
otherwise nobody could ever grant them.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.modules.access.permissions import (
    ASSISTANCE_DECISIONS,
    MATRIX,
    POLITICAL_RIGHTS,
    TIER_AREA_LEVEL,
    TIER_RANK,
    AreaLevel,
    Tier,
    grant_for,
)

REVIEW_INTERVAL = timedelta(days=365)  # RB-05: explicit grants are reviewed at least every 12 months


@dataclass(frozen=True)
class Area:
    level: AreaLevel
    code: str | None = None

    @property
    def key(self) -> str:
        """'platform' or e.g. 'district:LK41', as stored in the audit log's area_path."""
        return "platform" if self.level == "platform" else f"{self.level}:{self.code}"


PLATFORM = Area("platform")

# An area and everything above it, from the platform down: (platform,
# province, district, ds, gn) for a GN division.
AreaPath = tuple[Area, ...]


def area_from_key(key: str) -> Area:
    """The reverse of Area.key, for area paths stored as text."""
    if key == "platform":
        return PLATFORM
    level, code = key.split(":", 1)
    return Area(level, code)  # type: ignore[arg-type]


def contains(outer: Area, inner_path: AreaPath) -> bool:
    return outer.level == "platform" or outer in inner_path


def overlaps(first: AreaPath, second: AreaPath) -> bool:
    return first[-1] in second or second[-1] in first


@dataclass(frozen=True)
class Assignment:
    """The part of an assignment the rules need."""

    tier: Tier
    area: Area
    permissions: frozenset[str]


@dataclass(frozen=True)
class AssignmentRequest:
    member_id: uuid.UUID
    tier: Tier
    area: Area
    permissions: frozenset[str]


@dataclass(frozen=True)
class Grantee:
    member_id: uuid.UUID
    identity_verified: bool
    # Their current assignments with the path of each area, for RB-12.
    assignments: tuple[tuple[Assignment, AreaPath], ...]


def holds(assignments: list[Assignment], permission: str, area_path: AreaPath | None = None) -> bool:
    """True if any assignment gives the permission over the area (over any area when area_path is None)."""
    return any(
        permission in assignment.permissions and (area_path is None or contains(assignment.area, area_path))
        for assignment in assignments
    )


def check_assignment(
    *,
    granter_id: uuid.UUID,
    granter_assignments: list[Assignment],
    grantee: Grantee | None,
    request: AssignmentRequest,
    area_path: AreaPath | None,
) -> list[str]:
    """Everything wrong with a proposed assignment; an empty list means it may be saved."""
    if grantee is None:
        return ["unknown_member"]

    problems: list[str] = []
    if request.member_id == granter_id:
        problems.append("self_assignment")  # BR-083: nobody assigns their own tier
    if not grantee.identity_verified:
        problems.append("identity_not_verified")  # BR-097: staff must be identity-verified
    if request.tier == "5":
        problems.append("tier_5_by_bootstrap_only")
    if request.area.level != TIER_AREA_LEVEL[request.tier]:
        problems.append("area_does_not_match_tier")
    if area_path is None:
        problems.append("unknown_area")
    if not request.permissions:
        problems.append("no_permissions")
    for permission in sorted(request.permissions):
        if permission not in MATRIX:
            problems.append(f"unknown_permission:{permission}")
        elif grant_for(permission, request.tier) is None:
            problems.append(f"permission_not_for_tier:{permission}")

    if area_path is not None:
        problems += _check_granter(granter_assignments, request, area_path)
        problems += _check_separation_of_duties(grantee, request, area_path)
    return problems


def _check_granter(granter_assignments: list[Assignment], request: AssignmentRequest, area_path: AreaPath) -> list[str]:
    # RB-03, as described at the top of this module.
    assigners = [a for a in granter_assignments if "roles.assign" in a.permissions and contains(a.area, area_path)]
    if not assigners:
        return ["outside_your_area"]

    granter_tier = max(assigners, key=lambda a: TIER_RANK[a.tier]).tier
    problems = []
    if TIER_RANK[request.tier] >= TIER_RANK[granter_tier]:
        problems.append("tier_not_below_yours")
    for permission in sorted(request.permissions):
        could_hold = grant_for(permission, granter_tier) is not None
        if could_hold and not holds(granter_assignments, permission, area_path):
            problems.append(f"permission_not_held:{permission}")
    return problems


def _check_separation_of_duties(grantee: Grantee, request: AssignmentRequest, area_path: AreaPath) -> list[str]:
    # RB-12: assistance decisions never sit with fundraising or election-roster
    # rights for the same person in an overlapping area.
    nearby = {
        permission
        for assignment, path in grantee.assignments
        if overlaps(path, area_path)
        for permission in assignment.permissions
    }
    combined = nearby | request.permissions
    if combined & ASSISTANCE_DECISIONS and combined & POLITICAL_RIGHTS:
        return ["separation_of_duties"]
    return []


def check_revocation(
    *,
    granter_id: uuid.UUID,
    granter_assignments: list[Assignment],
    member_id: uuid.UUID,
    assignment: Assignment,
    area_path: AreaPath,
) -> list[str]:
    """Everything that stops this administrator revoking this assignment."""
    if member_id == granter_id:
        return ["own_assignment"]
    if assignment.tier == "5":
        return ["tier_5_by_bootstrap_only"]
    assigners = [a for a in granter_assignments if "roles.assign" in a.permissions and contains(a.area, area_path)]
    if not assigners:
        return ["outside_your_area"]
    if TIER_RANK[assignment.tier] >= max(TIER_RANK[a.tier] for a in assigners):
        return ["tier_not_below_yours"]
    return []


def review_due(tier: Tier, permissions: frozenset[str], granted_at: datetime) -> datetime | None:
    """RB-05: an assignment with any explicit-only permission must be reviewed within 12 months."""
    if any(grant_for(permission, tier) == "explicit" for permission in permissions):
        return granted_at + REVIEW_INTERVAL
    return None
