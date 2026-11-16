"""Tests for the My Household module (BRD v1.1 FR-HH-001 to 010, BR-098 to 101, PRM-33)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app
from app.modules.access.rules import Area, AreaPath
from app.modules.households import rules
from app.modules.households.rules import (
    check_can_create_household,
    check_can_invite_adult,
    check_can_remove_member,
    check_can_respond_invitation,
    check_can_revoke_invitation,
    staff_can_view_household,
)

PLATFORM = Area("platform", None)
PROVINCE = Area("province", "LK1")
DISTRICT = Area("district", "LK11")
DISTRICT_PATH = (PLATFORM, PROVINCE, DISTRICT)
OTHER_PATH = (PLATFORM, Area("province", "LK2"), Area("district", "LK21"))


class FakeAssignment:
    def __init__(self, permissions, area):
        self.permissions = frozenset(permissions)
        self.area = area


# -----------------------------------------------------------------------------
# 1. Pure Rules Unit Tests
# -----------------------------------------------------------------------------


def test_rule_create_household():
    assert check_can_create_household(None) is None
    assert check_can_create_household(uuid.uuid4()) == "already_in_household"


def test_rule_invite_adult():
    inviter = uuid.uuid4()
    invitee = uuid.uuid4()

    # Successful head invite
    assert check_can_invite_adult("head", 1, inviter, invitee, False, False) is None

    # Only head can invite
    assert check_can_invite_adult("adult", 1, inviter, invitee, False, False) == "only_head_can_invite"

    # Cannot invite self
    assert check_can_invite_adult("head", 1, inviter, inviter, False, False) == "cannot_invite_self"

    # Max members limit
    assert check_can_invite_adult("head", 20, inviter, invitee, False, False) == "household_size_limit_reached"

    # Invitee already in a household
    assert check_can_invite_adult("head", 1, inviter, invitee, True, False) == "invitee_already_in_household"

    # Invitee already has a pending invitation
    assert check_can_invite_adult("head", 1, inviter, invitee, False, True) == "invitation_already_pending"


def test_rule_respond_invitation():
    invitee = uuid.uuid4()
    other = uuid.uuid4()
    future = datetime.now(UTC) + timedelta(days=5)
    past = datetime.now(UTC) - timedelta(days=1)

    # Valid response
    assert check_can_respond_invitation(invitee, invitee, "pending", future, False) is None

    # Wrong member responding
    assert check_can_respond_invitation(invitee, other, "pending", future, False) == "not_your_invitation"

    # Expired invitation
    assert check_can_respond_invitation(invitee, invitee, "pending", past, False) == "invitation_expired"

    # Non-pending status
    assert check_can_respond_invitation(invitee, invitee, "accepted", future, False) == "invitation_accepted"

    # Invitee already joined another household
    assert check_can_respond_invitation(invitee, invitee, "pending", future, True) == "already_in_household"


def test_rule_revoke_invitation():
    inviter = uuid.uuid4()
    other = uuid.uuid4()

    assert check_can_revoke_invitation(inviter, inviter, "head", "pending") is None
    assert check_can_revoke_invitation(other, inviter, "adult", "pending") == "only_inviter_or_head_can_revoke"
    assert check_can_revoke_invitation(inviter, inviter, "head", "accepted") == "invitation_accepted"


def test_rule_remove_member():
    caller = uuid.uuid4()
    target = uuid.uuid4()

    # Member leaves themselves
    assert check_can_remove_member(caller, "adult", caller, "adult") is None
    # Head removes an adult
    assert check_can_remove_member(caller, "head", target, "adult") is None
    # Adult cannot remove another member
    assert check_can_remove_member(caller, "adult", target, "adult") == "only_head_can_remove_members"


def test_rule_staff_view_household():
    staff_has_prm = [FakeAssignment(["household.view_for_case"], DISTRICT)]
    staff_no_prm = [FakeAssignment(["audit.view"], DISTRICT)]

    # Staff with permission in area
    assert staff_can_view_household(staff_has_prm, DISTRICT_PATH) is True
    # Staff without permission
    assert staff_can_view_household(staff_no_prm, DISTRICT_PATH) is False
    # Staff with permission outside area
    assert staff_can_view_household(staff_has_prm, OTHER_PATH) is False


# -----------------------------------------------------------------------------
# 2. API End-to-End Database Tests
# -----------------------------------------------------------------------------


def test_privacy_notice_returns_voluntary_terms(db_client):
    res = db_client.get("/v1/households/privacy")
    assert res.status_code == 200
    data = res.json()
    assert data["isVoluntary"] is True
    assert "voluntary" in data["noticeEn"].lower()
    assert "விருப்ப" in data["noticeTa"]


def test_household_lifecycle_and_invitations(db_client, db_session, auth, create_member):
    head = create_member(verified=True, active=True)
    adult2 = create_member(verified=True, active=True)
    h_head = auth(head)
    h_adult2 = auth(adult2)

    def get_code(mid):
        return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": mid})

    head_code = get_code(head.id)
    adult2_code = get_code(adult2.id)

    # 1. No household initially
    res = db_client.get("/v1/households/mine", headers=h_head)
    assert res.status_code == 200
    assert res.json() is None

    # 2. Create household
    res = db_client.post("/v1/households", json={"name": "Family Nest"}, headers=h_head)
    assert res.status_code == 201
    hh = res.json()
    assert hh["name"] == "Family Nest"
    assert hh["isHead"] is True
    assert hh["myRole"] == "head"
    assert len(hh["members"]) == 1
    assert hh["members"][0]["role"] == "head"

    # Cannot create second household
    dup = db_client.post("/v1/households", json={"name": "Another"}, headers=h_head)
    assert dup.status_code == 409
    assert dup.json()["detail"] == "already_in_household"

    # 3. Update household name
    upd = db_client.patch("/v1/households/mine", json={"name": "Our Happy Home"}, headers=h_head)
    assert upd.status_code == 200
    assert upd.json()["name"] == "Our Happy Home"

    # 4. Invite adult2
    # Cannot invite self
    self_inv = db_client.post(
        "/v1/households/invitations",
        json={"memberCode": head_code, "relationship": "spouse"},
        headers=h_head,
    )
    assert self_inv.status_code == 400
    assert self_inv.json()["detail"] == "cannot_invite_self"

    # Invite adult2
    inv_res = db_client.post(
        "/v1/households/invitations",
        json={"memberCode": adult2_code, "relationship": "spouse"},
        headers=h_head,
    )
    assert inv_res.status_code == 201
    inv_id = inv_res.json()["id"]

    # Invitee sees invitation
    mine_invs = db_client.get("/v1/households/invitations/mine", headers=h_adult2).json()
    assert len(mine_invs["received"]) == 1
    assert mine_invs["received"][0]["id"] == inv_id

    # 5. Invitee declines
    dec = db_client.post(f"/v1/households/invitations/{inv_id}/respond", json={"action": "decline"}, headers=h_adult2)
    assert dec.status_code == 200

    # Invitee has 0 pending now
    assert len(db_client.get("/v1/households/invitations/mine", headers=h_adult2).json()["received"]) == 0

    # 6. Re-invite and accept
    inv_res2 = db_client.post(
        "/v1/households/invitations",
        json={"memberCode": adult2_code, "relationship": "spouse"},
        headers=h_head,
    )
    assert inv_res2.status_code == 201
    inv2_id = inv_res2.json()["id"]

    acc = db_client.post(f"/v1/households/invitations/{inv2_id}/respond", json={"action": "accept"}, headers=h_adult2)
    assert acc.status_code == 200
    joined_hh = acc.json()
    assert len(joined_hh["members"]) == 2
    assert joined_hh["myRole"] == "adult"
    assert joined_hh["isHead"] is False

    # 7. The adult membership is the complete approved household flow.
    curr_hh = db_client.get("/v1/households/mine", headers=h_head).json()
    assert len(curr_hh["members"]) == 2

    # 8. Adult leaves household voluntarily
    leave_res = db_client.post("/v1/households/leave", headers=h_adult2)
    assert leave_res.status_code == 204

    # Adult has no household now
    assert db_client.get("/v1/households/mine", headers=h_adult2).json() is None


def test_staff_view_household_with_prm33(db_client, auth, create_member, member_in, assign, super_admin, area):
    head = member_in(area, verified=True, active=True)
    staff_user = create_member(verified=True, active=True)
    other_staff = create_member(verified=True, active=True)

    # Assign PRM-33 to staff_user for area.district
    assign(staff_user, "3B", "district", area.district, ["household.view_for_case"], granted_by=super_admin)
    # Assign staff without PRM-33
    assign(other_staff, "3B", "district", area.district, ["cases.collect"], granted_by=super_admin)

    h_head = auth(head)
    h_staff = auth(staff_user)
    h_other = auth(other_staff)

    # Create household
    db_client.post("/v1/households", json={"name": "Case Target Household"}, headers=h_head)

    # Unauthorized staff without PRM-33
    unauth = db_client.get(f"/v1/households/staff/{head.id}", headers=h_other)
    assert unauth.status_code == 403

    # Permitted staff view
    view_res = db_client.get(f"/v1/households/staff/{head.id}", headers=h_staff)
    assert view_res.status_code == 200
    data = view_res.json()
    assert data["permitted"] is True
    assert data["targetMemberId"] == str(head.id)
    assert data["household"]["name"] == "Case Target Household"
    assert len(data["household"]["members"]) == 1
    # Check that staff_view consent log is recorded
    assert any(log["action"] == "staff_view" for log in data["consentLogs"])

    # Permitted staff view by member code
    head_code = data["targetMemberCode"]
    view_by_code = db_client.get(f"/v1/households/staff/{head_code}", headers=h_staff)
    assert view_by_code.status_code == 200
    assert view_by_code.json()["targetMemberId"] == str(head.id)


@pytest.fixture
def enforced(database_settings, db_session) -> TestClient:
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


def test_households_feature_gated_in_enforced_mode(enforced, auth, create_member):
    member = create_member(verified=True, active=True)
    res = enforced.get("/v1/households/mine", headers=auth(member))
    assert res.status_code == 404
    assert res.json()["detail"] == "feature_unavailable"


def test_rls_direct_query_isolation(db_session, create_member):
    member_a = create_member(verified=True, active=True)
    member_b = create_member(verified=True, active=True)

    db_session.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
                    CREATE ROLE test_app_user;
                END IF;
                GRANT USAGE ON SCHEMA household TO test_app_user;
                GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA household TO test_app_user;
                GRANT USAGE ON SCHEMA npm TO test_app_user;
            END
            $$;
            """
        )
    )

    try:
        # Switch to non-superuser role so PostgreSQL enforces RLS
        db_session.execute(text("SET ROLE test_app_user"))

        # Set context for member_a and create household
        db_session.execute(text("SELECT set_config('app.current_member_id', :id, true)"), {"id": str(member_a.id)})
        hh_id = db_session.scalar(
            text("INSERT INTO household.household (created_by, name) VALUES (:id, 'A House') RETURNING id"),
            {"id": member_a.id},
        )
        db_session.execute(
            text(
                "INSERT INTO household.household_member (household_id, member_id, role, display_name, relationship) "
                "VALUES (:hid, :mid, 'head', 'Member A', 'head')"
            ),
            {"hid": hh_id, "mid": member_a.id},
        )

        # Member A can see their household
        can_see_a = db_session.scalar(
            text("SELECT count(*) FROM household.household WHERE id = :id"),
            {"id": hh_id},
        )
        assert can_see_a == 1

        # Switch to Member B context
        db_session.execute(text("SELECT set_config('app.current_member_id', :id, true)"), {"id": str(member_b.id)})
        # Member B cannot see member A's household through RLS
        can_see_b = db_session.scalar(
            text("SELECT count(*) FROM household.household WHERE id = :id"),
            {"id": hh_id},
        )
        assert can_see_b == 0
    finally:
        db_session.execute(text("RESET ROLE"))
