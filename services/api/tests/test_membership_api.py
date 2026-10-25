"""/v1/membership against a real database. Skipped without DATABASE_URL.

Everything, including committed changes, is rolled back afterwards.
"""

import pytest
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

ACTIVATE = "members.activate"


@pytest.fixture
def member(member_in, area) -> Row:
    """A member in the area whose identity a reviewer has confirmed."""
    return member_in(area, verified=True)


@pytest.fixture
def activator(make_reviewer, area) -> Row:
    """A district coordinator who may change memberships in the member's district."""
    return make_reviewer(area.district, permissions=(ACTIVATE,))


def change(db_client, auth, staff: Row, member: Row, action: str, reason: str, note: str | None = None):
    return db_client.post(
        f"/v1/membership/members/{member.id}/changes",
        json={"action": action, "reasonCode": reason, "note": note},
        headers=auth(staff),
    )


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, area_code, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


def test_a_new_member_is_pending(db_client, auth, member):
    mine = db_client.get("/v1/membership/me", headers=auth(member)).json()
    assert mine == {"state": "pending", "reasonCode": None, "changedAt": None}


def test_activating_a_verified_member(db_client, db_session, auth, activator, member, area):
    response = change(db_client, auth, activator, member, "activate", "identity_verified")

    assert response.status_code == 200
    body = response.json()
    assert (body["state"], body["reasonCode"], body["identityVerified"]) == ("active", "identity_verified", True)
    [entry] = body["history"]
    assert (entry["action"], entry["fromState"], entry["toState"], entry["changedBy"]) == (
        "activate", "pending", "active", str(activator.id)
    )
    audit = last_audit(db_session)
    assert (audit.action, audit.actor_id, audit.target_id, audit.area_code) == (
        "membership.activate", activator.id, str(member.id), area.gn
    )
    assert audit.details == {"memberId": str(member.id), "from": "pending", "to": "active", "reasonCode": "identity_verified"}
    assert db_client.get("/v1/membership/me", headers=auth(member)).json()["state"] == "active"


def test_activation_needs_a_confirmed_identity(db_client, auth, activator, member_in, area):
    unverified = member_in(area)

    response = change(db_client, auth, activator, unverified, "activate", "identity_verified")

    assert (response.status_code, response.json()["detail"]) == (
        422, {"code": "change_refused", "problems": ["identity_not_verified"]}
    )


def test_suspension_needs_a_reason_and_a_note_for_other(db_client, auth, activator, member):
    change(db_client, auth, activator, member, "activate", "identity_verified")

    without_note = change(db_client, auth, activator, member, "suspend", "other")
    from_wrong_state = change(db_client, auth, activator, member, "reinstate", "investigation_closed")
    suspended = change(db_client, auth, activator, member, "suspend", "other", "Complaint under review")

    assert without_note.json()["detail"]["problems"] == ["note_required"]
    assert from_wrong_state.json()["detail"]["problems"] == ["not_allowed_from:active"]
    assert suspended.json()["state"] == "suspended"
    assert suspended.json()["history"][0]["note"] == "Complaint under review"
    # The member sees the state and reason code; the staff note is not part of their view.
    assert db_client.get("/v1/membership/me", headers=auth(member)).json()["reasonCode"] == "other"


@pytest.fixture
def regional_activator(make_reviewer, area) -> Row:
    """A regional coordinator (Tier 4) who may change memberships across the province."""
    return make_reviewer(area.province, permissions=(ACTIVATE,), tier="4", level="province")


def test_suspending_a_staff_member_stops_their_staff_rights(
    db_client, auth, regional_activator, member_in, assign, super_admin, area
):
    coordinator = member_in(area, verified=True)  # a district coordinator, below the regional activator
    assign(coordinator, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() != []

    suspended = change(db_client, auth, regional_activator, coordinator, "suspend", "conduct_investigation")
    assert suspended.status_code == 200
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() == []  # BR-097
    assert db_client.get("/v1/identity/reviews", headers=auth(coordinator)).json() == {"detail": "forbidden"}

    reinstated = change(db_client, auth, regional_activator, coordinator, "reinstate", "investigation_closed")
    assert reinstated.status_code == 200
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() != []


def test_a_peer_or_junior_cannot_change_a_staff_members_membership(
    db_client, db_session, auth, activator, regional_activator, member_in, assign, super_admin, area
):
    """The review finding: a district coordinator could suspend the regional coordinator above them."""
    regional = member_in(area, verified=True)
    assign(regional, "4", "province", area.province, ["members.verify"], granted_by=super_admin)
    peer = member_in(area, verified=True)
    assign(peer, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)

    above = change(db_client, auth, activator, regional, "suspend", "conduct_investigation")
    audit = last_audit(db_session)
    beside = change(db_client, auth, activator, peer, "suspend", "conduct_investigation")
    # Suspended by a senior, a peer cannot reinstate them either.
    change(db_client, auth, regional_activator, peer, "suspend", "conduct_investigation")
    reinstate = change(db_client, auth, activator, peer, "reinstate", "investigation_closed")

    for response in (above, beside, reinstate):
        assert (response.status_code, response.json()) == (403, {"detail": "target_outranks_you"})
    assert (audit.action, audit.details["reason"]) == ("access.denied", "target_outranks_you")
    assert db_client.get("/v1/access/me", headers=auth(regional)).json() != []


def test_staff_assignments_need_an_active_membership(db_client, auth, super_admin, member, area):
    proposal = {
        "memberId": str(member.id),
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["members.verify"],
    }

    preview = db_client.post("/v1/access/assignments/preview", json=proposal, headers=auth(super_admin)).json()

    assert "membership_not_active" in preview["problems"]  # verified, but still pending


def test_awaiting_activation_lists_verified_pending_members_in_the_area(
    db_client, db_session, auth, activator, make_reviewer, member, member_in, area
):
    unverified = member_in(area)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = make_reviewer(other_district, permissions=(ACTIVATE,))

    listed = {m["id"] for m in db_client.get("/v1/membership/awaiting-activation", headers=auth(activator)).json()}
    elsewhere = {m["id"] for m in db_client.get("/v1/membership/awaiting-activation", headers=auth(outsider)).json()}

    assert str(member.id) in listed and str(unverified.id) not in listed
    assert str(member.id) not in elsewhere
    change(db_client, auth, activator, member, "activate", "identity_verified")
    after = {m["id"] for m in db_client.get("/v1/membership/awaiting-activation", headers=auth(activator)).json()}
    assert str(member.id) not in after


def test_changes_are_limited_to_the_area_and_never_ones_own(
    db_client, db_session, auth, activator, make_reviewer, member, create_member, area
):
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = make_reviewer(other_district, permissions=(ACTIVATE,))

    outside = change(db_client, auth, outsider, member, "activate", "identity_verified")
    own = change(db_client, auth, activator, activator, "suspend", "member_request")
    no_permission = change(db_client, auth, create_member(verified=True), member, "activate", "identity_verified")

    assert (outside.status_code, outside.json()) == (403, {"detail": "outside_your_area"})
    assert (own.status_code, own.json()) == (403, {"detail": "own_record"})
    assert (no_permission.status_code, no_permission.json()) == (403, {"detail": "forbidden"})
    assert last_audit(db_session).action == "access.denied"


def test_the_history_cannot_be_changed(db_client, db_session, auth, activator, member):
    change(db_client, auth, activator, member, "activate", "identity_verified")

    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("DELETE FROM membership.membership_change WHERE member_id = :id"), {"id": member.id})
