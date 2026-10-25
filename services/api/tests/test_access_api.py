"""/v1/access and /v1/audit against a real database. Skipped without DATABASE_URL.

Everything, including committed changes, is rolled back afterwards.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Row, text

from app.core.permissions import default_permissions


@pytest.fixture
def regional_admin(create_member, assign, super_admin, area) -> Row:
    member = create_member(verified=True, active=True)
    assign(member, "4", "province", area.province, ["roles.assign", "audit.view", "members.verify"], granted_by=super_admin)
    return member


def district_coordinator(member, area, *permissions) -> dict:
    return {
        "memberId": str(member.id),
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": list(permissions),
    }


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, area_code, area_path, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


# --- My access -------------------------------------------------------------------------


def test_my_access_lists_what_counts_now(db_client, auth, super_admin, create_member):
    mine = db_client.get("/v1/access/me", headers=auth(super_admin)).json()
    assert [(a["tier"], a["area"]) for a in mine] == [("5", {"level": "platform", "code": None})]

    assert db_client.get("/v1/access/me", headers=auth(create_member())).json() == []


def test_an_overdue_review_suspends_the_assignment(db_client, auth, assign, super_admin, create_member, area):
    member = create_member(verified=True, active=True)
    overdue = datetime.now(UTC) - timedelta(days=1)
    assign(member, "3A", "district", area.district, ["members.verify"], granted_by=super_admin, review_due_at=overdue)

    assert db_client.get("/v1/access/me", headers=auth(member)).json() == []


# --- Permission checks (RB-01, FR-ARCH-002) ---------------------------------------------------------


def test_without_roles_assign_the_request_is_refused_and_logged(db_client, db_session, auth, create_member, area):
    member = create_member(verified=True, active=True)

    response = db_client.post("/v1/access/assignments", json=district_coordinator(member, area, "analytics.view"), headers=auth(member))

    assert response.status_code == 403
    assert response.json() == {"detail": "forbidden"}
    entry = last_audit(db_session)
    assert entry.action == "access.denied"
    assert entry.actor_id == member.id
    assert entry.details["permission"] == "roles.assign"


def test_repeated_refusals_are_counted_not_each_logged(db_client, db_session, auth, create_member):
    """The review finding: every refused request wrote an audit entry, so one member could flood
    the append-only log. One entry per person, permission and reason in 10 minutes; the next
    entry after that reports how many were held back."""
    member = create_member()

    def refusals() -> list[Row]:
        return db_session.execute(
            text("SELECT details FROM ops.audit_log WHERE action = 'access.denied' AND actor_id = :id ORDER BY id"),
            {"id": member.id},
        ).all()

    statuses = {db_client.get("/v1/identity/reviews", headers=auth(member)).status_code for _ in range(6)}
    assert statuses == {403}
    assert len(refusals()) == 1 and "repeatsHeldBack" not in refusals()[0].details

    db_session.execute(
        text("UPDATE ops.denial_tally SET window_started_at = now() - interval '11 minutes' WHERE actor_id = :id"),
        {"id": member.id},
    )
    db_client.get("/v1/identity/reviews", headers=auth(member))

    [first, second] = refusals()
    assert (second.details["reason"], second.details["repeatsHeldBack"]) == ("forbidden", 5)


# --- Assigning (W09, RB-02 to RB-06) ----------------------------------------------------


def test_preview_explains_problems_without_saving(db_client, db_session, auth, super_admin, create_member, area):
    unverified = create_member()

    preview = db_client.post(
        "/v1/access/assignments/preview", json=district_coordinator(unverified, area, "members.verify"), headers=auth(super_admin)
    ).json()

    assert preview["allowed"] is False
    assert "identity_not_verified" in preview["problems"]
    saved = db_session.scalar(text("SELECT count(*) FROM access.staff_assignment WHERE member_id = :id"), {"id": unverified.id})
    assert saved == 0


def test_an_assignment_is_saved_audited_and_effective_at_once(db_client, db_session, auth, super_admin, create_member, area):
    coordinator = create_member(verified=True, active=True)
    body = district_coordinator(coordinator, area, "cases.decide_district", "members.verify")

    response = db_client.post("/v1/access/assignments", json=body, headers=auth(super_admin))

    assert response.status_code == 201
    created = response.json()
    assert created["grantedBy"] == str(super_admin.id)
    assert created["reviewDueAt"] is not None  # members.verify is explicit-only (RB-05)
    entry = last_audit(db_session)
    assert (entry.action, entry.target_id, entry.area_code) == ("access.assignment.created", created["id"], area.district)
    assert f"province:{area.province}" in entry.area_path

    mine = db_client.get("/v1/access/me", headers=auth(coordinator)).json()
    assert [a["id"] for a in mine] == [created["id"]]


def test_a_refused_assignment_lists_the_problems(db_client, auth, super_admin, create_member, area):
    body = district_coordinator(create_member(verified=True, active=True), area, "cases.collect")
    body["tier"] = "1"  # a GN coordinator cannot have a district

    response = db_client.post("/v1/access/assignments", json=body, headers=auth(super_admin))

    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "assignment_refused"
    assert "area_does_not_match_tier" in detail["problems"]


def test_regional_administrators_appoint_only_below_themselves(db_client, auth, regional_admin, create_member, area):
    peer = {
        "memberId": str(create_member(verified=True, active=True).id),
        "tier": "4",
        "area": {"level": "province", "code": area.province},
        "permissions": ["analytics.view"],
    }
    response = db_client.post("/v1/access/assignments", json=peer, headers=auth(regional_admin))
    assert "tier_not_below_yours" in response.json()["detail"]["problems"]

    coordinator = district_coordinator(create_member(verified=True, active=True), area, "cases.decide_district")
    assert db_client.post("/v1/access/assignments", json=coordinator, headers=auth(regional_admin)).status_code == 201


def test_revoking_takes_effect_on_the_next_request(db_client, db_session, auth, super_admin, create_member, area):
    coordinator = create_member(verified=True, active=True)
    created = db_client.post(
        "/v1/access/assignments", json=district_coordinator(coordinator, area, "cases.decide_district"), headers=auth(super_admin)
    ).json()

    response = db_client.post(
        f"/v1/access/assignments/{created['id']}/revoke", json={"reason": "Left the role"}, headers=auth(super_admin)
    )

    assert response.status_code == 200
    assert response.json()["state"] == "revoked"
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() == []
    assert last_audit(db_session).action == "access.assignment.revoked"
    again = db_client.post(f"/v1/access/assignments/{created['id']}/revoke", json={"reason": "Twice"}, headers=auth(super_admin))
    assert again.status_code == 404


def test_the_catalogue_describes_tiers_and_permissions(db_client, auth, super_admin):
    catalogue = db_client.get("/v1/access/catalogue", headers=auth(super_admin)).json()

    assert [t["tier"] for t in catalogue["tiers"]] == ["1", "2A", "2B", "3A", "3B", "4", "5"]
    assert catalogue["permissions"]["members.verify"] == {"3A": "explicit", "4": "explicit", "5": "explicit"}


# --- Reading the audit log (FR-ADM-011) ---------------------------------------------------


def test_regional_auditors_see_only_their_region(db_client, auth, super_admin, regional_admin, create_member, area):
    stranger = create_member(verified=True, active=True)
    db_client.post("/v1/access/assignments", json=district_coordinator(stranger, area, "analytics.view"), headers=auth(stranger))  # denied, no area
    db_client.post("/v1/access/assignments", json=district_coordinator(create_member(verified=True, active=True), area, "cases.decide_district"), headers=auth(super_admin))

    everything = {e["action"] for e in db_client.get("/v1/audit?limit=10", headers=auth(super_admin)).json()}
    regional = {e["action"] for e in db_client.get("/v1/audit?limit=10", headers=auth(regional_admin)).json()}

    assert {"access.denied", "access.assignment.created"} <= everything
    assert "access.assignment.created" in regional
    assert "access.denied" not in regional  # no area, so outside every region


def test_verifying_the_chain_needs_platform_scope(db_client, auth, super_admin, regional_admin, create_member):
    assert db_client.get("/v1/audit/verify", headers=auth(regional_admin)).json() == {"detail": "platform_scope_required"}

    result = db_client.get("/v1/audit/verify", headers=auth(super_admin)).json()
    assert result["ok"] is True

    assert db_client.get("/v1/audit", headers=auth(create_member())).status_code == 403
