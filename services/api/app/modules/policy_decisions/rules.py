"""The controlled Phase 1 decision catalogue from MP-DEC-001.

The proposed defaults are context, not live policy. A decision becomes
effective only when a submitted revision has an approval from every named
owner role. External signatures remain in the referenced controlled record;
this module records their evidence and the staff member who entered it.
"""

from dataclasses import dataclass

CONFIGURE = "system.configure"


@dataclass(frozen=True)
class DecisionDefinition:
    key: str
    workstream: str
    title: str
    question: str
    proposed_default: str
    release_effect: str
    required_roles: tuple[str, ...]


DECISIONS: dict[str, DecisionDefinition] = {
    item.key: item
    for item in (
        DecisionDefinition(
            "FIN-01",
            "Community finance",
            "Internal review threshold",
            "At what contribution amount is enhanced internal review required?",
            "LKR 100,000 is a proposed internal review trigger only.",
            "Finance intake must not apply an enhanced-review threshold until approved.",
            ("treasurer", "compliance"),
        ),
        DecisionDefinition(
            "FIN-02",
            "Community finance",
            "Statutory and FIU reporting duties",
            "Which statutory reporting duties and thresholds apply to Party Fund contributions?",
            "Not configured. A bank reporting threshold is not treated as a Party obligation.",
            "Live finance intake remains blocked until the legal obligation is recorded.",
            ("legal", "compliance"),
        ),
        DecisionDefinition(
            "FIN-03",
            "Community finance",
            "Evidence and audit retention",
            "How long must slips, reconciliation evidence and finance audit records be retained?",
            "Proposed retention is not authoritative; legal and accounting holds take precedence.",
            "Automated deletion must remain disabled until the approved schedule is recorded.",
            ("dpo", "treasurer", "legal"),
        ),
        DecisionDefinition(
            "FIN-04",
            "Community finance",
            "Card merchant use case",
            "May domestic or international card contributions be accepted through the selected provider?",
            "Domestic and international card checkout are both off.",
            "Card and recurring payment flags remain off until provider and legal approval.",
            ("treasurer", "payment_provider", "legal"),
        ),
        DecisionDefinition(
            "FIN-05",
            "Community finance",
            "Donor source and currency eligibility",
            "Which donor sources and currencies are permitted, restricted or subject to review?",
            "No blanket foreign-source acceptance; LKR is the domestic pilot currency.",
            "Finance intake must enforce the approved eligibility rules before live use.",
            ("legal", "compliance", "finance"),
        ),
        DecisionDefinition(
            "STF-01",
            "Staff operations",
            "Offline attendance replay window",
            "How long may an offline attendance scan remain eligible for synchronization?",
            "72 hours is proposed; later scans route to manual review.",
            "Offline attendance stays unavailable until operations and security approve the window.",
            ("operations", "security"),
        ),
        DecisionDefinition(
            "GOV-01",
            "Governance",
            "Small-cell publication threshold",
            "What minimum group size and differencing controls apply to aggregate reporting?",
            "A minimum group size of 10 is proposed with secondary suppression.",
            "Small-area analytics and exports remain disabled until the privacy rule is approved.",
            ("dpo", "analytics_owner"),
        ),
        DecisionDefinition(
            "GOV-02",
            "Governance",
            "Election and assisted-verification policy",
            "Which election restrictions and assisted-verification workflows are authorised?",
            "No assumed silence period; assisted verification uses only an approved workflow.",
            "Election restrictions and assisted verification remain disabled without approval.",
            ("product_owner", "legal", "dpo"),
        ),
        DecisionDefinition(
            "CARD-01",
            "Member card and security",
            "Native wallet and passkey release",
            "Which wallet-pass and passkey capabilities are approved after platform testing?",
            "The in-app card and existing MFA remain the pilot fallback.",
            "Wallet passes and passkeys remain unavailable until mobile and security approval.",
            ("mobile", "security"),
        ),
    )
}

# Bank-transfer finance does not require FIN-04 (card acquiring), but it does
# require the policy needed to receive, retain, assess and reconcile funds.
FEATURE_POLICY_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "community_finance": ("FIN-01", "FIN-02", "FIN-03", "FIN-05"),
}


def definition(key: str) -> DecisionDefinition | None:
    return DECISIONS.get(key)


def required_for_feature(feature_key: str) -> tuple[str, ...]:
    return FEATURE_POLICY_REQUIREMENTS.get(feature_key, ())
