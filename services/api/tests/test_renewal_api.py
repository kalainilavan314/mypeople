"""Membership renewal (M33, D25, FR-RNW-001 to 003, 009, BR-136, OD-43) against the real API."""

import random
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app
from app.modules.membership.renewal import service as renewal
from app.modules.membership.renewal.service import RenewalRun


@pytest.fixture
def client(db_client):
    return db_client


def confirm_number(db_session, member) -> None:
    """Test set-up: a mobile number confirmed by a code, as /v1/identity/me/phone/confirm records it."""
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": f"+9477{random.randrange(10**6, 10**7)}"},
    )


def set_due(db_session, member, days_from_today: int) -> None:
    db_session.execute(
        text("UPDATE membership.renewal_cycle SET due_on = :due WHERE member_id = :id AND state = 'open'"),
        {"id": member.id, "due": renewal.today() + timedelta(days=days_from_today)},
    )


def switch_renewal(db_session, on: bool) -> None:
    db_session.execute(
        text(
            """
            INSERT INTO ops.feature_flag (key, enabled, gate, gate_recorded_at) VALUES ('renewal', :on, 'G3', now())
            ON CONFLICT (key) DO UPDATE SET enabled = :on, gate = 'G3', gate_recorded_at = now()
            """
        ),
        {"on": on},
    )


def notices(db_session, member) -> list[str]:
    return list(db_session.scalars(
        text("SELECT template FROM notifications.notification WHERE member_id = :id ORDER BY created_at"),
        {"id": member.id},
    ))


@pytest.fixture
def renewing(member_in, area, db_session):
    member = member_in(area, verified=True, active=True)
    confirm_number(db_session, member)
    return member


def test_renewal_asks_only_for_contact_and_area_and_never_a_document(client, auth, renewing, db_session):
    early = client.get("/v1/membership/renewal/me", headers=auth(renewing)).json()
    refused_early = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": True},
                                headers=auth(renewing))
    set_due(db_session, renewing, 10)
    due = client.get("/v1/membership/renewal/me", headers=auth(renewing)).json()
    unticked = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": False, "areaConfirmed": True},
                           headers=auth(renewing))
    confirmed = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": True},
                            headers=auth(renewing))

    # Activated today: the first yearly check falls due a year from now.
    assert early["applies"] and early["phase"] == "upcoming" and not early["canConfirm"]
    assert early["cycle"]["dueOn"] == (renewal.today() + timedelta(days=365)).isoformat() or early["cycle"]["dueOn"] == (
        renewal.today() + timedelta(days=366)).isoformat()
    assert refused_early.json()["detail"]["problems"] == ["not_due_yet"]
    assert due["phase"] == "due" and due["canConfirm"] and due["graceDays"] == 60
    assert due["mobileMasked"].startswith("+9477") and "*" in due["mobileMasked"]
    assert unticked.json()["detail"]["problems"] == ["contact_confirmation_required"]
    assert confirmed.status_code == 200, confirmed.json()
    body = confirmed.json()
    assert body["phase"] == "upcoming" and body["history"][0]["state"] == "confirmed"
    old_due = renewal.today() + timedelta(days=10)
    assert body["cycle"]["dueOn"] == old_due.replace(year=old_due.year + 1).isoformat()
    # BR-136: nothing about documents, images or selfies anywhere in the renewal.
    assert not any(word in confirmed.text.lower() for word in ("nic", "passport", "selfie", "document"))
    audited = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'membership.renewal.confirmed' AND actor_id = :id"),
        {"id": renewing.id},
    ).scalar_one()
    assert audited["area"] == "confirmed"


def test_without_a_number_confirmed_by_code_the_renewal_waits(client, auth, member_in, area, db_session):
    member = member_in(area, verified=True, active=True)
    client.get("/v1/membership/renewal/me", headers=auth(member))
    set_due(db_session, member, 3)

    refused = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": True},
                          headers=auth(member))
    no_area = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": False},
                          headers=auth(member))

    assert refused.json()["detail"]["problems"] == ["contact_not_confirmed"]
    assert no_area.json()["detail"]["problems"] == ["contact_not_confirmed", "area_confirmation_required"]


def test_renewal_does_not_apply_before_activation_or_while_suspended(client, auth, member_in, area, db_session):
    pending = member_in(area, verified=True)
    suspended = member_in(area, verified=True, active=True)
    db_session.execute(text("UPDATE membership.membership SET state = 'suspended' WHERE member_id = :id"),
                       {"id": suspended.id})

    for member, reason in ((pending, "membership_pending"), (suspended, "membership_suspended")):
        mine = client.get("/v1/membership/renewal/me", headers=auth(member)).json()
        refused = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": True},
                              headers=auth(member))
        assert (mine["applies"], mine["reason"], mine["cycle"]) == (False, reason, None)
        assert refused.json()["detail"]["problems"] == [reason]


def test_the_task_does_nothing_while_renewal_is_switched_off(db_session, renewing):
    switch_renewal(db_session, False)
    assert renewal.run(db_session, datetime.now(UTC)) == RenewalRun()
    assert db_session.scalar(text("SELECT count(*) FROM membership.renewal_cycle WHERE member_id = :id"),
                             {"id": renewing.id}) == 0


def test_notices_at_thirty_and_seven_days_then_a_lapse_and_a_simple_reactivation(client, auth, renewing, db_session):
    switch_renewal(db_session, True)
    now = datetime.now(UTC)
    renewal.run(db_session, now)  # opens the cycle
    set_due(db_session, renewing, 20)
    renewal.run(db_session, now)
    renewal.run(db_session, now)  # never twice
    set_due(db_session, renewing, 5)
    renewal.run(db_session, now)
    assert notices(db_session, renewing) == ["renewal_due_30", "renewal_due_7"]

    set_due(db_session, renewing, -61)
    renewal.run(db_session, now)
    state = db_session.execute(text("SELECT state, reason_code, changed_by FROM membership.membership WHERE member_id = :id"),
                               {"id": renewing.id}).one()
    lapsed = client.get("/v1/membership/renewal/me", headers=auth(renewing)).json()
    reactivated = client.post("/v1/membership/renewal/me/confirm", json={"contactConfirmed": True, "areaConfirmed": True},
                              headers=auth(renewing))
    after = db_session.execute(text("SELECT state, reason_code FROM membership.membership WHERE member_id = :id"),
                               {"id": renewing.id}).one()

    assert tuple(state) == ("inactive", "renewal_lapsed", None)
    assert notices(db_session, renewing)[-2:] == ["renewal_lapsed", "membership_changed"]
    assert lapsed["applies"] and lapsed["reactivation"] and lapsed["phase"] == "lapsed" and lapsed["canConfirm"]
    assert reactivated.status_code == 200, reactivated.json()
    assert tuple(after) == ("active", "renewal_confirmed")
    assert reactivated.json()["cycle"]["dueOn"] == renewal.today().replace(year=renewal.today().year + 1).isoformat()
    # Reading the inbox shows nothing left to do for renewal.
    waiting = db_session.scalar(
        text("""SELECT count(*) FROM notifications.notification WHERE member_id = :id AND target_kind = 'renewal'
                AND action_required AND action_done_at IS NULL"""),
        {"id": renewing.id},
    )
    assert waiting == 0


def test_a_staff_inactivation_is_not_undone_by_confirming(client, auth, renewing, db_session):
    db_session.execute(
        text("UPDATE membership.membership SET state = 'inactive', reason_code = 'member_request' WHERE member_id = :id"),
        {"id": renewing.id},
    )
    mine = client.get("/v1/membership/renewal/me", headers=auth(renewing)).json()
    assert (mine["applies"], mine["reason"]) == (False, "membership_inactive")


def test_the_due_list_shows_only_members_in_the_staff_members_areas(client, auth, renewing, area, create_member,
                                                                    assign, super_admin, db_session):
    client.get("/v1/membership/renewal/me", headers=auth(renewing))
    set_due(db_session, renewing, 12)
    district_officer = create_member(verified=True)
    assign(district_officer, "3B", "district", area.district, ["certificate.issue_revoke"], granted_by=super_admin)
    elsewhere = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
        {"d": area.district},
    )
    other_officer = create_member(verified=True)
    assign(other_officer, "3B", "district", elsewhere, ["certificate.issue_revoke"], granted_by=super_admin)
    plain = create_member(verified=True, active=True)

    listed = client.get("/v1/membership/renewal/manage", params={"phase": "due"}, headers=auth(district_officer)).json()
    summary = client.get("/v1/membership/renewal/manage/summary", headers=auth(district_officer)).json()
    other = client.get("/v1/membership/renewal/manage", params={"phase": "due"}, headers=auth(other_officer)).json()
    refused = client.get("/v1/membership/renewal/manage", headers=auth(plain))

    mine = [row for row in listed if row["memberId"] == str(renewing.id)]
    assert len(mine) == 1 and mine[0]["phase"] == "due" and mine[0]["areaKey"] == f"gn:{area.gn}"
    assert summary["due"] >= 1 and summary["graceDays"] == 60
    assert str(renewing.id) not in {row["memberId"] for row in other}
    assert refused.status_code == 403


def test_renewal_answers_not_found_while_switched_off_in_production(database_settings, db_session, auth, renewing):
    switch_renewal(db_session, False)
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    closed = TestClient(app)

    assert closed.get("/v1/membership/renewal/me", headers=auth(renewing)).json() == {"detail": "feature_unavailable"}
    assert closed.get("/v1/public/certificates/abcdefghijklmnop").status_code == 404
