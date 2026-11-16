"""The server command that opens v1.1 modules in one step (owner's decision, 16 November 2026)."""

import pytest
from sqlalchemy import text

from app.modules.access import service as access
from app.modules.access.service import AccessRefused
from app.modules.features import open_modules
from app.modules.features import service as features
from app.modules.features.rules import FEATURES
from app.modules.policy_decisions import service as policy_decisions

APPROVAL = "Owner decision, 16 Nov 2026"
REASON = f"Opened by server command on the owner's decision: {APPROVAL}"


@pytest.fixture
def all_off(db_session):
    # Rolled back with the test's transaction.
    db_session.execute(text("UPDATE ops.feature_flag SET enabled = false, gate = NULL, approval_ref = NULL"))


def flags(db_session):
    rows = db_session.execute(text("SELECT key, enabled, gate, approval_ref FROM ops.feature_flag")).mappings()
    return {row["key"]: row for row in rows}


def test_every_module_opens_with_its_own_gate_and_the_party_fund_waits_for_its_decisions(db_session, super_admin, all_off):
    staff = access.load_staff(db_session, super_admin.id)

    results = {r.key: r.outcome for r in features.open_modules(db_session, staff, list(FEATURES), APPROVAL, REASON)}
    stored = flags(db_session)

    finance = results.pop("community_finance")
    if policy_decisions.missing_feature_decisions(db_session, "community_finance"):
        assert finance.startswith("refused:policy_decisions_required:")
    assert set(results.values()) == {"on"}
    for key in results:
        assert (stored[key]["enabled"], stored[key]["gate"], stored[key]["approval_ref"]) == (True, FEATURES[key].gate, APPROVAL)
    assert stored["community_finance"]["enabled"] == (finance == "on")
    actions = db_session.execute(
        text("SELECT action, count(*) FROM ops.audit_log WHERE actor_id = :a AND action LIKE 'features.%' GROUP BY action"),
        {"a": super_admin.id},
    ).all()
    assert dict(actions) == {"features.gate_recorded": len(FEATURES), "features.enabled": len(FEATURES) - (finance != "on")}


def test_a_module_already_on_is_left_as_it_is(db_session, super_admin, all_off):
    staff = access.load_staff(db_session, super_admin.id)
    features.open_modules(db_session, staff, ["learning"], APPROVAL, REASON)

    again = features.open_modules(db_session, staff, ["learning", "promises"], APPROVAL, REASON)

    assert [(r.key, r.outcome) for r in again] == [("learning", "already_on"), ("promises", "on")]


def test_only_a_holder_of_system_configure_may_open_modules(db_session, create_member, assign, super_admin):
    clerk = create_member(verified=True)
    assign(clerk, "3A", "district", "LK41", ["content.moderate"], granted_by=super_admin)

    with pytest.raises(AccessRefused):
        features.open_modules(db_session, access.load_staff(db_session, clerk.id), ["learning"], APPROVAL, REASON)


def test_the_command_needs_an_approval_reference_and_known_module_keys(capsys):
    assert open_modules.main([]) == 2
    assert open_modules.main(["ok"]) == 2
    assert open_modules.main([APPROVAL, "no_such_module"]) == 2
    assert "no_such_module" in capsys.readouterr().err
