"""P1 policy decision register, evidence and release-control tests."""

from datetime import date

from sqlalchemy import text

from app.modules.policy_decisions.rules import DECISIONS


def draft(text_value: str = "Approved operational policy with controlled production safeguards") -> dict:
    return {
        "decisionText": text_value,
        "rationale": "Reviewed against legal, privacy, operational and security obligations.",
        "effectiveFrom": "2026-12-01",
    }


def review(role: str, outcome: str = "approve") -> dict:
    return {
        "role": role,
        "outcome": outcome,
        "reviewerName": f"{role.replace('_', ' ').title()} Reviewer",
        "reviewerTitle": role.replace("_", " ").title(),
        "evidenceRef": f"SIGNED-{role.upper()}-2026-01",
        "comment": "Signed source record checked and retained in the controlled evidence store.",
        "reviewedAt": date.today().isoformat(),
    }


def test_catalog_is_fixed_and_requires_system_configuration(db_client, auth, super_admin, create_member, assign, area):
    listed = db_client.get("/v1/policy-decisions", headers=auth(super_admin))
    ordinary = create_member(verified=True)
    assign(ordinary, "1", "gn", area.gn, ["analytics.view"], granted_by=super_admin)
    refused = db_client.get("/v1/policy-decisions", headers=auth(ordinary))

    assert listed.status_code == 200
    assert {item["key"] for item in listed.json()} == set(DECISIONS)
    assert all(item["current"] is None and item["missingRoles"] == item["requiredRoles"] for item in listed.json())
    assert refused.status_code == 403


def test_revision_requires_every_named_owner_and_keeps_evidence(db_client, db_session, auth, super_admin):
    headers = auth(super_admin)
    created = db_client.post("/v1/policy-decisions/FIN-01/revisions", json=draft(), headers=headers)
    revision_id = created.json()["current"]["id"]
    submitted = db_client.post(
        f"/v1/policy-decisions/FIN-01/revisions/{revision_id}/submit",
        json={"reason": "Ready for the named policy owners to review."},
        headers=headers,
    )
    first = db_client.post(
        f"/v1/policy-decisions/FIN-01/revisions/{revision_id}/reviews",
        json=review("treasurer"),
        headers=headers,
    )
    duplicate = db_client.post(
        f"/v1/policy-decisions/FIN-01/revisions/{revision_id}/reviews",
        json=review("treasurer"),
        headers=headers,
    )
    approved = db_client.post(
        f"/v1/policy-decisions/FIN-01/revisions/{revision_id}/reviews",
        json=review("compliance"),
        headers=headers,
    )

    assert created.status_code == 201 and created.json()["current"]["status"] == "draft"
    assert submitted.json()["current"]["status"] == "in_review"
    assert first.json()["current"]["status"] == "in_review" and first.json()["missingRoles"] == ["compliance"]
    assert (duplicate.status_code, duplicate.json()) == (409, {"detail": "review_role_already_recorded"})
    assert approved.json()["current"]["status"] == "approved" and approved.json()["missingRoles"] == []

    audit_actions = list(
        db_session.scalars(
            text(
                "SELECT action FROM ops.audit_log WHERE target_type = 'policy_decision' "
                "AND target_id = 'FIN-01' ORDER BY id"
            )
        )
    )
    assert audit_actions == [
        "policy_decisions.revision_created",
        "policy_decisions.submitted",
        "policy_decisions.approve",
        "policy_decisions.approve",
    ]


def test_rejection_closes_revision_and_requires_a_new_one(db_client, auth, super_admin):
    headers = auth(super_admin)
    created = db_client.post("/v1/policy-decisions/STF-01/revisions", json=draft(), headers=headers).json()
    revision_id = created["current"]["id"]
    db_client.post(
        f"/v1/policy-decisions/STF-01/revisions/{revision_id}/submit",
        json={"reason": "Operations and security review requested."},
        headers=headers,
    )
    rejected = db_client.post(
        f"/v1/policy-decisions/STF-01/revisions/{revision_id}/reviews",
        json=review("security", "reject"),
        headers=headers,
    )
    late_review = db_client.post(
        f"/v1/policy-decisions/STF-01/revisions/{revision_id}/reviews",
        json=review("operations"),
        headers=headers,
    )
    next_revision = db_client.post(
        "/v1/policy-decisions/STF-01/revisions",
        json=draft("Approved offline replay rule with a shorter controlled synchronization window"),
        headers=headers,
    )

    assert rejected.json()["current"]["status"] == "rejected"
    assert (late_review.status_code, late_review.json()) == (409, {"detail": "revision_not_in_review"})
    assert next_revision.status_code == 201 and next_revision.json()["current"]["revision"] == 2


def test_finance_feature_stays_off_until_required_policy_decisions_are_approved(
    db_client, auth, super_admin
):
    headers = auth(super_admin)
    reason = {"reason": "Candidate Gate G1 evidence recorded"}
    db_client.post(
        "/v1/features/community_finance/gate",
        json={"gate": "G1", "approvalRef": "G1-CANDIDATE-2026", **reason},
        headers=headers,
    )
    enabled = db_client.post("/v1/features/community_finance/enable", json=reason, headers=headers)

    assert enabled.status_code == 409
    assert enabled.json() == {"detail": "policy_decisions_required:FIN-01,FIN-02,FIN-03,FIN-05"}

    for key in ("FIN-01", "FIN-02", "FIN-03", "FIN-05"):
        revision = db_client.post(f"/v1/policy-decisions/{key}/revisions", json=draft(), headers=headers).json()[
            "current"
        ]
        db_client.post(
            f"/v1/policy-decisions/{key}/revisions/{revision['id']}/submit",
            json={"reason": "Required production policy owners reviewed this revision."},
            headers=headers,
        )
        for role in DECISIONS[key].required_roles:
            response = db_client.post(
                f"/v1/policy-decisions/{key}/revisions/{revision['id']}/reviews",
                json=review(role),
                headers=headers,
            )
            assert response.status_code == 200

    now_enabled = db_client.post("/v1/features/community_finance/enable", json=reason, headers=headers)
    assert now_enabled.status_code == 200 and now_enabled.json()["enabled"] is True

    replacement = db_client.post(
        "/v1/policy-decisions/FIN-01/revisions",
        json=draft("Replacement threshold pending renewed owner approval and release review."),
        headers=headers,
    )
    assert replacement.status_code == 201
    db_client.post("/v1/features/community_finance/disable", json={"reason": "Policy revision opened"}, headers=headers)
    blocked_again = db_client.post("/v1/features/community_finance/enable", json=reason, headers=headers)
    assert (blocked_again.status_code, blocked_again.json()) == (
        409,
        {"detail": "policy_decisions_required:FIN-01"},
    )
