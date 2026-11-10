from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from sqlalchemy import text

from app.modules.policy_decisions.rules import DECISIONS


def _draft(text: str = "Approved operating value and controls for the production staff workflow") -> dict:
    return {
        "decisionText": text,
        "rationale": "The named owners reviewed the security, privacy and operating consequences.",
        "effectiveFrom": date.today().isoformat(),
    }


def _approve(db_client, headers, key: str) -> dict:
    revision = db_client.post(f"/v1/policy-decisions/{key}/revisions", json=_draft(), headers=headers).json()["current"]
    db_client.post(
        f"/v1/policy-decisions/{key}/revisions/{revision['id']}/submit",
        json={"reason": "Ready for evidence-backed owner review."}, headers=headers,
    )
    for role in DECISIONS[key].required_roles:
        response = db_client.post(
            f"/v1/policy-decisions/{key}/revisions/{revision['id']}/reviews",
            json={
                "role": role, "outcome": "approve", "reviewerName": f"{role} reviewer",
                "reviewerTitle": role, "evidenceRef": f"SIGNED-{key}-{role}",
                "comment": "Controlled signed evidence was checked before recording this approval.",
                "reviewedAt": date.today().isoformat(),
            }, headers=headers,
        )
        assert response.status_code == 200
    return revision


def test_control_requires_current_approved_decision_and_fails_closed_on_new_revision(
    db_client, auth, super_admin,
):
    headers = auth(super_admin)
    refused = db_client.post(
        "/v1/operations/controls",
        json={
            "controlKey": "offline_attendance_replay_hours", "integerValue": 72,
            "decisionRevisionId": str(uuid4()), "reason": "Operations approved the bounded replay window.",
            "confirmApprovedBasis": True,
        }, headers=headers,
    )
    assert (refused.status_code, refused.json()) == (409, {"detail": "approved_decision_required"})

    revision = _approve(db_client, headers, "STF-01")
    recorded = db_client.post(
        "/v1/operations/controls",
        json={
            "controlKey": "offline_attendance_replay_hours", "integerValue": 72,
            "decisionRevisionId": revision["id"], "reason": "Operations approved the bounded replay window.",
            "confirmApprovedBasis": True,
        }, headers=headers,
    )
    assert recorded.status_code == 201 and recorded.json()["integerValue"] == 72
    assert db_client.get("/v1/operations/readiness", headers=headers).json()["items"][0]["ready"] is True

    opened = db_client.post(
        "/v1/policy-decisions/STF-01/revisions",
        json=_draft("Replacement offline window now under renewed owner review and not yet effective."), headers=headers,
    )
    assert opened.status_code == 201
    readiness = db_client.get("/v1/operations/readiness", headers=headers).json()
    offline = next(item for item in readiness["items"] if item["key"] == "offline_attendance_replay_hours")
    assert offline["ready"] is False


def test_policy_publication_and_member_consent_are_version_bound(
    db_client, auth, super_admin, create_member,
):
    admin_headers = auth(super_admin)
    member = create_member(verified=True, active=True)
    member_headers = auth(member)
    now = datetime.now(UTC).replace(microsecond=0)
    published = db_client.post(
        "/v1/operations/policies",
        json={
            "policyKey": "volunteer-consent", "policyType": "optional_consent", "version": "1.0",
            "locale": "ta", "contentText": "Volunteer duties are optional and consent may be withdrawn.",
            "approvalReference": "DPO-APPROVAL-2026-11", "approvedAt": (now - timedelta(minutes=2)).isoformat(),
            "effectiveFrom": (now - timedelta(minutes=1)).isoformat(), "confirmImmutablePublication": True,
        }, headers=admin_headers,
    )
    assert published.status_code == 201
    policy_id = published.json()["id"]
    current = db_client.get("/v1/operations/me/policies", headers=member_headers)
    assert current.status_code == 200 and current.json()[0]["myAction"] is None
    granted = db_client.post(
        f"/v1/operations/me/policies/{policy_id}/actions",
        json={"action": "granted", "legalBasis": "consent"}, headers=member_headers,
    )
    assert granted.status_code == 201 and granted.json()["action"] == "granted"
    withdrawn = db_client.post(
        f"/v1/operations/me/policies/{policy_id}/actions",
        json={"action": "withdrawn", "legalBasis": "consent"}, headers=member_headers,
    )
    assert withdrawn.status_code == 201 and withdrawn.json()["action"] == "withdrawn"


def test_tier5_certification_is_separate_external_evidence(db_client, auth, super_admin):
    headers = auth(super_admin)
    assignments = db_client.get("/v1/operations/tier5-assignments", headers=headers).json()
    assert assignments
    today = date.today()
    recorded = db_client.post(
        "/v1/operations/tier5-certifications",
        json={
            "assignmentId": assignments[0]["assignmentId"], "decision": "certified",
            "periodStart": today.isoformat(), "periodEnd": (today + timedelta(days=90)).isoformat(),
            "reviewerName": "Executive Sponsor", "reviewerTitle": "Independent certifier",
            "evidenceRef": "G1-TIER5-CERT-2026-Q4",
            "reason": "External reviewer certified the active grant against the controlled access record.",
            "certifiedAt": today.isoformat(), "confirmExternalReview": True,
        }, headers=headers,
    )
    assert recorded.status_code == 201 and recorded.json()["decision"] == "certified"


def test_area_scoped_volunteer_offer_requires_current_member_consent(
    db_client, db_session, auth, super_admin, create_member, assign, area,
):
    coordinator = create_member(verified=True, active=True)
    assign(
        coordinator, "3B", "district", area.district,
        ["events.manage", "volunteers.manage"], granted_by=super_admin,
    )
    volunteer = create_member(verified=True, active=True)
    member_code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": volunteer.id})
    start = datetime.now(UTC) + timedelta(hours=2)
    created = db_client.post(
        "/v1/events",
        json={
            "titleEn": "Community service day", "titleTa": "சமூக சேவை நாள்",
            "eventType": "service_day", "startsAt": start.isoformat(),
            "endsAt": (start + timedelta(hours=3)).isoformat(), "venue": "District community hall",
            "area": {"level": "district", "code": area.district},
        }, headers=auth(coordinator),
    )
    assert created.status_code == 201
    event = created.json()

    without_consent = db_client.post(
        "/v1/operations/volunteer-assignments",
        json={
            "memberCode": member_code, "eventId": event["id"], "consentVersion": "1.0",
            "dutyType": "registration", "shiftStart": start.isoformat(),
            "shiftEnd": (start + timedelta(hours=2)).isoformat(),
        }, headers=auth(coordinator),
    )
    assert (without_consent.status_code, without_consent.json()) == (
        409, {"detail": "active_membership_and_consent_required"},
    )

    now = datetime.now(UTC).replace(microsecond=0)
    policy = db_client.post(
        "/v1/operations/policies",
        json={
            "policyKey": "volunteer-consent", "policyType": "optional_consent", "version": "1.0",
            "locale": "ta", "contentText": "Volunteer participation is optional and may be withdrawn.",
            "approvalReference": "DPO-VOLUNTEER-2026", "approvedAt": (now - timedelta(minutes=2)).isoformat(),
            "effectiveFrom": (now - timedelta(minutes=1)).isoformat(), "confirmImmutablePublication": True,
        }, headers=auth(super_admin),
    ).json()
    db_client.post(
        f"/v1/operations/me/policies/{policy['id']}/actions",
        json={"action": "granted", "legalBasis": "consent"}, headers=auth(volunteer),
    )
    offered = db_client.post(
        "/v1/operations/volunteer-assignments",
        json={
            "memberCode": member_code, "eventId": event["id"], "consentVersion": "1.0",
            "dutyType": "registration", "shiftStart": start.isoformat(),
            "shiftEnd": (start + timedelta(hours=2)).isoformat(),
        }, headers=auth(coordinator),
    )
    assert offered.status_code == 201 and offered.json()["state"] == "offered"
    assignment_id = offered.json()["id"]
    accepted = db_client.post(
        f"/v1/operations/me/volunteer-assignments/{assignment_id}/response",
        json={"state": "accepted", "reason": "Accepted by volunteer"}, headers=auth(volunteer),
    )
    assert accepted.status_code == 200 and accepted.json()["state"] == "accepted"
