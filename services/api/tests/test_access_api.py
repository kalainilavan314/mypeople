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


def create_assignment_from_preview(db_client, headers, body: dict) -> object:
    """The only public creation path: make a durable preview, then confirm it."""
    preview = db_client.post("/v1/access/assignment-previews", json=body, headers=headers)
    assert preview.status_code == 201
    return db_client.post(f"/v1/access/assignment-previews/{preview.json()['id']}/confirm", headers=headers)


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

    response = db_client.post("/v1/access/assignment-previews", json=district_coordinator(member, area, "analytics.view"), headers=auth(member))

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


def test_direct_assignment_creation_is_not_a_public_route(db_client, auth, super_admin, create_member, area):
    """A role can be created only by confirming a durable preview."""
    response = db_client.post(
        "/v1/access/assignments",
        json=district_coordinator(create_member(verified=True, active=True), area, "members.verify"),
        headers=auth(super_admin),
    )

    assert response.status_code == 405


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

    response = create_assignment_from_preview(db_client, auth(super_admin), body)

    assert response.status_code == 201
    created = response.json()
    assert created["grantedBy"] == str(super_admin.id)
    assert created["reviewDueAt"] is not None  # every staff grant is reviewed quarterly (FR-AUTH-027)
    entry = last_audit(db_session)
    assert (entry.action, entry.target_id, entry.area_code) == ("access.assignment.created", created["id"], area.district)
    assert f"province:{area.province}" in entry.area_path

    mine = db_client.get("/v1/access/me", headers=auth(coordinator)).json()
    assert [a["id"] for a in mine] == [created["id"]]


def test_a_refused_assignment_lists_the_problems(db_client, auth, super_admin, create_member, area):
    body = district_coordinator(create_member(verified=True, active=True), area, "cases.collect")
    body["tier"] = "1"  # a GN coordinator cannot have a district

    response = db_client.post("/v1/access/assignment-previews", json=body, headers=auth(super_admin))

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
    response = db_client.post("/v1/access/assignment-previews", json=peer, headers=auth(regional_admin))
    assert "tier_not_below_yours" in response.json()["detail"]["problems"]

    coordinator = district_coordinator(create_member(verified=True, active=True), area, "cases.decide_district")
    assert create_assignment_from_preview(db_client, auth(regional_admin), coordinator).status_code == 201


def test_revoking_takes_effect_on_the_next_request(db_client, db_session, auth, super_admin, create_member, area):
    coordinator = create_member(verified=True, active=True)
    created = create_assignment_from_preview(
        db_client, auth(super_admin), district_coordinator(coordinator, area, "cases.decide_district")
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
    db_client.post("/v1/access/assignment-previews", json=district_coordinator(stranger, area, "analytics.view"), headers=auth(stranger))  # denied, no area
    create_assignment_from_preview(
        db_client, auth(super_admin), district_coordinator(create_member(verified=True, active=True), area, "cases.decide_district")
    )

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


# --- W09 assignment list ---------------------------------------------------------------------------------


def test_an_administrator_lists_assignments_in_their_own_area_only(db_client, db_session, auth, regional_admin, super_admin, create_member, assign, area):
    inside = create_member(verified=True, active=True)
    assign(inside, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)
    other_province = db_session.scalar(
        text("SELECT province_code FROM geo.province WHERE province_code <> :code LIMIT 1"), {"code": area.province}
    )
    outside = create_member(verified=True, active=True)
    if other_province:
        assign(outside, "4", "province", other_province, ["roles.assign"], granted_by=super_admin)

    regional = db_client.get("/v1/access/assignments", headers=auth(regional_admin)).json()
    platform = db_client.get("/v1/access/assignments", headers=auth(super_admin)).json()

    regional_members = {item["memberId"] for item in regional}
    assert str(inside.id) in regional_members and str(outside.id) not in regional_members
    assert {str(inside.id), str(outside.id) if other_province else str(inside.id)} <= {item["memberId"] for item in platform}
    listed = next(item for item in regional if item["memberId"] == str(inside.id))
    assert listed["memberCode"] and listed["fullName"] == "Test Member" and listed["tier"] == "3A"


# --- Work queues (D01) -----------------------------------------------------------------------------------


def test_work_queues_empty_for_regular_member(db_client, auth, create_member):
    member = create_member()
    res = db_client.get("/v1/access/work-queues", headers=auth(member))
    assert res.status_code == 200
    data = res.json()
    assert data["verification"] is None
    assert data["events"] is None


def test_work_queues_returns_counts_for_permitted_queues(db_client, auth, super_admin):
    res = db_client.get("/v1/access/work-queues", headers=auth(super_admin))
    assert res.status_code == 200
    data = res.json()
    assert data["verification"] is not None
    assert data["configuration"] is not None


# --- Durable assignment preview (Milestone 0) -------------------------------------------------------------


def _member_code(db_session, person: Row) -> str:
    return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})


def test_assignment_preview_lifecycle_across_requests(db_client, db_session, auth, super_admin, regional_admin, create_member, area):
    coordinator = create_member(verified=True, active=True)
    code = _member_code(db_session, coordinator)

    # 1. Preview creation with member code
    preview_req = {
        "memberCode": code,
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["cases.decide_district", "members.verify"],
        "note": "District team lead",
    }
    create_res = db_client.post("/v1/access/assignment-previews", json=preview_req, headers=auth(super_admin))
    assert create_res.status_code == 201
    created_preview = create_res.json()
    preview_id = created_preview["id"]
    assert "expiresAt" in created_preview

    # 2. Retrieval by owning staff
    get_res = db_client.get(f"/v1/access/assignment-previews/{preview_id}", headers=auth(super_admin))
    assert get_res.status_code == 200
    preview_data = get_res.json()
    assert preview_data["memberCode"] == code
    assert preview_data["tier"] == "3A"
    assert preview_data["area"] == {"level": "district", "code": area.district}
    assert preview_data["permissions"] == ["cases.decide_district", "members.verify"]
    assert preview_data["status"] == "active"

    # 3. Another staff user cannot access it (fails safely without revealing existence)
    other_staff_res = db_client.get(f"/v1/access/assignment-previews/{preview_id}", headers=auth(regional_admin))
    assert other_staff_res.status_code == 404
    assert other_staff_res.json()["detail"] == "preview_expired_or_invalid"

    # 4. Confirmation by owning staff: creates assignment and writes audit
    confirm_res = db_client.post(f"/v1/access/assignment-previews/{preview_id}/confirm", headers=auth(super_admin))
    assert confirm_res.status_code == 201
    created_assignment = confirm_res.json()
    assert created_assignment["memberId"] == str(coordinator.id)
    assert created_assignment["tier"] == "3A"

    audit_entry = last_audit(db_session)
    assert audit_entry.action == "access.assignment.created"
    assert audit_entry.target_id == created_assignment["id"]

    # 5. Duplicate confirmation fails safely: status is consumed, exactly 1 assignment created
    repeat_res = db_client.post(f"/v1/access/assignment-previews/{preview_id}/confirm", headers=auth(super_admin))
    assert repeat_res.status_code == 404
    assert repeat_res.json()["detail"] == "preview_expired_or_invalid"

    assignment_count = db_session.scalar(
        text("SELECT count(*) FROM access.staff_assignment WHERE member_id = :id AND state = 'active'"),
        {"id": coordinator.id},
    )
    assert assignment_count == 1


def test_assignment_preview_refused_without_saving_when_rules_fail(db_client, db_session, auth, super_admin, create_member, area):
    unverified = create_member(verified=False)
    code = _member_code(db_session, unverified)

    preview_req = {
        "memberCode": code,
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["members.verify"],
    }
    res = db_client.post("/v1/access/assignment-previews", json=preview_req, headers=auth(super_admin))
    assert res.status_code == 403
    assert "identity_not_verified" in res.json()["detail"]["problems"]

    # Verify no record created in database
    previews = db_session.scalar(text("SELECT count(*) FROM access.assignment_preview WHERE member_id = :id"), {"id": unverified.id})
    assert previews == 0


def test_assignment_preview_revalidates_rules_on_confirmation(db_client, db_session, auth, super_admin, create_member, area):
    coordinator = create_member(verified=True, active=True)
    code = _member_code(db_session, coordinator)

    preview_req = {
        "memberCode": code,
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["members.verify"],
    }
    create_res = db_client.post("/v1/access/assignment-previews", json=preview_req, headers=auth(super_admin))
    assert create_res.status_code == 201
    preview_id = create_res.json()["id"]

    # Suspend membership before confirmation
    db_session.execute(
        text("UPDATE membership.membership SET state = 'suspended' WHERE member_id = :id"),
        {"id": coordinator.id},
    )

    # Confirmation must re-evaluate rules and refuse
    confirm_res = db_client.post(f"/v1/access/assignment-previews/{preview_id}/confirm", headers=auth(super_admin))
    assert confirm_res.status_code == 403
    assert "membership_not_active" in confirm_res.json()["detail"]["problems"]

    # No assignment created
    assignment_count = db_session.scalar(
        text("SELECT count(*) FROM access.staff_assignment WHERE member_id = :id"),
        {"id": coordinator.id},
    )
    assert assignment_count == 0


def test_assignment_preview_cancellation_and_expiry(db_client, db_session, auth, super_admin, regional_admin, create_member, area):
    from app.tasks.cleanup import run_once

    coordinator = create_member(verified=True, active=True)
    code = _member_code(db_session, coordinator)

    preview_req = {
        "memberCode": code,
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["members.verify"],
    }
    create_res = db_client.post("/v1/access/assignment-previews", json=preview_req, headers=auth(super_admin))
    assert create_res.status_code == 201
    preview_id = create_res.json()["id"]

    # Other staff cannot cancel
    other_cancel = db_client.post(f"/v1/access/assignment-previews/{preview_id}/cancel", headers=auth(regional_admin))
    assert other_cancel.status_code == 404
    assert other_cancel.json()["detail"] == "preview_expired_or_invalid"

    # Owner cancels
    owner_cancel = db_client.post(f"/v1/access/assignment-previews/{preview_id}/cancel", headers=auth(super_admin))
    assert owner_cancel.status_code == 200
    assert owner_cancel.json() == {"status": "cancelled"}

    # Cancelled preview cannot be confirmed or retrieved
    assert db_client.get(f"/v1/access/assignment-previews/{preview_id}", headers=auth(super_admin)).status_code == 404
    assert db_client.post(f"/v1/access/assignment-previews/{preview_id}/confirm", headers=auth(super_admin)).status_code == 404

    # Test expiry
    create_res2 = db_client.post("/v1/access/assignment-previews", json=preview_req, headers=auth(super_admin))
    preview_id2 = create_res2.json()["id"]

    # Move expires_at into the past
    db_session.execute(
        text("UPDATE access.assignment_preview SET expires_at = now() - interval '1 minute' WHERE id = :id"),
        {"id": preview_id2},
    )

    assert db_client.get(f"/v1/access/assignment-previews/{preview_id2}", headers=auth(super_admin)).status_code == 404
    assert db_client.post(f"/v1/access/assignment-previews/{preview_id2}/confirm", headers=auth(super_admin)).status_code == 404
    assert db_client.post(f"/v1/access/assignment-previews/{preview_id2}/cancel", headers=auth(super_admin)).status_code == 404

    # Move older than 2 hours to test cleanup
    db_session.execute(
        text("UPDATE access.assignment_preview SET expires_at = now() - interval '3 hours', created_at = now() - interval '3 hours' WHERE id IN (:id1, :id2)"),
        {"id1": preview_id, "id2": preview_id2},
    )
    cleanup_result = run_once(db_session)
    assert cleanup_result["cleanedAssignmentPreviews"] >= 2
