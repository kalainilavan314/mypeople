"""Feature flags for v1.1 modules (BRD FR-ARCH-011, §20.2, D34) as plain functions.

Each v1.1 module stays off in production until a Tier 5 records the phase
gate it belongs to, with the approval behind it, and then turns it on. A
module that is off is unavailable to members: its member endpoints answer
404 as if absent. Outside production the flags are not enforced, so
development and tests see every module.
"""

from dataclasses import dataclass
from typing import Literal

CONFIGURE = "system.configure"  # PRM-26

Gate = Literal["G0", "G1", "G2", "G3"]


@dataclass(frozen=True)
class Feature:
    key: str
    name_en: str
    phase: int  # §20.2: it goes live at the gate that closes its phase

    @property
    def gate(self) -> Gate:
        return f"G{self.phase}"  # type: ignore[return-value]


# The v1.1 modules built so far. A new v1.1 module adds its key here and gates its routes.
FEATURES: dict[str, Feature] = {
    feature.key: feature
    for feature in (
        Feature("identity_appeals", "Identity verification appeals (FR-IDV-013)", 1),
        Feature("duplicate_investigations", "Duplicate account investigations (FR-IDV-010)", 1),
        Feature("election_mode", "Election information mode (FR-ELX, subject to legal approval)", 2),
        Feature("households", "My Household (FR-HH-001, voluntary household module)", 2),
        Feature("community_finance", "Community Finance via Bank Transfer Slips (M1.4, FR-FUND)", 1),
        Feature("community_issues", "My Area, issue reporting and case escalation (FR-RPT, FR-WEB-014 to 029)", 2),
        Feature("volunteering", "Volunteer skills, opportunities and assignments (FR-VOL-001 to 008)", 2),
        Feature("ideas_surveys", "Community ideas and surveys (FR-IDEA-001 to 004, FR-SRV-001 to 006)", 2),
        Feature("development_proposals", "Our Development Ideas: development proposals (FR-DEV-001 to 008)", 2),
        Feature("learning", "Learning and courses (FR-LRN-001 to 004)", 2),
        Feature("invitations", "Invite a member and My referrals (FR-REF-001 to 006)", 2),
        Feature("promises", "Promise Tracker (FR-PRM-001 to 010)", 2),
        Feature("scorecards", "Public accountability scorecard (FR-ACS-001 to 008)", 2),
        Feature("community_support", "Community Support, confidential assistance cases (FR-AST-001 to 013)", 2),
    )
}


def check_gate(feature: Feature, gate: str) -> str | None:
    return None if gate == feature.gate else f"gate_must_be:{feature.gate}"


def check_enable(gate_recorded: bool) -> str | None:
    return None if gate_recorded else "gate_not_recorded"
