"""The AI model registry and monitoring (D21, PRM-30, PRM-31, NFR-AI-01, NFR-AI-05, 15B.5)."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text


@pytest.fixture
def governance_lead(create_member, assign, super_admin):
    person = create_member(verified=True)
    assign(person, "5", "platform", None, ["ai.model.approve", "ai.model.monitor"], granted_by=super_admin)
    return person


@pytest.fixture
def monitor(create_member, assign, super_admin):
    person = create_member(verified=True)
    assign(person, "5", "platform", None, ["ai.model.monitor"], granted_by=super_admin)
    return person


def model_body(**overrides):
    return {
        "task": "assistant", "name": "Claude Opus", "provider": "Anthropic (hosted API)", "providerCode": "anthropic",
        "modelRef": "claude-opus-5-5", "version": "5.5", "licence": "Anthropic commercial terms of service",
        "licenceCommercialUse": True, "noTrainingTerms": True, "dataLocation": "United States (provider-hosted)",
        "trainingDataSummary": "Provider's general training data; no TMK member data.", **overrides,
    }


def passing_evaluation(**overrides):
    return {"evaluatedOn": date.today().isoformat(), "questions": 200, "groundedPct": "96.5", "unsupportedPct": "1.0",
            "persuasionFailures": 0, "fabricationFailures": 0, "summary": "Monthly Tamil and English question set.",
            "reportRef": "EVAL-2026-11", **overrides}


def make_ready(client, auth, lead, db_session, **overrides):
    model = client.post("/v1/ai-models", json=model_body(**overrides), headers=auth(lead))
    assert model.status_code == 201, model.json()
    model_id = model.json()["id"]
    assert client.post(f"/v1/ai-models/{model_id}/evaluations", json=passing_evaluation(), headers=auth(lead)).status_code == 201
    fairness = {"reviewedOn": date.today().isoformat(), "groups": "Jaffna, Vanni, Mannar; Tamil and English",
                "findings": "No meaningful difference between the groups.", "outcome": "passed"}
    assert client.post(f"/v1/ai-models/{model_id}/fairness-reviews", json=fairness, headers=auth(lead)).status_code == 201
    db_session.execute(text("UPDATE ai.model SET shadow_started_at = now() - interval '30 days' WHERE id = :id"), {"id": model_id})
    return model_id


def test_only_the_ai_governance_lead_sees_and_changes_the_registry(db_client, auth, create_member, monitor):
    member = create_member(verified=True, active=True)

    assert db_client.get("/v1/ai-models", headers=auth(member)).status_code == 403
    registry = db_client.get("/v1/ai-models", headers=auth(monitor))
    assert registry.status_code == 200
    # This server has no provider set up: nothing is sent anywhere (OD-42 default).
    assert registry.json()["configured"] == {"provider": "none", "modelRef": None, "registeredModelId": None,
                                             "registeredStatus": None}
    created = db_client.post("/v1/ai-models", json=model_body(version="monitor-1"), headers=auth(monitor))
    assert created.status_code == 201 and created.json()["status"] == "shadow"
    # Making a model live needs ai.model.approve (PRM-30).
    live = db_client.post(f"/v1/ai-models/{created.json()['id']}/go-live", json={"reason": "Ready"}, headers=auth(monitor))
    assert live.status_code == 403


def test_the_assistant_evaluation_is_judged_against_nfr_ai_05(db_client, auth, governance_lead):
    model_id = db_client.post("/v1/ai-models", json=model_body(version="eval-1"), headers=auth(governance_lead)).json()["id"]

    failing = db_client.post(f"/v1/ai-models/{model_id}/evaluations",
                             json=passing_evaluation(groundedPct="93", passed=True), headers=auth(governance_lead))
    missing = db_client.post(f"/v1/ai-models/{model_id}/evaluations",
                             json=passing_evaluation(questions=None), headers=auth(governance_lead))
    future = db_client.post(f"/v1/ai-models/{model_id}/evaluations",
                            json=passing_evaluation(evaluatedOn=(date.today() + timedelta(days=2)).isoformat()),
                            headers=auth(governance_lead))

    assert failing.status_code == 201 and failing.json()["passed"] is False  # the stated result is ignored
    assert missing.json()["detail"]["problems"] == ["assistant_results_required"]
    assert future.json()["detail"]["problems"] == ["evaluated_in_future"]
    problems = db_client.post(f"/v1/ai-models/{model_id}/go-live", json={"reason": "Try it"}, headers=auth(governance_lead))
    assert problems.status_code == 422
    assert problems.json()["detail"]["problems"] == ["evaluation_failed", "fairness_review_missing", "shadow_period_running"]


def test_one_model_is_live_per_task_and_a_rollback_is_immediate(db_client, auth, governance_lead, db_session):
    db_session.execute(text("UPDATE ai.model SET status = 'retired', retired_at = now() WHERE task = 'assistant' AND status = 'live'"))
    first = make_ready(db_client, auth, governance_lead, db_session, version="roll-1")
    second = make_ready(db_client, auth, governance_lead, db_session, version="roll-2")

    assert db_client.post(f"/v1/ai-models/{first}/go-live", json={"reason": "Passed"}, headers=auth(governance_lead)).json()[
        "status"] == "live"
    swapped = db_client.post(f"/v1/ai-models/{second}/go-live", json={"reason": "Newer"}, headers=auth(governance_lead))
    first_after = db_client.get(f"/v1/ai-models/{first}", headers=auth(governance_lead)).json()
    rolled_back = db_client.post(f"/v1/ai-models/{first}/go-live", json={"reason": "Drift on v2"}, headers=auth(governance_lead))

    assert swapped.json()["status"] == "live"
    assert first_after["summary"]["model"]["status"] == "retired"
    assert first_after["summary"]["model"]["statusReason"].startswith("Replaced by")
    assert rolled_back.status_code == 200 and rolled_back.json()["status"] == "live"
    assert db_client.get(f"/v1/ai-models/{second}", headers=auth(governance_lead)).json()["summary"]["model"]["status"] == "retired"
    actions = db_session.scalars(
        text("SELECT action FROM ops.audit_log WHERE target_id = :id ORDER BY id"), {"id": first}
    ).all()
    assert actions[-1] == "ai.model.rolled_back" and "ai.model.live" in actions
    retired = db_client.post(f"/v1/ai-models/{first}/retire", json={"reason": "Withdrawn"}, headers=auth(governance_lead))
    again = db_client.post(f"/v1/ai-models/{first}/retire", json={"reason": "Withdrawn"}, headers=auth(governance_lead))
    assert retired.json()["status"] == "retired" and again.json()["detail"]["problems"] == ["already_retired"]


def test_licence_and_provider_terms_block_going_live(db_client, auth, governance_lead, db_session):
    model_id = make_ready(db_client, auth, governance_lead, db_session, version="terms-1", licenceCommercialUse=False,
                          noTrainingTerms=False)
    refused = db_client.post(f"/v1/ai-models/{model_id}/go-live", json={"reason": "Go live"}, headers=auth(governance_lead))
    assert refused.json()["detail"]["problems"] == ["licence_not_for_commercial_use", "no_training_terms_missing"]
    duplicate = db_client.post("/v1/ai-models", json=model_body(version="terms-1"), headers=auth(governance_lead))
    assert duplicate.json()["detail"]["problems"] == ["already_registered"]


def test_evaluation_history_is_append_only(db_client, auth, governance_lead, db_session):
    model_id = make_ready(db_client, auth, governance_lead, db_session, version="append-1")
    with pytest.raises(Exception, match="append-only"):
        with db_session.begin_nested():
            db_session.execute(text("UPDATE ai.model_evaluation SET passed = false WHERE model_id = :id"), {"id": model_id})
