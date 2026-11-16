"""P3 finance production-readiness controls and fail-closed intake tests."""

import base64
import uuid
from datetime import date

from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import text

from app.core.config import Settings
from app.db.session import get_db
from app.main import create_app


def _settings(database_settings: Settings, *, enforced: bool = False) -> Settings:
    key = base64.b64encode(b"01234567890123456789012345678901").decode("ascii")
    return database_settings.model_copy(
        update={
            "finance_intake_enabled": True,
            "finance_bank_name": "Bank of Ceylon",
            "finance_account_name": "My People Party Fund",
            "finance_account_number": "0001234567",
            "finance_branch_name": "Colombo Central",
            "finance_transfer_instructions_en": "Use the contribution reference in the transfer.",
            "finance_transfer_instructions_ta": "பரிமாற்றத்தில் பங்களிப்பு குறிப்பைப் பயன்படுத்தவும்.",
            "finance_encryption_key": SecretStr(key),
            "finance_malware_scanner": "development",
            "enforce_feature_flags": enforced,
        }
    )


def _client(settings: Settings, db_session) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


def _approved_revision(db_session, actor_id, key: str, revision: int = 1) -> uuid.UUID:
    return db_session.execute(
        text(
            """
            INSERT INTO ops.policy_decision_revision
                (decision_key, revision, status, decision_text, rationale, effective_from,
                 created_by, updated_by, submitted_by, submitted_at, resolved_at)
            VALUES
                (:key, :revision, 'approved', :decision_text, :rationale, :effective_from,
                 :actor, :actor, :actor, clock_timestamp(), clock_timestamp())
            RETURNING id
            """
        ),
        {
            "key": key,
            "revision": revision,
            "decision_text": f"Approved production decision for {key}",
            "rationale": f"Documented production rationale for {key}",
            "effective_from": date.today(),
            "actor": actor_id,
        },
    ).scalar_one()


def _record_controls(
    client: TestClient,
    headers: dict[str, str],
    revisions: dict[str, uuid.UUID],
    *,
    threshold_minor: int = 10_000_000,
    reporting_mode: str = "not_applicable",
    third_party_mode: str = "manual_review",
) -> None:
    controls = (
        ("enhanced_review_threshold_minor", "FIN-01", threshold_minor, None),
        ("statutory_reporting_mode", "FIN-02", None, reporting_mode),
        ("slip_retention_days", "FIN-03", 90, None),
        ("third_party_payment_mode", "FIN-05", None, third_party_mode),
        ("pilot_currency", "FIN-05", None, "LKR"),
    )
    for key, decision, integer_value, text_value in controls:
        response = client.post(
            "/v1/finance-readiness/controls",
            headers=headers,
            json={
                "controlKey": key,
                "decisionRevisionId": str(revisions[decision]),
                "integerValue": integer_value,
                "textValue": text_value,
                "evidenceRef": f"P3-{decision}-approval",
                "reason": f"Approved production value for {key}",
            },
        )
        assert response.status_code == 201, response.text


def _finance_staff(create_member, assign, super_admin):
    reviewer = create_member(verified=True)
    approver = create_member(verified=True)
    assign(reviewer, "3B", "platform", None, ["finance.review"], granted_by=super_admin)
    assign(approver, "3B", "platform", None, ["finance.approve"], granted_by=super_admin)
    return reviewer, approver


def _enable_feature(db_session, actor_id) -> None:
    db_session.execute(
        text(
            """
            INSERT INTO ops.feature_flag (key, enabled, gate, approval_ref, gate_recorded_by, gate_recorded_at,
                                          updated_by, updated_at)
            VALUES ('community_finance', true, 'G1', 'P3-test', :actor, clock_timestamp(), :actor, clock_timestamp())
            ON CONFLICT (key) DO UPDATE SET enabled = true, gate = 'G1', approval_ref = 'P3-test',
                gate_recorded_by = :actor, gate_recorded_at = clock_timestamp(), updated_by = :actor,
                updated_at = clock_timestamp()
            """
        ),
        {"actor": actor_id},
    )


def test_readiness_closes_only_after_current_approved_controls_and_dual_staff(
    database_settings, db_session, create_member, assign, super_admin, auth
):
    client = _client(_settings(database_settings), db_session)
    headers = auth(super_admin)

    initial = client.get("/v1/finance-readiness", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["ready"] is False

    revisions = {
        key: _approved_revision(db_session, super_admin.id, key)
        for key in ("FIN-01", "FIN-02", "FIN-03", "FIN-05")
    }
    _finance_staff(create_member, assign, super_admin)
    _record_controls(client, headers, revisions)

    ready = client.get("/v1/finance-readiness", headers=headers)
    assert ready.status_code == 200
    body = ready.json()
    assert body["ready"] is True
    assert len(body["controls"]) == 5
    assert body["reviewerCount"] == 1
    assert body["approverCount"] == 1
    assert body["distinctFinanceStaffCount"] == 2
    assert body["cardPaymentsEnabled"] is False
    assert body["automatedEvidenceDeletionEnabled"] is False


def test_new_decision_revision_invalidates_old_control_and_blocks_enforced_intake(
    database_settings, db_session, create_member, assign, super_admin, auth
):
    settings = _settings(database_settings, enforced=True)
    client = _client(settings, db_session)
    headers = auth(super_admin)
    revisions = {
        key: _approved_revision(db_session, super_admin.id, key)
        for key in ("FIN-01", "FIN-02", "FIN-03", "FIN-05")
    }
    _finance_staff(create_member, assign, super_admin)
    _record_controls(client, headers, revisions)
    _enable_feature(db_session, super_admin.id)
    assert client.get("/v1/finance-readiness", headers=headers).json()["ready"] is True

    db_session.execute(
        text(
            """
            INSERT INTO ops.policy_decision_revision
                (decision_key, revision, status, decision_text, rationale, created_by, updated_by)
            VALUES ('FIN-01', 2, 'draft', 'Replacement threshold under review',
                    'A newer revision must invalidate the previous machine control', :actor, :actor)
            """
        ),
        {"actor": super_admin.id},
    )

    readiness = client.get("/v1/finance-readiness", headers=headers).json()
    assert readiness["ready"] is False
    failed = {item["key"] for item in readiness["checks"] if not item["ready"]}
    assert {"approved_policy_decisions", "current_production_controls"} <= failed

    donor = create_member(verified=True)
    response = client.post(
        "/v1/fund/contributions",
        headers={**auth(donor), "Idempotency-Key": str(uuid.uuid4())},
        json={
            "amountMinor": 50_000,
            "transferDate": date.today().isoformat(),
            "bankReference": "P3-STALE-CONTROL",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
    )
    assert response.status_code == 503
    assert response.json()["detail"].startswith("finance_not_production_ready:")


def test_approved_machine_controls_drive_risk_and_third_party_enforcement(
    database_settings, db_session, create_member, assign, super_admin, auth
):
    client = _client(_settings(database_settings, enforced=True), db_session)
    headers = auth(super_admin)
    revisions = {
        key: _approved_revision(db_session, super_admin.id, key)
        for key in ("FIN-01", "FIN-02", "FIN-03", "FIN-05")
    }
    reviewer, _approver = _finance_staff(create_member, assign, super_admin)
    _record_controls(
        client,
        headers,
        revisions,
        threshold_minor=50_000,
        reporting_mode="manual_review_required",
        third_party_mode="blocked",
    )
    _enable_feature(db_session, super_admin.id)

    donor = create_member(verified=True)
    payload = {
        "amountMinor": 50_000,
        "transferDate": date.today().isoformat(),
        "bankReference": "P3-CONTROLLED-RISK",
        "noPrivilegeAcknowledged": True,
        "informationAccurateAcknowledged": True,
        "payingForSelf": True,
    }
    created = client.post(
        "/v1/fund/contributions",
        headers={**auth(donor), "Idempotency-Key": str(uuid.uuid4())},
        json=payload,
    )
    assert created.status_code == 200, created.text
    staff_detail = client.get(
        f"/v1/finance/contributions/{created.json()['id']}", headers=auth(reviewer)
    ).json()
    assert "enhanced_review_threshold" in staff_detail["riskFlags"]
    assert "statutory_reporting_review" in staff_detail["riskFlags"]

    refused = client.post(
        "/v1/fund/contributions",
        headers={**auth(donor), "Idempotency-Key": str(uuid.uuid4())},
        json={**payload, "bankReference": "P3-THIRD-PARTY", "payingForSelf": False},
    )
    assert refused.status_code == 422
    assert refused.json()["detail"] == "third_party_payment_not_allowed"


def test_control_must_use_the_matching_approved_decision(
    database_settings, db_session, super_admin, auth
):
    client = _client(_settings(database_settings), db_session)
    wrong_revision = _approved_revision(db_session, super_admin.id, "FIN-02")
    response = client.post(
        "/v1/finance-readiness/controls",
        headers=auth(super_admin),
        json={
            "controlKey": "enhanced_review_threshold_minor",
            "decisionRevisionId": str(wrong_revision),
            "integerValue": 10_000_000,
            "evidenceRef": "wrong-decision-test",
            "reason": "This mismatched decision must be rejected",
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "approved_current_decision_required"

    correct_revision = _approved_revision(db_session, super_admin.id, "FIN-01")
    payload = {
        "controlKey": "enhanced_review_threshold_minor",
        "decisionRevisionId": str(correct_revision),
        "integerValue": 10_000_000,
        "evidenceRef": "approved-threshold-evidence",
        "reason": "The approved threshold is recorded once per revision",
    }
    assert client.post("/v1/finance-readiness/controls", headers=auth(super_admin), json=payload).status_code == 201
    duplicate = client.post("/v1/finance-readiness/controls", headers=auth(super_admin), json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "control_already_recorded_for_decision"
