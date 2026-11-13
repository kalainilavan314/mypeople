"""Tests for the My Household module (MP-FEA-002 §4.1 M06 to M10 and D02; BRD v1.1 FR-HH-001 to 010,
BR-098 to 101, PRM-33; OD-30 and OD-31 recommendations)."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app
from app.modules.access.rules import Area
from app.modules.households.rules import (
    ERASED_NAME,
    check_can_correct_relationship,
    check_can_create_household,
    check_can_give_caseworker_consent,
    check_can_invite_adult,
    check_can_manage_dependant,
    check_can_remove_member,
    check_can_respond_invitation,
    check_can_revoke_invitation,
    check_dependant_birth_year,
    household_code,
    log_actor,
    staff_can_view_household,
)

PLATFORM = Area("platform", None)
PROVINCE = Area("province", "LK1")
DISTRICT = Area("district", "LK11")
DISTRICT_PATH = (PLATFORM, PROVINCE, DISTRICT)
OTHER_PATH = (PLATFORM, Area("province", "LK2"), Area("district", "LK21"))
THIS_YEAR = datetime.now(UTC).year


class FakeAssignment:
    def __init__(self, permissions, area):
        self.permissions = frozenset(permissions)
        self.area = area


# -----------------------------------------------------------------------------
# 1. Pure rules
# -----------------------------------------------------------------------------


def test_rule_create_household():
    assert check_can_create_household(None, True) is None
    assert check_can_create_household(uuid.uuid4(), True) == "already_in_household"
    # M06: only an identity-verified member has a household.
    assert check_can_create_household(None, False) == "identity_not_verified"


def test_rule_invite_adult():
    inviter = uuid.uuid4()
    invitee = uuid.uuid4()
    assert check_can_invite_adult("head", 1, inviter, invitee, False) is None
    assert check_can_invite_adult("adult", 1, inviter, invitee, False) == "only_head_can_invite"
    assert check_can_invite_adult("head", 1, inviter, inviter, False) == "cannot_invite_self"
    assert check_can_invite_adult("head", 20, inviter, invitee, False) == "household_size_limit_reached"
    assert check_can_invite_adult("head", 1, inviter, invitee, True) == "invitation_already_pending"


def test_rule_respond_invitation():
    invitee = uuid.uuid4()
    other = uuid.uuid4()
    future = datetime.now(UTC) + timedelta(days=5)
    past = datetime.now(UTC) - timedelta(days=1)
    assert check_can_respond_invitation(invitee, invitee, "pending", future, False) is None
    assert check_can_respond_invitation(invitee, other, "pending", future, False) == "not_your_invitation"
    assert check_can_respond_invitation(invitee, invitee, "pending", past, False) == "invitation_expired"
    assert check_can_respond_invitation(invitee, invitee, "accepted", future, False) == "invitation_accepted"
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
    assert check_can_remove_member(caller, "adult", caller, "adult") is None
    assert check_can_remove_member(caller, "head", target, "adult") is None
    assert check_can_remove_member(caller, "adult", target, "adult") == "only_head_can_remove_members"


def test_rule_dependant_is_a_child_managed_by_its_guardian_or_the_head():
    assert check_dependant_birth_year(THIS_YEAR - 17, THIS_YEAR) is None
    assert check_dependant_birth_year(THIS_YEAR, THIS_YEAR) is None
    assert check_dependant_birth_year(THIS_YEAR - 18, THIS_YEAR) == "dependant_is_adult"
    assert check_dependant_birth_year(THIS_YEAR + 1, THIS_YEAR) == "invalid_birth_year"

    guardian = uuid.uuid4()
    other = uuid.uuid4()
    assert check_can_manage_dependant(guardian, "adult", guardian) is None
    assert check_can_manage_dependant(other, "head", guardian) is None
    assert check_can_manage_dependant(other, "adult", guardian) == "only_guardian_or_head"


def test_rule_corrections_consent_and_log_labels():
    assert check_can_correct_relationship("head", "adult") is None
    assert check_can_correct_relationship("adult", "adult") == "only_head_can_correct"
    assert check_can_correct_relationship("head", "head") == "not_an_adult_record"
    assert check_can_correct_relationship("head", "dependent") == "not_an_adult_record"

    assert check_can_give_caseworker_consent("head") is None
    assert check_can_give_caseworker_consent("adult") == "only_head_can_give_consent"

    me, other = uuid.uuid4(), uuid.uuid4()
    assert log_actor(action="staff_view", actor_id=other, viewer_id=me, actor_is_current_adult=False) == "caseworker"
    assert log_actor(action="update_name", actor_id=me, viewer_id=me, actor_is_current_adult=True) == "you"
    assert log_actor(action="update_name", actor_id=other, viewer_id=me, actor_is_current_adult=True) == "household_member"
    assert log_actor(action="leave_household", actor_id=other, viewer_id=me, actor_is_current_adult=False) == "former_member"

    hid = uuid.UUID("1a2b3c4d-0000-0000-0000-000000000000")
    assert household_code(hid) == "HH-1A2B3C4D"


def test_rule_staff_view_household():
    staff_has_prm = [FakeAssignment(["household.view_for_case"], DISTRICT)]
    staff_no_prm = [FakeAssignment(["audit.view"], DISTRICT)]
    assert staff_can_view_household(staff_has_prm, DISTRICT_PATH) is True
    assert staff_can_view_household(staff_no_prm, DISTRICT_PATH) is False
    assert staff_can_view_household(staff_has_prm, OTHER_PATH) is False


# -----------------------------------------------------------------------------
# 2. API with the database (the test role is a superuser; section 3 runs under row-level security)
# -----------------------------------------------------------------------------


def _code(db_session, member) -> str:
    return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member.id})


def _join(client, db_session, head_headers, adult, adult_headers, relationship="spouse") -> dict:
    invited = client.post(
        "/v1/households/invitations",
        json={"memberCode": _code(db_session, adult), "relationship": relationship},
        headers=head_headers,
    )
    assert invited.status_code == 201, invited.text
    accepted = client.post(
        f"/v1/households/invitations/{invited.json()['id']}/respond", json={"action": "accept"}, headers=adult_headers
    )
    assert accepted.status_code == 200, accepted.text
    return accepted.json()


def test_privacy_notice_returns_voluntary_terms(db_client):
    res = db_client.get("/v1/households/privacy")
    assert res.status_code == 200
    data = res.json()
    assert data["isVoluntary"] is True
    assert "voluntary" in data["noticeEn"].lower()
    assert "விருப்ப" in data["noticeTa"]
    assert "caseworker" in data["purposeLimitationEn"]


def test_household_lifecycle_and_invitations(db_client, db_session, auth, create_member, member_in, area):
    head = member_in(area, verified=True, active=True)
    adult2 = create_member(verified=True, active=True)
    h_head = auth(head)
    h_adult2 = auth(adult2)
    head_code = _code(db_session, head)
    adult2_code = _code(db_session, adult2)

    assert db_client.get("/v1/households/mine", headers=h_head).json() is None

    res = db_client.post("/v1/households", json={"name": "Family Nest"}, headers=h_head)
    assert res.status_code == 201
    hh = res.json()
    assert hh["name"] == "Family Nest"
    assert hh["isHead"] is True and hh["myRole"] == "head"
    assert len(hh["members"]) == 1 and hh["members"][0]["role"] == "head"
    # M06: a short household ID and the District, DS and GN of the creator's area.
    assert hh["householdCode"] == "HH-" + uuid.UUID(hh["id"]).hex[:8].upper()
    assert [(p["level"], p["code"]) for p in hh["places"]] == [("district", area.district), ("ds", area.ds), ("gn", area.gn)]
    assert all(p["nameEn"] for p in hh["places"])

    dup = db_client.post("/v1/households", json={"name": "Another"}, headers=h_head)
    assert dup.status_code == 409 and dup.json()["detail"] == "already_in_household"

    upd = db_client.patch("/v1/households/mine", json={"name": "Our Happy Home"}, headers=h_head)
    assert upd.status_code == 200 and upd.json()["name"] == "Our Happy Home"

    self_inv = db_client.post(
        "/v1/households/invitations", json={"memberCode": head_code, "relationship": "spouse"}, headers=h_head
    )
    assert self_inv.status_code == 400 and self_inv.json()["detail"] == "cannot_invite_self"

    inv_res = db_client.post(
        "/v1/households/invitations", json={"memberCode": adult2_code, "relationship": "spouse"}, headers=h_head
    )
    assert inv_res.status_code == 201
    # M08: a neutral confirmation; nothing about the invitee.
    assert set(inv_res.json()) == {"id", "relationship", "status", "expiresAt"}
    inv_id = inv_res.json()["id"]
    sent = db_client.get("/v1/households/invitations/mine", headers=h_head).json()["sent"]
    assert sent[0]["inviteeCode"] == adult2_code and "inviteeName" not in sent[0]

    received = db_client.get("/v1/households/invitations/mine", headers=h_adult2).json()["received"]
    assert [r["id"] for r in received] == [inv_id] and received[0]["householdName"] == "Our Happy Home"

    dec = db_client.post(f"/v1/households/invitations/{inv_id}/respond", json={"action": "decline"}, headers=h_adult2)
    assert dec.status_code == 200
    assert db_client.get("/v1/households/invitations/mine", headers=h_adult2).json()["received"] == []

    joined_hh = _join(db_client, db_session, h_head, adult2, h_adult2)
    assert len(joined_hh["members"]) == 2
    assert joined_hh["myRole"] == "adult" and joined_hh["isHead"] is False
    assert joined_hh["householdCode"] == hh["householdCode"]

    assert len(db_client.get("/v1/households/mine", headers=h_head).json()["members"]) == 2

    assert db_client.post("/v1/households/leave", headers=h_adult2).status_code == 204
    assert db_client.get("/v1/households/mine", headers=h_adult2).json() is None
    # M10: a departed adult's stored name is erased.
    stored = db_session.scalar(
        text("SELECT display_name FROM household.household_member WHERE member_id = :id"), {"id": adult2.id}
    )
    assert stored == ERASED_NAME


def test_only_identity_verified_members_create_or_join(db_client, db_session, auth, create_member):
    unverified = create_member(verified=False, active=True)
    refused = db_client.post("/v1/households", json={"name": "Home"}, headers=auth(unverified))
    assert refused.status_code == 403 and refused.json()["detail"] == "identity_not_verified"

    head = create_member(verified=True, active=True)
    h_head = auth(head)
    db_client.post("/v1/households", json={"name": "Home"}, headers=h_head)
    invited = db_client.post(
        "/v1/households/invitations",
        json={"memberCode": _code(db_session, unverified), "relationship": "sibling"},
        headers=h_head,
    )
    assert invited.status_code == 201
    accept = db_client.post(
        f"/v1/households/invitations/{invited.json()['id']}/respond", json={"action": "accept"}, headers=auth(unverified)
    )
    assert accept.status_code == 403 and accept.json()["detail"] == "identity_not_verified"
    # Declining is always possible.
    decline = db_client.post(
        f"/v1/households/invitations/{invited.json()['id']}/respond", json={"action": "decline"}, headers=auth(unverified)
    )
    assert decline.status_code == 200


def test_only_the_head_looks_up_member_codes(db_client, db_session, auth, create_member):
    head = create_member(verified=True)
    adult = create_member(verified=True)
    stranger = create_member(verified=True)
    h_head, h_adult = auth(head), auth(adult)
    db_client.post("/v1/households", json={}, headers=h_head)
    _join(db_client, db_session, h_head, adult, h_adult)
    probe = db_client.post(
        "/v1/households/invitations", json={"memberCode": "NO-SUCH-CODE", "relationship": "other"}, headers=h_adult
    )
    assert probe.status_code == 403 and probe.json()["detail"] == "only_head_can_invite"
    probe2 = db_client.post(
        "/v1/households/invitations",
        json={"memberCode": _code(db_session, stranger), "relationship": "other"},
        headers=h_adult,
    )
    assert probe2.status_code == 403


def test_head_leaving_hands_over_to_the_longest_standing_adult(db_client, db_session, auth, create_member):
    head, first, second = (create_member(verified=True) for _ in range(3))
    h_head, h_first, h_second = auth(head), auth(first), auth(second)
    hh = db_client.post("/v1/households", json={"name": "Handover"}, headers=h_head).json()
    _join(db_client, db_session, h_head, first, h_first)
    _join(db_client, db_session, h_head, second, h_second, relationship="sibling")

    assert db_client.post("/v1/households/leave", headers=h_head).status_code == 204
    now = db_client.get("/v1/households/mine", headers=h_first).json()
    assert now["id"] == hh["id"] and now["isHead"] is True and now["dissolvedAt"] is None
    assert {m["memberId"] for m in now["members"]} == {str(first.id), str(second.id)}
    actions = [e["action"] for e in db_client.get("/v1/households/mine/log", headers=h_first).json()]
    assert actions[:2] == ["update_member", "leave_household"]

    # The household ends only when no adult remains.
    assert db_client.post("/v1/households/leave", headers=h_first).status_code == 204
    assert db_client.get("/v1/households/mine", headers=h_second).json()["isHead"] is True
    assert db_client.post("/v1/households/leave", headers=h_second).status_code == 204
    assert db_client.get("/v1/households/mine", headers=h_second).json() is None
    row = db_session.execute(
        text("SELECT name, dissolved_at FROM household.household WHERE id = :id"), {"id": hh["id"]}
    ).one()
    assert row.name is None and row.dissolved_at is not None


def test_children_are_guardian_managed_minimum_records(db_client, db_session, auth, create_member):
    head, parent, other = (create_member(verified=True) for _ in range(3))
    h_head, h_parent, h_other = auth(head), auth(parent), auth(other)
    db_client.post("/v1/households", json={}, headers=h_head)
    _join(db_client, db_session, h_head, parent, h_parent)
    _join(db_client, db_session, h_head, other, h_other, relationship="sibling")

    child = {"firstName": "Kavin", "relationship": "child", "birthYear": THIS_YEAR - 6}
    # Never an ID number, phone or photo: unknown fields are refused, and a name cannot hold digits.
    with_nic = db_client.post("/v1/households/dependants", json={**child, "nic": "200012345678"}, headers=h_parent)
    assert with_nic.status_code == 422
    digits = db_client.post("/v1/households/dependants", json={**child, "firstName": "0771234567"}, headers=h_parent)
    assert digits.status_code == 422
    adult_year = db_client.post(
        "/v1/households/dependants", json={**child, "birthYear": THIS_YEAR - 30}, headers=h_parent
    )
    assert adult_year.status_code == 422 and adult_year.json()["detail"] == "dependant_is_adult"

    added = db_client.post("/v1/households/dependants", json=child, headers=h_parent)
    assert added.status_code == 201, added.text
    kid = next(m for m in added.json()["members"] if m["role"] == "dependent")
    assert kid["displayName"] == "Kavin" and kid["memberId"] is None and kid["memberCode"] is None
    assert kid["guardianMemberId"] == str(parent.id) and kid["birthYear"] == THIS_YEAR - 6

    # Another adult who is not the guardian or the head cannot change it; the guardian and head can.
    refused = db_client.patch(f"/v1/households/dependants/{kid['id']}", json={"firstName": "X"}, headers=h_other)
    assert refused.status_code == 403 and refused.json()["detail"] == "only_guardian_or_head"
    fixed = db_client.patch(
        f"/v1/households/dependants/{kid['id']}", json={"firstName": "Kavinan", "relationship": "grandchild"}, headers=h_parent
    )
    assert fixed.status_code == 200
    kid_now = next(m for m in fixed.json()["members"] if m["id"] == kid["id"])
    assert kid_now["displayName"] == "Kavinan" and kid_now["relationship"] == "grandchild"
    assert db_client.patch(
        f"/v1/households/dependants/{kid['id']}", json={"birthYear": THIS_YEAR - 7}, headers=h_head
    ).status_code == 200

    gone = db_client.delete(f"/v1/households/dependants/{kid['id']}", headers=h_parent)
    assert gone.status_code == 204
    assert db_session.scalar(
        text("SELECT count(*) FROM household.household_member WHERE id = :id"), {"id": kid["id"]}
    ) == 0
    logged = db_session.execute(
        text("SELECT action, details FROM household.consent_log WHERE household_id = :h ORDER BY created_at"),
        {"h": added.json()["id"]},
    ).all()
    actions = [row.action for row in logged]
    assert {"add_dependent", "update_member", "remove_dependent"} <= set(actions)
    # The log holds ids and field names, never the child's name.
    assert all("Kavin" not in str(row.details or {}) for row in logged)

    # A guardian who leaves takes their children's records with them.
    again = db_client.post("/v1/households/dependants", json=child, headers=h_parent).json()
    assert any(m["role"] == "dependent" for m in again["members"])
    assert db_client.post("/v1/households/leave", headers=h_parent).status_code == 204
    after = db_client.get("/v1/households/mine", headers=h_head).json()
    assert not any(m["role"] == "dependent" for m in after["members"])


def test_adults_set_their_own_details_and_the_head_corrects_relationships(db_client, db_session, auth, create_member):
    head, adult = create_member(verified=True), create_member(verified=True)
    h_head, h_adult = auth(head), auth(adult)
    db_client.post("/v1/households", json={}, headers=h_head)
    joined = _join(db_client, db_session, h_head, adult, h_adult)
    adult_record = next(m for m in joined["members"] if m["memberId"] == str(adult.id))

    mine = db_client.patch(
        "/v1/households/members/me", json={"ageBand": "35_44", "occupationCategory": "fishing"}, headers=h_adult
    )
    assert mine.status_code == 200
    me = next(m for m in mine.json()["members"] if m["memberId"] == str(adult.id))
    assert me["ageBand"] == "35_44" and me["occupationCategory"] == "fishing"
    cleared = db_client.patch("/v1/households/members/me", json={"occupationCategory": None}, headers=h_adult).json()
    me = next(m for m in cleared["members"] if m["memberId"] == str(adult.id))
    assert me["ageBand"] == "35_44" and me["occupationCategory"] is None
    assert db_client.patch("/v1/households/members/me", json={"ageBand": "10_17"}, headers=h_adult).status_code == 422

    # The head corrects relationships; nobody else does, and the head's own stays "head".
    refused = db_client.patch(
        f"/v1/households/members/{adult_record['id']}", json={"relationship": "parent"}, headers=h_adult
    )
    assert refused.status_code == 403 and refused.json()["detail"] == "only_head_can_correct"
    fixed = db_client.patch(
        f"/v1/households/members/{adult_record['id']}", json={"relationship": "parent"}, headers=h_head
    )
    assert fixed.status_code == 200
    assert next(m for m in fixed.json()["members"] if m["id"] == adult_record["id"])["relationship"] == "parent"
    head_record = next(m for m in fixed.json()["members"] if m["role"] == "head")
    own = db_client.patch(f"/v1/households/members/{head_record['id']}", json={"relationship": "spouse"}, headers=h_head)
    assert own.status_code == 409 and own.json()["detail"] == "not_an_adult_record"

    log = db_client.get("/v1/households/mine/log", headers=h_adult).json()
    assert log[0]["action"] == "update_member" and log[0]["actor"] == "household_member"
    assert all(set(entry) == {"id", "action", "actor", "actorName", "createdAt"} for entry in log)
    assert any(entry["actor"] == "you" for entry in log)


def test_household_log_is_for_its_own_adults_only(db_client, auth, create_member):
    head, stranger = create_member(verified=True), create_member(verified=True)
    db_client.post("/v1/households", json={}, headers=auth(head))
    assert db_client.get("/v1/households/mine/log", headers=auth(head)).status_code == 200
    outsider = db_client.get("/v1/households/mine/log", headers=auth(stranger))
    assert outsider.status_code == 404 and outsider.json()["detail"] == "no_active_household"


def test_staff_view_needs_area_and_caseworker_consent(
    db_client, db_session, auth, create_member, member_in, assign, super_admin, area
):
    head = member_in(area, verified=True, active=True)
    adult = create_member(verified=True, active=True)
    staff_user = create_member(verified=True, active=True)
    other_staff = create_member(verified=True, active=True)
    far_staff = create_member(verified=True, active=True)
    assign(staff_user, "3B", "district", area.district, ["household.view_for_case"], granted_by=super_admin)
    assign(other_staff, "3B", "district", area.district, ["cases.collect"], granted_by=super_admin)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
        {"d": area.district},
    )
    assign(far_staff, "3B", "district", other_district, ["household.view_for_case"], granted_by=super_admin)
    h_head, h_adult, h_staff = auth(head), auth(adult), auth(staff_user)

    db_client.post("/v1/households", json={"name": "Case Target Household"}, headers=h_head)
    _join(db_client, db_session, h_head, adult, h_adult)
    db_client.post(
        "/v1/households/dependants", json={"firstName": "Mira", "relationship": "child", "birthYear": THIS_YEAR - 3},
        headers=h_adult,
    )

    assert db_client.get(f"/v1/households/staff/{head.id}", headers=auth(other_staff)).status_code == 403
    far = db_client.get(f"/v1/households/staff/{head.id}", headers=auth(far_staff))
    assert far.status_code == 403 and far.json()["detail"] == "outside_your_area"

    # No consent yet: refused and audited. A member without any household gets the same answer.
    no_consent = db_client.get(f"/v1/households/staff/{head.id}", headers=h_staff)
    assert no_consent.status_code == 403 and no_consent.json()["detail"] == "no_caseworker_consent"
    nobody = create_member(verified=True)
    db_session.execute(
        text("UPDATE npm.member SET gs_code = :gn, ds_code = :ds, district_code = :d WHERE id = :id"),
        {"gn": area.gn, "ds": area.ds, "d": area.district, "id": nobody.id},
    )
    assert db_client.get(f"/v1/households/staff/{nobody.id}", headers=h_staff).json()["detail"] == "no_caseworker_consent"
    reasons = db_session.scalars(
        text(
            "SELECT details->>'reason' FROM ops.audit_log WHERE action = 'access.denied' AND actor_id = :id"
        ),
        {"id": staff_user.id},
    ).all()
    assert "no_caseworker_consent" in reasons

    # Giving needs the head; the household's record then opens to the caseworker.
    by_adult = db_client.post("/v1/households/mine/caseworker-consent", headers=h_adult)
    assert by_adult.status_code == 403 and by_adult.json()["detail"] == "only_head_can_give_consent"
    given = db_client.post("/v1/households/mine/caseworker-consent", headers=h_head)
    assert given.status_code == 200 and given.json()["caseworkerConsentAt"] is not None

    view_res = db_client.get(f"/v1/households/staff/{head.id}", headers=h_staff)
    assert view_res.status_code == 200, view_res.text
    data = view_res.json()
    assert data["targetMemberId"] == str(head.id)
    assert data["household"]["name"] == "Case Target Household"
    assert {m["role"] for m in data["household"]["members"]} == {"head", "adult", "dependent"}
    assert "consentLogs" not in data
    head_code = data["targetMemberCode"]
    assert db_client.get(f"/v1/households/staff/{head_code}", headers=h_staff).json()["targetMemberId"] == str(head.id)
    log = db_client.get("/v1/households/mine/log", headers=h_adult).json()
    viewed = [entry for entry in log if entry["action"] == "staff_view"]
    assert viewed and all(entry["actor"] == "caseworker" and entry["actorName"] is None for entry in viewed)

    # Any confirmed adult can withdraw it.
    withdrawn = db_client.delete("/v1/households/mine/caseworker-consent", headers=h_adult)
    assert withdrawn.status_code == 200 and withdrawn.json()["caseworkerConsentAt"] is None
    assert db_client.get(f"/v1/households/staff/{head.id}", headers=h_staff).status_code == 403

    # Consent ends when the adult who gave it leaves.
    db_client.post("/v1/households/mine/caseworker-consent", headers=h_head)
    db_client.post("/v1/households/leave", headers=h_head)
    assert db_client.get("/v1/households/mine", headers=h_adult).json()["caseworkerConsentAt"] is None


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


# -----------------------------------------------------------------------------
# 3. Row-level security: the same API as a role the policies apply to
# -----------------------------------------------------------------------------


@pytest.fixture
def app_role(db_session) -> Iterator[None]:
    """A non-superuser role with ordinary table rights, so PostgreSQL enforces the household
    policies as it does for the production database user. Rolled back with the test."""
    db_session.execute(
        text(
            """
            DO $$
            DECLARE s text;
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
                    CREATE ROLE test_app_user;
                END IF;
                FOR s IN SELECT nspname FROM pg_namespace
                         WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' LOOP
                    EXECUTE format('GRANT USAGE ON SCHEMA %I TO test_app_user', s);
                    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO test_app_user', s);
                    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO test_app_user', s);
                END LOOP;
            END
            $$;
            """
        )
    )
    db_session.execute(text("SET ROLE test_app_user"))
    try:
        yield
    finally:
        db_session.execute(text("RESET ROLE"))


def test_rls_full_household_flow_through_the_api(
    db_client, db_session, auth, create_member, member_in, assign, super_admin, area, request
):
    head = member_in(area, verified=True, active=True)
    adult = create_member(verified=True, active=True)
    stranger = create_member(verified=True, active=True)
    caseworker = create_member(verified=True, active=True)
    assign(caseworker, "3B", "district", area.district, ["household.view_for_case"], granted_by=super_admin)
    h_head, h_adult, h_stranger, h_case = auth(head), auth(adult), auth(stranger), auth(caseworker)
    adult_code = _code(db_session, adult)
    request.getfixturevalue("app_role")
    assert db_session.scalar(text("SELECT current_user")) == "test_app_user"

    created = db_client.post("/v1/households", json={"name": "Policy Home"}, headers=h_head)
    assert created.status_code == 201, created.text
    hid = created.json()["id"]
    assert len(created.json()["places"]) == 3

    invited = db_client.post(
        "/v1/households/invitations", json={"memberCode": adult_code, "relationship": "spouse"}, headers=h_head
    )
    assert invited.status_code == 201, invited.text
    # The invitee sees the household's name before deciding, though not the household itself.
    received = db_client.get("/v1/households/invitations/mine", headers=h_adult).json()["received"]
    assert received[0]["householdName"] == "Policy Home"
    accepted = db_client.post(
        f"/v1/households/invitations/{invited.json()['id']}/respond", json={"action": "accept"}, headers=h_adult
    )
    assert accepted.status_code == 200, accepted.text
    assert len(accepted.json()["members"]) == 2

    # An adult who is not the head adds, corrects and deletes their own child's record.
    added = db_client.post(
        "/v1/households/dependants",
        json={"firstName": "Nila", "relationship": "child", "birthYear": THIS_YEAR - 4},
        headers=h_adult,
    )
    assert added.status_code == 201, added.text
    kid = next(m for m in added.json()["members"] if m["role"] == "dependent")
    assert db_client.patch(
        f"/v1/households/dependants/{kid['id']}", json={"firstName": "Nilani"}, headers=h_adult
    ).status_code == 200
    assert db_client.patch("/v1/households/members/me", json={"ageBand": "25_34"}, headers=h_adult).status_code == 200
    assert db_client.delete(f"/v1/households/dependants/{kid['id']}", headers=h_adult).status_code == 204
    kept = db_client.post(
        "/v1/households/dependants",
        json={"firstName": "Arun", "relationship": "child", "birthYear": THIS_YEAR - 2},
        headers=h_adult,
    )
    assert kept.status_code == 201

    # Nobody outside the household sees any of it, at the API or in the tables.
    assert db_client.get("/v1/households/mine", headers=h_stranger).json() is None
    db_session.execute(text("SELECT set_config('app.current_member_id', :id, true)"), {"id": str(stranger.id)})
    db_session.execute(text("SELECT set_config('app.bypass_rls', '', true)"))
    assert db_session.scalar(text("SELECT count(*) FROM household.household_member WHERE household_id = :h"), {"h": hid}) == 0
    assert db_session.scalar(text("SELECT count(*) FROM household.consent_log WHERE household_id = :h"), {"h": hid}) == 0

    log = db_client.get("/v1/households/mine/log", headers=h_adult)
    assert log.status_code == 200 and len(log.json()) >= 6

    # Caseworker consent: given by the head, read by the caseworker, withdrawn by the other adult.
    assert db_client.get(f"/v1/households/staff/{head.id}", headers=h_case).json()["detail"] == "no_caseworker_consent"
    assert db_client.post("/v1/households/mine/caseworker-consent", headers=h_head).status_code == 200
    seen = db_client.get(f"/v1/households/staff/{head.id}", headers=h_case)
    assert seen.status_code == 200, seen.text
    assert len(seen.json()["household"]["members"]) == 3
    withdrawn = db_client.delete("/v1/households/mine/caseworker-consent", headers=h_adult)
    assert withdrawn.status_code == 200 and withdrawn.json()["caseworkerConsentAt"] is None

    # The head leaves: the adult becomes head and keeps their child; then they leave and it ends.
    assert db_client.post("/v1/households/leave", headers=h_head).status_code == 204
    now = db_client.get("/v1/households/mine", headers=h_adult).json()
    assert now["isHead"] is True and [m["role"] for m in now["members"]] == ["head", "dependent"]
    assert db_client.post("/v1/households/leave", headers=h_adult).status_code == 204
    assert db_client.get("/v1/households/mine", headers=h_adult).json() is None
    # Every request above ran as the policy-bound role.
    assert db_session.scalar(text("SELECT current_user")) == "test_app_user"

    db_session.execute(text("RESET ROLE"))
    left = db_session.execute(
        text("SELECT role, display_name FROM household.household_member WHERE household_id = :h"), {"h": hid}
    ).all()
    assert left and all(row.role != "dependent" and row.display_name == ERASED_NAME for row in left)


def test_rls_direct_query_isolation(db_session, create_member, request):
    member_a = create_member(verified=True, active=True)
    member_b = create_member(verified=True, active=True)
    request.getfixturevalue("app_role")

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
    db_session.execute(
        text(
            "INSERT INTO household.household_member (household_id, role, display_name, relationship, birth_year, "
            "guardian_member_id) VALUES (:hid, 'dependent', 'Kid', 'child', :year, :mid)"
        ),
        {"hid": hh_id, "mid": member_a.id, "year": THIS_YEAR - 5},
    )
    assert db_session.scalar(text("SELECT count(*) FROM household.household WHERE id = :id"), {"id": hh_id}) == 1

    db_session.execute(text("SELECT set_config('app.current_member_id', :id, true)"), {"id": str(member_b.id)})
    assert db_session.scalar(text("SELECT count(*) FROM household.household WHERE id = :id"), {"id": hh_id}) == 0
    assert db_session.scalar(
        text("SELECT count(*) FROM household.household_member WHERE household_id = :id"), {"id": hh_id}
    ) == 0
    # Member B cannot add a child to a household they are not in.
    with pytest.raises(Exception, match="row-level security"), db_session.begin_nested():
        db_session.execute(
            text(
                "INSERT INTO household.household_member (household_id, role, display_name, relationship, birth_year, "
                "guardian_member_id) VALUES (:hid, 'dependent', 'Intruder', 'child', :year, :mid)"
            ),
            {"hid": hh_id, "mid": member_b.id, "year": THIS_YEAR - 5},
        )
