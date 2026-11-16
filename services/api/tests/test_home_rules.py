"""Home rules, without a database (BRD FR-HOME-003, 004, 007, 008, 012, 013, BR-025, BR-026, BR-048)."""

import pytest

from app.modules.home import rules


def test_exactly_one_next_step_in_the_priority_order():
    assert rules.next_step({"complete_profile", "event_soon", "correct_identity"}) == "correct_identity"
    assert rules.next_step({"complete_profile", "event_soon"}) == "event_soon"
    assert rules.next_step({"complete_profile"}) == "complete_profile"
    assert rules.next_step(set()) is None


def test_four_quick_actions_and_none_duplicates_a_tab():
    assert rules.QUICK_ACTIONS == ("report_issue", "volunteer", "my_area", "community")
    assert not set(rules.QUICK_ACTIONS) & {"home", "events", "card", "gallery", "profile"}


def test_the_party_fund_never_comes_before_civic_participation():
    services = rules.HUB_SERVICES
    assert len(services) == 10 and services[-2:] == ("promises", "support")
    assert services.index("party_fund") > max(services.index(s) for s in ("ideas", "surveys", "learning"))


@pytest.mark.parametrize(
    ("feature", "verified", "active", "expected"),
    [
        # FR-RPT-017, BR-026: reporting a local issue needs a Verified identity and an Active membership.
        ("report_issue", False, False, ("identity_not_verified", "view_verification")),
        ("report_issue", True, False, ("membership_not_active", "view_membership")),
        ("my_area", False, False, None),
        ("events", False, False, None),
        ("card", False, False, None),  # open: it explains why it is not official yet
        ("volunteer", False, False, ("identity_not_verified", "view_verification")),
        ("community", True, False, ("membership_not_active", "view_membership")),
        ("party_fund", True, False, ("membership_not_active", "view_membership")),
        ("community", True, True, None),
    ],
)
def test_locked_features_say_why_and_what_to_do_next(feature, verified, active, expected):
    assert rules.feature_lock(feature, identity_verified=verified, membership_active=active) == expected
