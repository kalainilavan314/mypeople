"""M1.6 consent semantics. Notice acknowledgement is not optional consent."""

from typing import Literal

PolicyType = Literal["privacy_notice", "terms", "optional_consent", "election_rule"]
Action = Literal["acknowledged", "granted", "withdrawn"]


def check_policy_action(policy_type: PolicyType, action: Action) -> str | None:
    if policy_type == "privacy_notice" and action != "acknowledged":
        return "notice_is_acknowledgement"
    if policy_type == "optional_consent" and action not in ("granted", "withdrawn"):
        return "optional_consent_requires_choice"
    if policy_type in ("terms", "election_rule") and action != "acknowledged":
        return "policy_is_acknowledgement"
    return None
