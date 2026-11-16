"""Staff tiers and the permission matrix from BRD v1.1 §9.2, §9.4 and §9.8.

For each permission, MATRIX lists the tiers that may hold it and whether the
tier gets it by default or only by explicit grant (the BRD's "*"). A tier
that is not listed can never hold it ("—" in the BRD). The scope of a
permission is the area of the assignment it is in, and each tier has one
kind of area (TIER_AREA_LEVEL).

Not grantable through staff assignments, and so not listed here:
PRM-01, PRM-32 and PRM-56 (a member's own record), the event-scoped
PRM-17 for members (OD-12), PRM-50 (committee scope), PRM-55 (partner
organisations), and PRM-47 and PRM-57, which the BRD gives platform scope
regardless of tier. They arrive with their own modules.
"""

from typing import Literal

Tier = Literal["1", "2A", "2B", "3A", "3B", "4", "5"]
AreaLevel = Literal["platform", "province", "district", "ds", "gn"]
Grant = Literal["default", "explicit"]

TIERS: tuple[Tier, ...] = ("1", "2A", "2B", "3A", "3B", "4", "5")

# §9.2: 1 GN coordinator, 2A/2B DS division, 3A/3B district, 4 region
# (a province: Northern now, Eastern later), 5 the whole platform.
TIER_AREA_LEVEL: dict[Tier, AreaLevel] = {
    "1": "gn",
    "2A": "ds",
    "2B": "ds",
    "3A": "district",
    "3B": "district",
    "4": "province",
    "5": "platform",
}

# Higher number = more authority. 2A and 2B (and 3A and 3B) are peers.
TIER_RANK: dict[Tier, int] = {"1": 1, "2A": 2, "2B": 2, "3A": 3, "3B": 3, "4": 4, "5": 5}

D: Grant = "default"
E: Grant = "explicit"

MATRIX: dict[str, dict[Tier, Grant]] = {
    # §9.4
    "members.view_profile": {"1": D, "2A": D, "2B": E, "3A": D, "3B": E, "4": D, "5": D},  # PRM-02
    "members.view_identity_evidence": {"3A": E, "4": E, "5": E},  # PRM-03
    "members.verify": {"3A": E, "4": E, "5": E},  # PRM-04
    "members.activate": {"3A": E, "4": E, "5": D},  # PRM-05
    "roles.assign": {"4": E, "5": D},  # PRM-06 (Tier 4: Tier 3 and below)
    "cases.collect": {"1": D, "2B": E},  # PRM-07
    "cases.research": {"2A": D, "2B": E},  # PRM-08
    "cases.decide_district": {"3A": D},  # PRM-09
    "cases.plan_regional": {"4": D},  # PRM-10
    "cases.approve_executive": {"5": D},  # PRM-11
    "cases.implement_and_close": {"3A": E, "3B": E, "4": E, "5": D},  # PRM-12
    "cases.view_reporter_contact": {"1": D, "2A": D, "3A": D},  # PRM-13
    "finance.review": {"3B": E, "4": E, "5": E},  # PRM-14 (Explicit grant only, no Tier 5 default)
    "finance.approve": {"4": E, "5": E},  # PRM-XX (Explicit grant only, independent approver)
    "finance.export": {"3B": E, "4": E, "5": E},  # PRM-XX (Explicit grant only)
    "finance.audit_read": {"4": E, "5": E},  # PRM-XX (Explicit grant only)
    "finance.publish_ledger": {"3B": E, "5": E},  # PRM-15 (Explicit grant only, Tier 5 default removed)
    "events.manage": {"1": E, "2B": D, "3A": D, "3B": D, "4": D, "5": D},  # PRM-16
    "events.checkin_scan": {"1": E, "2B": E, "3A": E, "3B": E},  # PRM-17
    "gallery.publish": {"2B": E, "3B": E},  # PRM-18
    "gallery.takedown": {"3A": D, "3B": E, "5": D},  # PRM-19
    "content.moderate": {"2A": E, "3A": D, "5": D},  # PRM-20
    "notifications.send": {"1": E, "2A": E, "3A": D, "3B": D, "4": D, "5": D},  # PRM-21
    "surveys.manage": {"3B": E, "4": E, "5": D},  # PRM-22
    "volunteers.manage": {"1": E, "2B": D, "3B": D},  # PRM-23
    "analytics.view": {"1": D, "2A": D, "2B": D, "3A": D, "3B": D, "4": D, "5": D},  # PRM-24
    "audit.view": {"4": E, "5": D},  # PRM-25
    "system.configure": {"5": D},  # PRM-26
    # §9.8
    "idv.screening.view": {"3A": E, "4": E, "5": E},  # PRM-27
    "idv.duplicate.investigate": {"4": E, "5": E},  # PRM-28
    "idv.appeal.decide": {"4": E, "5": E},  # PRM-29
    "ai.model.approve": {"5": E},  # PRM-30
    "ai.model.monitor": {"5": E},  # PRM-31
    "household.view_for_case": {"1": E, "2B": E, "3A": E, "3B": E},  # PRM-33
    "assistance.intake": {"1": E, "2B": E, "3B": E},  # PRM-34
    "assistance.casework": {"1": E, "2B": E, "3A": E, "3B": E},  # PRM-35
    "assistance.decide": {"3A": E, "4": E},  # PRM-36
    "assistance.programme.manage": {"4": E, "5": D},  # PRM-37
    "dev.review": {"2A": D, "3A": D, "4": D, "5": D},  # PRM-38
    "dev.approve_planning": {"3A": D, "4": D, "5": D},  # PRM-39
    "promise.edit": {"4": E, "5": E},  # PRM-40
    "promise.publish": {"5": D},  # PRM-41
    "scorecard.publish": {"4": E, "5": D},  # PRM-42
    "townhall.produce": {"3B": E, "4": E, "5": E},  # PRM-43
    "townhall.moderate": {"2B": E, "3B": E, "4": E, "5": E},  # PRM-44
    "pb.manage": {"4": E, "5": D},  # PRM-45
    "pb.certify": {"4": E, "5": D},  # PRM-46
    "election.mode.manage": {"5": D},  # PRM-48
    "election.roster.manage": {"1": E, "2B": E, "3B": E},  # PRM-49
    "field.collect": {"1": D, "2B": E},  # PRM-51
    "certificate.issue_revoke": {"3B": E, "5": D},  # PRM-52
    "disaster.relay": {"3B": E, "5": E},  # PRM-53
    "relief.logistics": {"2B": E, "3B": E},  # PRM-54
    # Not in the BRD matrix [ASSUMPTION]: FR-PROF-018 and 019 route data-subject requests to
    # the DPO without naming a permission; the DPO's account holds it as an explicit Tier 5 grant.
    "privacy.requests.handle": {"5": E},
    # Community Reporting operational work queue (D01):
    "reports.view": {"1": D, "2A": D, "2B": E, "3A": D, "3B": E, "4": D, "5": D},
}

# RB-12, FR-AST-013 [ASSUMPTION; OD-32]: no person may hold assistance decision
# rights together with fundraising or election-roster rights, in any area, so
# humanitarian help can never be tied to political support. "Campaign" rights
# are not defined in the BRD yet and are not listed.
ASSISTANCE_DECISIONS = frozenset({"assistance.decide"})
POLITICAL_RIGHTS = frozenset({
    "finance.review",
    "finance.approve",
    "finance.export",
    "finance.audit_read",
    "finance.publish_ledger",
    "election.roster.manage",
})


def grant_for(permission: str, tier: Tier) -> Grant | None:
    """How a tier may hold a permission, or None if it never may (or the permission is unknown)."""
    return MATRIX.get(permission, {}).get(tier)


def default_permissions(tier: Tier) -> list[str]:
    """What W09 pre-selects for a tier. The administrator still confirms each one (BR-083)."""
    return sorted(permission for permission, tiers in MATRIX.items() if tiers.get(tier) == "default")
