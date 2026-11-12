"""Feature flags for v1.1 modules through the API (BRD FR-ARCH-011, D34, PRM-26)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app
from app.modules.features.rules import FEATURES


@pytest.fixture
def enforced(database_settings, db_session) -> TestClient:
    """The API as production runs it: modules stay off until their gate is recorded and they are turned on."""
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def appeals_lead(make_reviewer, area):
    return make_reviewer(area.province, permissions=("idv.appeal.decide",), tier="4", level="province")


def test_outside_production_every_module_is_on(db_client):
    assert db_client.get("/v1/features").json() == {"enabled": list(FEATURES)}


def test_a_module_without_a_recorded_gate_is_unavailable(enforced, auth, appeals_lead, member_in, area):
    member = member_in(area)

    assert enforced.get("/v1/features").json() == {"enabled": []}
    for path, person in (
        ("/v1/identity/appeals", appeals_lead),
        ("/v1/identity/duplicates", appeals_lead),
        ("/v1/election/current", member),
    ):
        response = enforced.get(path, headers=auth(person))
        assert (response.status_code, response.json()) == (404, {"detail": "feature_unavailable"}), path
    appeal = enforced.post("/v1/identity/me/review/appeal", json={"statement": "Please look again"}, headers=auth(member))
    assert (appeal.status_code, appeal.json()) == (404, {"detail": "feature_unavailable"})


def test_tier_5_records_the_gate_then_turns_the_module_on_and_off(enforced, db_session, auth, super_admin, appeals_lead):
    admin = auth(super_admin)
    reason = {"reason": "Phase 1 gate passed"}

    too_early = enforced.post("/v1/features/identity_appeals/enable", json=reason, headers=admin)
    wrong_gate = enforced.post(
        "/v1/features/identity_appeals/gate", json={"gate": "G0", "approvalRef": "SC-2026-14", **reason}, headers=admin
    )
    gate = enforced.post(
        "/v1/features/identity_appeals/gate", json={"gate": "G1", "approvalRef": "SC-2026-14", **reason}, headers=admin
    )
    enabled = enforced.post("/v1/features/identity_appeals/enable", json=reason, headers=admin)
    listed = enforced.get("/v1/features").json()
    open_now = enforced.get("/v1/identity/appeals", headers=auth(appeals_lead))
    disabled = enforced.post("/v1/features/identity_appeals/disable", json={"reason": "Pilot paused"}, headers=admin)
    closed_again = enforced.get("/v1/identity/appeals", headers=auth(appeals_lead))
    unknown = enforced.post("/v1/features/no_such_module/enable", json=reason, headers=admin)

    assert (too_early.status_code, too_early.json()) == (409, {"detail": "gate_not_recorded"})
    assert (wrong_gate.status_code, wrong_gate.json()) == (409, {"detail": "gate_must_be:G1"})
    assert gate.json()["gate"] == "G1" and gate.json()["approvalRef"] == "SC-2026-14" and gate.json()["enabled"] is False
    assert enabled.json()["enabled"] is True
    assert listed == {"enabled": ["identity_appeals"]}
    assert open_now.status_code == 200
    assert disabled.json()["enabled"] is False and closed_again.status_code == 404
    assert unknown.status_code == 404

    history = db_session.execute(
        text("SELECT action, gate, reason FROM ops.feature_flag_change WHERE key = 'identity_appeals' ORDER BY id")
    ).all()
    assert [tuple(row) for row in history] == [
        ("gate_recorded", "G1", "Phase 1 gate passed"),
        ("enabled", "G1", "Phase 1 gate passed"),
        ("disabled", "G1", "Pilot paused"),
    ]
    audited = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_type = 'feature_flag' ORDER BY id")
    ).all()
    assert [row.action for row in audited] == ["features.gate_recorded", "features.enabled", "features.disabled"]
    assert all("reason" not in row.details for row in audited)  # the reason stays in the flag history


def test_only_system_configure_holders_see_or_change_flags(enforced, auth, appeals_lead):
    registry = enforced.get("/v1/features/registry", headers=auth(appeals_lead))
    change = enforced.post("/v1/features/identity_appeals/disable", json={"reason": "not now"}, headers=auth(appeals_lead))

    assert (registry.status_code, change.status_code) == (403, 403)


def test_the_registry_lists_every_module_with_the_gate_it_needs(enforced, auth, super_admin):
    registry = enforced.get("/v1/features/registry", headers=auth(super_admin)).json()

    assert {flag["key"]: flag["requiredGate"] for flag in registry} == {
        "identity_appeals": "G1",
        "duplicate_investigations": "G1",
        "community_finance": "G1",
        "community_issues": "G2",
        "election_mode": "G2",
        "households": "G2",
    }
