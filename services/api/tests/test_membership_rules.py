"""Membership state rules as plain functions (FR-ADM-003, BR-015). No database needed."""

import pytest

from app.modules.membership import rules


@pytest.mark.parametrize(
    ("action", "current", "allowed"),
    [
        ("activate", "pending", True),
        ("activate", "inactive", True),
        ("activate", "active", False),
        ("activate", "suspended", False),  # a suspension ends by reinstatement
        ("suspend", "active", True),
        ("suspend", "pending", False),
        ("reinstate", "suspended", True),
        ("reinstate", "active", False),
        ("inactivate", "pending", True),
        ("inactivate", "active", True),
        ("inactivate", "suspended", True),
        ("inactivate", "inactive", False),
    ],
)
def test_each_action_starts_from_its_own_states(action, current, allowed):
    reason = rules.REASONS[action][0]
    problems = rules.check_change(action, current, identity_verified=True, reason_code=reason, note=None)
    assert (problems == []) is allowed
    if not allowed:
        assert problems == [f"not_allowed_from:{current}"]


def test_only_a_verified_identity_can_be_activated():
    assert rules.check_change("activate", "pending", False, "identity_verified", None) == ["identity_not_verified"]
    # Suspension and inactivation do not depend on identity.
    assert rules.check_change("inactivate", "pending", False, "member_request", None) == []


def test_every_change_needs_a_reason_of_its_own_kind():  # BR-015
    assert rules.check_change("suspend", "active", True, "", None) == ["reason_required"]
    assert rules.check_change("suspend", "active", True, "deceased", None) == ["reason_required"]
    assert rules.check_change("suspend", "active", True, "other", None) == ["note_required"]
    assert rules.check_change("suspend", "active", True, "other", "  ") == ["note_required"]
    assert rules.check_change("suspend", "active", True, "other", "Reported by the district office") == []


def test_where_each_action_leads():
    assert [rules.state_after(a) for a in ("activate", "suspend", "reinstate", "inactivate")] == [
        "active",
        "suspended",
        "active",
        "inactive",
    ]
