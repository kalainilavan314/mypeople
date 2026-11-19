"""Blood donor network (BRD M37, M38, D27, FR-BLD-001 to 008, BR-139 to 141, OS-15, OD-39)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.engagement.blood_donors import rules
from app.modules.engagement.blood_donors import service as donors_service

NOW = datetime(2026, 11, 19, 6, 0, tzinfo=UTC)


def hidden_and_shown(db_session, schema, table):
    """Rows of a firewalled table seen by an ordinary role with the firewall closed, then open. The test
    user is a superuser, which row-level security never applies to, so the check runs as another role."""
    db_session.execute(text(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_phase3_user') THEN
                CREATE ROLE test_phase3_user;
            END IF;
            GRANT USAGE ON SCHEMA {schema} TO test_phase3_user;
            GRANT SELECT ON ALL TABLES IN SCHEMA {schema} TO test_phase3_user;
        END
        $$;
    """))
    try:
        db_session.execute(text("SET ROLE test_phase3_user"))
        db_session.execute(text(f"SELECT set_config('{schema}.firewall', '', true)"))
        hidden = db_session.scalar(text(f"SELECT count(*) FROM {schema}.{table}"))
        db_session.execute(text(f"SELECT set_config('{schema}.firewall', 'open', true)"))
        shown = db_session.scalar(text(f"SELECT count(*) FROM {schema}.{table}"))
    finally:
        db_session.execute(text("RESET ROLE"))
    return hidden, shown


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def overseer(create_member, assign, super_admin):
    member = create_member(verified=True)
    assign(member, "5", "platform", None, ["donor.oversight"], granted_by=super_admin)
    return member


@pytest.fixture
def partner(client, auth, overseer, area):
    response = client.post("/v1/donors/oversight/partners", json={
        "name": "Jaffna Teaching Hospital blood bank", "kind": "blood_bank", "districtCode": area.district,
        "agreementRef": "NBTS-MOU-2026-04",
    }, headers=auth(overseer))
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def requester(client, auth, overseer, partner, create_member, db_session):
    member = create_member(verified=True)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member.id})
    response = client.post(f"/v1/donors/oversight/partners/{partner['id']}/requesters", json={"memberCode": code},
                           headers=auth(overseer))
    assert response.status_code == 201, response.text
    return member


def donor_body(where, **overrides):
    return {
        "bloodGroup": "O+", "area": {"level": "district", "code": where.district}, "contactName": "Kumar",
        "contactPhone": "0771234567", "contactMethods": ["call", "sms"], "available": True, "pausedUntil": None,
        "consent": True, **overrides,
    }


def enrol(client, auth, member, where, **overrides):
    response = client.put("/v1/donors/me", json=donor_body(where, **overrides), headers=auth(member))
    assert response.status_code == 200, response.text
    return response.json()


def request_body(where, **overrides):
    return {
        "bloodGroup": "O+", "area": {"level": "district", "code": where.district}, "units": 2, "urgency": "urgent",
        "neededBy": (datetime.now(UTC) + timedelta(hours=12)).isoformat(), **overrides,
    }


def raise_request(client, auth, requester, where, **overrides):
    response = client.post("/v1/donors/desk/requests", json=request_body(where, **overrides), headers=auth(requester))
    assert response.status_code == 201, response.text
    return response.json()


# --- Rules ------------------------------------------------------------------------------------------------


def test_the_rules_need_opt_in_a_broad_area_and_consent_to_share():
    assert rules.check_donor(consent=False, area_level="gn", methods=[], paused_until=None, today=NOW.date()) == [
        "consent_required", "broad_area_required", "contact_method_required"]
    assert rules.check_donor(consent=True, area_level="ds", methods=["sms"], paused_until=None, today=NOW.date()) == []
    assert rules.needs_approval(9) is False and rules.needs_approval(10) is True
    common = {"request_state": "open", "needed_by": NOW + timedelta(hours=1), "now": NOW}
    assert rules.check_answer(response_state="notified", accept=True, consent=False, **common) == "consent_required"
    assert rules.check_answer(response_state="notified", accept=False, consent=False, **common) is None
    assert rules.check_answer(response_state="declined", accept=True, consent=True, **common) == "already_answered"
    assert rules.check_answer(response_state="notified", accept=True, consent=True, request_state="open",
                              needed_by=NOW - timedelta(minutes=1), now=NOW) == "request_closed"
    assert rules.notice_state("open", NOW - timedelta(minutes=1), NOW) == "expired"
    assert "health professionals" in rules.MEDICAL_STATEMENT_EN


# --- M37 --------------------------------------------------------------------------------------------------


def test_no_opt_in_means_no_donor_record_and_withdrawal_deletes_at_once(client, auth, member_in, area, db_session):
    member = member_in(area)

    before = client.get("/v1/donors/me", headers=auth(member)).json()
    refused = client.put("/v1/donors/me", json=donor_body(area, consent=False), headers=auth(member))
    gn_level = client.put("/v1/donors/me", json=donor_body(area, area={"level": "gn", "code": area.gn}), headers=auth(member))
    enrolled = enrol(client, auth, member, area)
    withdrawn = client.delete("/v1/donors/me", headers=auth(member))
    again = client.delete("/v1/donors/me", headers=auth(member))

    assert before["donor"] is None and "health professionals" in before["medicalStatementEn"] and len(before["bloodGroups"]) == 8
    assert refused.json()["detail"]["problems"] == ["consent_required"]
    assert gn_level.status_code == 422  # a broad area only
    assert enrolled["bloodGroup"] == "O+" and enrolled["areaKey"] == f"district:{area.district}"
    assert withdrawn.status_code == 204 and again.status_code == 404
    assert client.get("/v1/donors/me", headers=auth(member)).json()["donor"] is None
    db_session.execute(text("SELECT set_config('donors.firewall', 'open', true)"))
    assert db_session.scalar(text("SELECT count(*) FROM donors.donor WHERE member_id = :m"), {"m": member.id}) == 0
    logged = db_session.scalar(text("SELECT count(*) FROM ops.audit_log WHERE action = 'donor.withdrawn' AND actor_id = :m"),
                               {"m": member.id})
    assert logged == 1


# --- D27 and M38 ------------------------------------------------------------------------------------------


def test_members_cannot_raise_requests_and_nothing_lists_donors(client, auth, member_in, area, db_session):
    member = member_in(area, verified=True, active=True)
    enrol(client, auth, member, area)

    raised = client.post("/v1/donors/desk/requests", json=request_body(area), headers=auth(member))
    access = client.get("/v1/donors/desk/access", headers=auth(member)).json()
    oversight = client.get("/v1/donors/oversight", headers=auth(member))

    assert raised.status_code == 403 and raised.json()["detail"] == "not_partner_requester"
    assert access == {"partner": None, "oversight": False}
    assert oversight.status_code == 403
    # FR-BLD-002: no route reads donors except the donor's own.
    paths = [route.path for route in client.app.routes if getattr(route, "path", "").startswith("/v1/donors")]
    assert not any("search" in p or p.endswith("/donors") for p in paths)
    # The firewall: unless the donor module opens it, donor rows are invisible.
    hidden, shown = hidden_and_shown(db_session, "donors", "donor")
    assert hidden == 0 and shown >= 1


def test_matching_donors_are_told_privately_and_the_partner_sees_counts_only(
    client, auth, requester, member_in, area, db_session
):
    matching = member_in(area)
    other_group = member_in(area)
    paused = member_in(area)
    enrol(client, auth, matching, area)
    enrol(client, auth, other_group, area, bloodGroup="A-")
    enrol(client, auth, paused, area, available=False)

    raised = raise_request(client, auth, requester, area)
    desk = client.get("/v1/donors/desk", headers=auth(requester)).json()

    assert raised["state"] == "open" and raised["notified"] >= 1 and raised["contacts"] == []
    assert set(raised) >= {"notified", "accepted", "declined"} and "donors" not in raised
    told = db_session.scalar(text("""SELECT count(*) FROM notifications.notification
                                     WHERE template = 'blood_request_match' AND member_id = ANY(:m)"""),
                             {"m": [matching.id, other_group.id, paused.id]})
    assert told == 1
    mine = client.get("/v1/donors/me", headers=auth(matching)).json()["notices"]
    assert [(n["requestId"], n["answer"], n["state"]) for n in mine] == [(raised["id"], "notified", "open")]
    assert mine[0]["partnerName"] == "Jaffna Teaching Hospital blood bank"
    assert client.get(f"/v1/donors/me/requests/{raised['id']}", headers=auth(other_group)).status_code == 404
    assert desk["partner"]["name"] == "Jaffna Teaching Hospital blood bank" and desk["requestsPerHour"] == 10


def test_contact_reaches_the_partner_only_after_the_donor_accepts_and_consents(
    client, auth, requester, member_in, area, db_session
):
    accepting, declining = member_in(area), member_in(area)
    enrol(client, auth, accepting, area, contactName="Kumar")
    enrol(client, auth, declining, area, contactName="Selvi", contactPhone="0779999999")
    raised = raise_request(client, auth, requester, area)

    no_consent = client.post(f"/v1/donors/me/requests/{raised['id']}/answer", json={"accept": True, "consent": False},
                             headers=auth(accepting))
    declined = client.post(f"/v1/donors/me/requests/{raised['id']}/answer", json={"accept": False, "consent": False},
                           headers=auth(declining))
    accepted = client.post(f"/v1/donors/me/requests/{raised['id']}/answer", json={"accept": True, "consent": True},
                           headers=auth(accepting))
    twice = client.post(f"/v1/donors/me/requests/{raised['id']}/answer", json={"accept": False, "consent": False},
                        headers=auth(accepting))
    detail = client.get(f"/v1/donors/desk/requests/{raised['id']}", headers=auth(requester)).json()

    assert no_consent.json()["detail"]["problems"] == ["consent_required"]
    assert declined.json()["answer"] == "declined" and accepted.json()["answer"] == "accepted"
    assert twice.json()["detail"]["problems"] == ["already_answered"]
    assert (detail["accepted"], detail["declined"]) == (1, 1)
    assert [(c["name"], c["phone"]) for c in detail["contacts"]] == [("Kumar", "0771234567")]  # never Selvi
    told = db_session.scalar(text("""SELECT count(*) FROM notifications.notification
                                     WHERE template = 'blood_donor_accepted' AND member_id = :m"""), {"m": requester.id})
    assert told == 1


def test_a_closed_or_expired_request_can_no_longer_be_answered(client, auth, requester, member_in, area, db_session):
    donor = member_in(area)
    enrol(client, auth, donor, area)
    raised = raise_request(client, auth, requester, area)

    closed = client.post(f"/v1/donors/desk/requests/{raised['id']}/close", json={"outcome": "fulfilled"},
                         headers=auth(requester))
    late = client.post(f"/v1/donors/me/requests/{raised['id']}/answer", json={"accept": True, "consent": True},
                       headers=auth(donor))

    assert closed.json()["state"] == "closed" and closed.json()["outcome"] == "fulfilled"
    assert late.json()["detail"]["problems"] == ["request_closed"]
    assert client.get(f"/v1/donors/me/requests/{raised['id']}", headers=auth(donor)).json()["state"] == "closed"


def test_more_than_ten_requests_an_hour_wait_for_tier_5_approval(
    client, auth, requester, overseer, member_in, area, db_session, create_member, assign, super_admin
):
    for _ in range(rules.REQUESTS_PER_HOUR):
        raise_request(client, auth, requester, area)
    eleventh = raise_request(client, auth, requester, area)
    second_overseer = create_member(verified=True)
    assign(second_overseer, "5", "platform", None, ["donor.oversight"], granted_by=super_admin)

    waiting = client.get("/v1/donors/oversight", headers=auth(overseer)).json()["awaiting"]
    no_reason = client.post(f"/v1/donors/oversight/requests/{eleventh['id']}/decision", json={"approve": False},
                            headers=auth(overseer))
    approved = client.post(f"/v1/donors/oversight/requests/{eleventh['id']}/decision", json={"approve": True},
                           headers=auth(second_overseer))
    audited = db_session.scalar(text("SELECT count(*) FROM ops.audit_log WHERE action = 'donor.request.raised' AND actor_id = :m"),
                                {"m": requester.id})

    assert eleventh["state"] == "awaiting_approval" and eleventh["overLimit"] is True and eleventh["notified"] == 0
    assert [q["id"] for q in waiting] == [eleventh["id"]]
    assert no_reason.json()["detail"]["problems"] == ["reason_required"]
    assert approved.json()["state"] == "open"
    assert audited == rules.REQUESTS_PER_HOUR + 1
    told = db_session.scalar(text("""SELECT count(*) FROM notifications.notification
                                     WHERE template = 'blood_request_over_limit' AND member_id = :m"""), {"m": overseer.id})
    assert told == 1


def test_a_donor_is_asked_at_most_once_a_day(client, auth, requester, member_in, area, db_session):
    donor = member_in(area)
    enrol(client, auth, donor, area)

    first = raise_request(client, auth, requester, area)
    second = raise_request(client, auth, requester, area)

    assert first["notified"] >= 1
    notices = client.get("/v1/donors/me", headers=auth(donor)).json()["notices"]
    assert [n["requestId"] for n in notices] == [first["id"]] and second["id"] not in [n["requestId"] for n in notices]


def test_partners_authorise_only_verified_accounts_and_a_revoked_requester_is_refused(
    client, auth, overseer, partner, requester, member_in, area, db_session
):
    unverified = member_in(area)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": unverified.id})
    refused = client.post(f"/v1/donors/oversight/partners/{partner['id']}/requesters", json={"memberCode": code},
                          headers=auth(overseer))
    listing = client.get("/v1/donors/oversight", headers=auth(overseer)).json()
    authorised = next(r for r in listing["requesters"] if r["revokedAt"] is None)
    access = client.get("/v1/donors/desk/access", headers=auth(requester)).json()
    client.post(f"/v1/donors/oversight/requesters/{authorised['id']}/revoke", headers=auth(overseer))
    after = client.post("/v1/donors/desk/requests", json=request_body(area), headers=auth(requester))

    assert refused.json()["detail"]["problems"] == ["identity_not_verified"]
    assert access["partner"]["id"] == partner["id"]
    assert after.status_code == 403


def test_requests_are_deleted_after_twelve_months(client, auth, requester, area, db_session):
    raised = raise_request(client, auth, requester, area)
    db_session.execute(text("SELECT set_config('donors.firewall', 'open', true)"))
    db_session.execute(text("UPDATE donors.request SET created_at = now() - interval '366 days' WHERE id = :id"),
                       {"id": raised["id"]})

    removed = donors_service.purge(db_session, datetime.now(UTC))

    assert removed >= 1
    db_session.execute(text("SELECT set_config('donors.firewall', 'open', true)"))
    assert db_session.scalar(text("SELECT count(*) FROM donors.request WHERE id = :id"), {"id": raised["id"]}) == 0


def test_a_paused_donor_is_not_asked_until_after_the_date(client, auth, requester, member_in, area):
    donor = member_in(area)
    enrol(client, auth, donor, area, pausedUntil=(date.today() + timedelta(days=30)).isoformat())

    raised = raise_request(client, auth, requester, area)

    assert raised["id"] not in [n["requestId"] for n in client.get("/v1/donors/me", headers=auth(donor)).json()["notices"]]
