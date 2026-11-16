from app.modules.privacy.governance_rules import check_policy_action


def test_notice_is_not_mislabelled_as_consent() -> None:
    assert check_policy_action("privacy_notice", "acknowledged") is None
    assert check_policy_action("privacy_notice", "granted") == "notice_is_acknowledgement"
    assert check_policy_action("optional_consent", "withdrawn") is None
    assert check_policy_action("optional_consent", "acknowledged") == "optional_consent_requires_choice"
    assert check_policy_action("terms", "withdrawn") == "policy_is_acknowledgement"
    assert check_policy_action("election_rule", "granted") == "policy_is_acknowledgement"
