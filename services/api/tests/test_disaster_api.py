"""Disaster and emergency support (BRD M35, M36, S16, D26, FR-DIS-001 to 008, BR-138, OS-14)."""

import re
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.modules.assistance.alerts import rules
from app.modules.assistance.alerts import service as alerts_service
from app.modules.assistance.relief import rules as relief_rules

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
def elsewhere(db_session, area):
    """A GN division in another district."""
    return db_session.execute(
        text(
            """SELECT d.province_code AS province, ds.district_code AS district, ds.ds_code AS ds, g.gn_code AS gn
               FROM geo.gn_division g JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
               JOIN geo.district d ON d.district_code = ds.district_code
               WHERE ds.district_code <> :district ORDER BY g.gn_code LIMIT 1"""
        ),
        {"district": area.district},
    ).one()


@pytest.fixture
def staff(create_member, assign, area, super_admin):
    def person(tier, level, code, permissions):
        member = create_member(verified=True)
        assign(member, tier, level, code, permissions, granted_by=super_admin)
        return member

    return {
        "relayer": person("3B", "district", area.district, ["disaster.relay"]),
        "second_relayer": person("3B", "district", area.district, ["disaster.relay"]),
        "officer": person("2B", "ds", area.ds, ["relief.logistics", "assistance.intake"]),
        "coordinator": person("3B", "district", area.district, ["relief.logistics"]),
    }


def alert_body(area, **overrides):
    now = datetime.now(UTC)
    return {
        "sourceKey": "dmc", "sourceUrl": "https://www.dmc.gov.lk/index.php?option=com_dmcreports&report=flood",
        "sourceIssuedAt": (now - timedelta(minutes=20)).isoformat(), "sourceEndsAt": (now + timedelta(days=1)).isoformat(),
        "hazard": "flood", "severity": "watch",
        "titleEn": "Flood watch for low-lying areas", "titleTa": "தாழ்நிலப் பகுதிகளுக்கு வெள்ள எச்சரிக்கை",
        "bodyEn": "River levels are rising. Move valuables to higher ground and follow official instructions.",
        "bodyTa": "ஆற்று நீர்மட்டம் உயர்கிறது. பெறுமதியான பொருட்களை உயரமான இடத்துக்கு மாற்றுங்கள்.",
        "targets": [{"level": "gn", "code": area.gn}], **overrides,
    }


def relay(client, auth, relayer, area, **overrides):
    response = client.post("/v1/alerts/manage", json=alert_body(area, **overrides), headers=auth(relayer))
    assert response.status_code == 201, response.text
    return response.json()


def notices(db_session, member, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :m AND template = :t"),
        {"m": member.id, "t": template},
    )


# --- Rules ------------------------------------------------------------------------------------------------


def test_only_an_official_source_and_its_own_link_are_accepted():
    dmc = rules.SOURCES["dmc"]
    assert rules.link_from(dmc, "https://www.dmc.gov.lk/alerts/1")
    assert rules.link_from(dmc, "https://dmc.gov.lk/")
    assert not rules.link_from(dmc, "http://www.dmc.gov.lk/alerts/1")  # not https
    assert not rules.link_from(dmc, "https://dmc.gov.lk.example.com/")  # someone else's address
    assert not rules.link_from(dmc, "https://facebook.com/dmc.gov.lk")
    issued, ends = NOW - timedelta(minutes=5), NOW + timedelta(hours=12)
    assert rules.check_alert(source_key="dmc", source_url="https://dmc.gov.lk/a", issued_at=issued, ends_at=ends, now=NOW) == []
    assert rules.check_alert(source_key="district_secretariat", source_url="https://jaffna.dist.gov.lk/",
                             issued_at=issued, ends_at=ends, now=NOW) == ["unofficial_source"]
    assert rules.check_alert(source_key="meteorology", source_url="https://dmc.gov.lk/a", issued_at=issued, ends_at=ends,
                             now=NOW) == ["link_not_from_source"]
    assert rules.check_alert(source_key="dmc", source_url="https://dmc.gov.lk/a", issued_at=NOW + timedelta(hours=1),
                             ends_at=NOW + timedelta(hours=2), now=NOW) == ["issued_in_future"]
    assert rules.check_alert(source_key="dmc", source_url="https://dmc.gov.lk/a", issued_at=issued,
                             ends_at=NOW - timedelta(minutes=1), now=NOW) == ["already_ended"]
    assert rules.check_alert(source_key="dmc", source_url="https://dmc.gov.lk/a", issued_at=issued,
                             ends_at=issued + timedelta(days=15), now=NOW) == ["alert_too_long"]


def test_alerts_expire_at_the_source_end_time_and_go_stale_after_six_hours():
    ends = NOW + timedelta(hours=1)
    assert rules.is_current("active", ends, NOW) and not rules.is_current("active", ends, ends)
    assert not rules.is_current("withdrawn", ends, NOW)
    assert not rules.is_stale("active", ends, NOW - timedelta(hours=5, minutes=59), NOW)
    assert rules.is_stale("active", ends, NOW - timedelta(hours=6), NOW)
    assert not rules.is_stale("active", NOW, NOW - timedelta(hours=8), NOW)  # expired: history, not stale
    assert rules.shelter_out_of_date(NOW - timedelta(hours=12, minutes=1), NOW)
    assert not rules.shelter_out_of_date(NOW - timedelta(hours=11), NOW)


def test_relief_needs_a_case_or_a_group_and_never_more_than_the_store_holds():
    assert relief_rules.check_quantity(11, 10) == ["more_than_in_stock"] and relief_rules.check_quantity(10, 10) == []
    assert relief_rules.check_recipient(kind="case", case_found=False, group_site=None, households=None) == ["case_not_found"]
    assert relief_rules.check_recipient(kind="group", case_found=False, group_site="School", households=None) == [
        "group_details_required"]
    assert relief_rules.check_recipient(kind="group", case_found=False, group_site="School", households=40) == []
    assert relief_rules.check_delivery(store_key="ds:A", delivered_path_keys=["platform", "district:X"],
                                       delivered_level="district") == ["outside_store_area"]
    assert relief_rules.check_dates(date(2026, 11, 20), date(2026, 11, 19)) == ["date_in_future"]


# --- M35 and D26 ------------------------------------------------------------------------------------------


def test_a_relayed_alert_reaches_the_members_of_its_area_with_source_time_and_numbers(
    client, auth, staff, member_in, area, elsewhere, db_session
):
    here, there = member_in(area), member_in(elsewhere)  # neither verified: warnings are for everyone

    alert = relay(client, auth, staff["relayer"], area)
    home = client.get("/v1/alerts", headers=auth(here)).json()
    away = client.get("/v1/alerts", headers=auth(there)).json()
    viewing_there = client.get(f"/v1/alerts?area=gn:{area.gn}", headers=auth(there)).json()

    assert re.fullmatch(r"AL-\d{5}", alert["alertRef"]) and alert["recipients"] >= 1 and alert["relayMinutes"] >= 19
    assert [a["id"] for a in home["current"]] == [alert["id"]]
    shown = home["current"][0]
    assert shown["sourceNameEn"] == "Disaster Management Centre" and shown["sourceUrl"].startswith("https://www.dmc.gov.lk/")
    assert shown["sourceIssuedAt"] and shown["state"] == "current" and shown["stale"] is False
    assert shown["emergencyContacts"][0]["number"] == "119" and "not an emergency service" in shown["notDispatchEn"]
    assert home["emergencyContacts"] and "not an emergency service" in home["notDispatchEn"]
    assert away["current"] == [] and [a["id"] for a in viewing_there["current"]] == [alert["id"]]
    assert notices(db_session, here, "disaster_alert") == 1 and notices(db_session, there, "disaster_alert") == 0


def test_members_who_turned_emergency_notices_off_are_not_told(client, auth, staff, member_in, area, db_session):
    member = member_in(area)
    db_session.execute(text("INSERT INTO notifications.preference (member_id, topic, push, sms) VALUES (:m, 'emergency', false, false)"),
                       {"m": member.id})

    relay(client, auth, staff["relayer"], area)

    assert notices(db_session, member, "disaster_alert") == 0  # FR-MSG-003; the alert is still on M35
    assert len(client.get("/v1/alerts", headers=auth(member)).json()["current"]) == 1


def test_unofficial_sources_and_areas_outside_the_relayer_are_refused(client, auth, staff, area, elsewhere):
    unofficial = client.post("/v1/alerts/manage", json=alert_body(area, sourceUrl="https://news.example.com/flood"),
                             headers=auth(staff["relayer"]))
    outside = client.post("/v1/alerts/manage", json=alert_body(area, targets=[{"level": "district", "code": elsewhere.district}]),
                          headers=auth(staff["relayer"]))
    member_tries = client.post("/v1/alerts/manage", json=alert_body(area), headers=auth(staff["officer"]))

    assert unofficial.status_code == 422 and unofficial.json()["detail"]["problems"] == ["link_not_from_source"]
    assert outside.status_code == 403 and outside.json()["detail"] == "outside_your_area"
    assert member_tries.status_code == 403


def test_an_expired_alert_moves_to_history(client, auth, staff, member_in, area, db_session):
    member = member_in(area)
    alert = relay(client, auth, staff["relayer"], area)
    db_session.execute(text("UPDATE disaster.alert SET source_ends_at = now() - interval '1 minute' WHERE id = :id"),
                       {"id": alert["id"]})

    current = client.get("/v1/alerts", headers=auth(member)).json()["current"]
    history = client.get("/v1/alerts/history", headers=auth(member)).json()
    managed = client.get("/v1/alerts/manage?current=false", headers=auth(staff["relayer"])).json()
    refresh = client.post(f"/v1/alerts/manage/{alert['id']}/refresh", json={**alert_body(area), "note": None},
                          headers=auth(staff["relayer"]))

    assert current == [] and [(a["id"], a["state"]) for a in history] == [(alert["id"], "expired")]
    assert alert["id"] in [a["id"] for a in managed]
    assert refresh.json()["detail"]["problems"] == ["alert_not_current"]


def test_an_alert_unchecked_for_six_hours_is_flagged_once_and_cleared_by_a_check(
    client, auth, staff, member_in, area, db_session
):
    member = member_in(area)
    alert = relay(client, auth, staff["relayer"], area)
    db_session.execute(text("UPDATE disaster.alert SET refreshed_at = now() - interval '7 hours' WHERE id = :id"),
                       {"id": alert["id"]})

    listed = client.get("/v1/alerts/manage", headers=auth(staff["relayer"])).json()
    flagged = alerts_service.flag_stale(db_session, datetime.now(UTC))
    again = alerts_service.flag_stale(db_session, datetime.now(UTC))
    body = {k: v for k, v in alert_body(area, severity="warning").items() if k not in ("sourceKey", "hazard", "targets")}
    refreshed = client.post(f"/v1/alerts/manage/{alert['id']}/refresh", json={**body, "note": "Checked the DMC page"},
                            headers=auth(staff["second_relayer"]))

    assert next(a for a in listed if a["id"] == alert["id"])["stale"] is True
    assert flagged >= 1 and again == 0
    assert notices(db_session, staff["relayer"], "disaster_alert_stale") == 1
    assert refreshed.status_code == 200 and refreshed.json()["stale"] is False and refreshed.json()["severity"] == "warning"
    assert [r["kind"] for r in refreshed.json()["revisions"]] == ["relayed", "refreshed"]
    # A raised severity tells the members again; the relayers' notice is done.
    assert notices(db_session, member, "disaster_alert_raised") == 1
    done = db_session.scalar(text("""SELECT action_done_at IS NOT NULL FROM notifications.notification
                                     WHERE member_id = :m AND template = 'disaster_alert_stale'"""), {"m": staff["relayer"].id})
    assert done is True


def test_a_withdrawn_alert_leaves_the_current_list_with_its_reason(client, auth, staff, member_in, area):
    member = member_in(area)
    alert = relay(client, auth, staff["relayer"], area)
    no_reason = client.post(f"/v1/alerts/manage/{alert['id']}/withdraw", json={"reason": "x"}, headers=auth(staff["relayer"]))
    withdrawn = client.post(f"/v1/alerts/manage/{alert['id']}/withdraw", json={"reason": "The DMC cancelled the watch."},
                            headers=auth(staff["relayer"]))

    assert no_reason.status_code == 422
    assert withdrawn.json()["state"] == "withdrawn" and withdrawn.json()["withdrawnReason"] == "The DMC cancelled the watch."
    assert client.get("/v1/alerts", headers=auth(member)).json()["current"] == []
    assert client.get(f"/v1/alerts/{alert['id']}", headers=auth(member)).json()["state"] == "withdrawn"


def test_shelters_come_only_from_authorised_sources_and_age_after_twelve_hours(
    client, auth, staff, member_in, area, db_session
):
    member = member_in(area)
    shelter = {
        "nameEn": "Central College hall", "nameTa": "மத்திய கல்லூரி மண்டபம்", "placeEn": "Main road, next to the temple",
        "placeTa": "பிரதான வீதி, கோவிலுக்கு அருகில்", "status": "open", "capacity": 300, "sourceKey": "district_secretariat",
        "sourceUrl": None, "sourceReportedAt": datetime.now(UTC).isoformat(), "area": {"level": "gn", "code": area.gn},
    }
    refused = client.post("/v1/alerts/manage/shelters", json={**shelter, "sourceKey": "meteorology"},
                          headers=auth(staff["relayer"]))
    district_level = client.post("/v1/alerts/manage/shelters", json={**shelter, "area": {"level": "district", "code": area.district}},
                                 headers=auth(staff["relayer"]))
    added = client.post("/v1/alerts/manage/shelters", json=shelter, headers=auth(staff["relayer"]))
    fresh = client.get("/v1/alerts", headers=auth(member)).json()["shelters"]
    db_session.execute(text("UPDATE disaster.shelter SET source_reported_at = now() - interval '13 hours' WHERE id = :id"),
                       {"id": added.json()["id"]})
    old = client.get("/v1/alerts", headers=auth(member)).json()["shelters"]

    assert refused.json()["detail"]["problems"] == ["unauthorised_shelter_source"]
    assert district_level.json()["detail"]["problems"] == ["shelter_area_level"]
    assert added.status_code == 201 and added.json()["sourceNameEn"] == "District Secretariat"
    assert [(s["id"], s["outOfDate"]) for s in fresh] == [(added.json()["id"], False)]
    assert old[0]["outOfDate"] is True


# --- M36 ----------------------------------------------------------------------------------------------------


def test_an_emergency_help_request_becomes_an_urgent_support_case_for_anyone(
    client, auth, staff, member_in, area, db_session
):
    member = member_in(area)  # not verified, no membership (BR-102)
    alert = relay(client, auth, staff["relayer"], area)
    body = {"need": "shelter", "people": 4, "details": "Water entered our house; we need a safe place tonight.",
            "fullName": "Applicant Person", "phone": "0771234567", "alertId": alert["id"], "consent": True}

    no_consent = client.post("/v1/alerts/help", json={**body, "consent": False}, headers=auth(member))
    sent = client.post("/v1/alerts/help", json=body, headers=auth(member))

    assert no_consent.json()["detail"]["problems"] == ["consent_required"]
    assert sent.status_code == 201 and re.fullmatch(r"AS-[A-Z2-7]{8}", sent.json()["caseRef"])
    db_session.execute(text("SELECT set_config('assistance.firewall', 'open', true)"))
    case = db_session.execute(text("SELECT category, emergency, summary, channel FROM assistance.case WHERE id = :id"),
                              {"id": sent.json()["caseId"]}).one()
    assert (case.category, case.emergency, case.channel) == ("emergency_needs", True, "app")
    assert alert["alertRef"] in case.summary and "4 people" in case.summary
    assert notices(db_session, staff["officer"], "assistance_emergency") == 1  # intake staff told at once (FR-AST-003)
    mine = client.get(f"/v1/assistance/requests/{sent.json()['caseId']}", headers=auth(member))
    assert mine.status_code == 200


def test_help_fails_closed_while_community_support_is_switched_off(database_settings, db_session, auth, member_in, area):
    from app.db.session import get_db
    from app.main import create_app

    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    enforced = TestClient(app)
    db_session.execute(text("""INSERT INTO ops.feature_flag (key, enabled, gate, gate_recorded_at)
                               VALUES ('disaster_alerts', true, 'G3', now())
                               ON CONFLICT (key) DO UPDATE SET enabled = true, gate = 'G3', gate_recorded_at = now()"""))
    db_session.execute(text("""INSERT INTO ops.feature_flag (key, enabled) VALUES ('community_support', false)
                               ON CONFLICT (key) DO UPDATE SET enabled = false"""))
    member = member_in(area)

    sent = enforced.post("/v1/alerts/help", json={
        "need": "food_water", "people": 2, "details": "We have had no clean water since yesterday.",
        "fullName": "Applicant Person", "consent": True,
    }, headers=auth(member))
    db_session.execute(text("UPDATE ops.feature_flag SET enabled = false WHERE key = 'disaster_alerts'"))
    closed = enforced.get("/v1/alerts", headers=auth(member))

    assert sent.status_code == 422 and sent.json()["detail"]["problems"] == ["support_not_open"]
    assert closed.status_code == 404 and closed.json()["detail"] == "feature_unavailable"


# --- FR-DIS-004 ---------------------------------------------------------------------------------------------


def test_verified_active_members_offer_relief_help_and_coordinators_see_it_in_scope(
    client, auth, staff, member_in, area, elsewhere, create_member, assign, super_admin
):
    pending, member = member_in(area), member_in(area, verified=True, active=True)
    until = (date.today() + timedelta(days=10)).isoformat()
    offer = {"tasks": ["cooking", "distribution"], "availableUntil": until, "consent": True}
    far = create_member(verified=True)
    assign(far, "3B", "district", elsewhere.district, ["relief.logistics"], granted_by=super_admin)

    locked = client.put("/v1/alerts/relief-offer", json=offer, headers=auth(pending))
    no_consent = client.put("/v1/alerts/relief-offer", json={**offer, "consent": False}, headers=auth(member))
    saved = client.put("/v1/alerts/relief-offer", json=offer, headers=auth(member))
    seen = client.get("/v1/alerts/manage/volunteers", headers=auth(staff["coordinator"])).json()
    not_seen = client.get("/v1/alerts/manage/volunteers", headers=auth(far)).json()
    home = client.get("/v1/alerts", headers=auth(member)).json()
    withdrawn = client.delete("/v1/alerts/relief-offer", headers=auth(member))

    assert locked.json()["detail"]["problems"] == ["identity_not_verified"]
    assert no_consent.json()["detail"]["problems"] == ["consent_required"]
    assert saved.status_code == 200 and saved.json()["tasks"] == ["cooking", "distribution"]
    assert [v["fullName"] for v in seen] == ["Test Member"] and "phone" not in seen[0]
    assert not_seen == []
    assert home["reliefOffer"]["availableUntil"] == until and home["reliefOfferLock"] is None
    assert withdrawn.status_code == 204
    assert client.get("/v1/alerts/manage/volunteers", headers=auth(staff["coordinator"])).json() == []


# --- S16 and D26 relief logistics ---------------------------------------------------------------------------


def supply(client, auth, officer, area, quantity=100, item="rice"):
    response = client.post("/v1/relief/supplies", json={
        "store": {"level": "ds", "code": area.ds}, "item": item, "quantity": quantity, "supplier": "District Secretariat",
        "receivedOn": date.today().isoformat(),
    }, headers=auth(officer))
    assert response.status_code == 201, response.text
    return response.json()


def distribution(where, **overrides):
    return {
        "storeKey": f"ds:{where.ds}", "area": {"level": "gn", "code": where.gn}, "item": "rice", "quantity": 20,
        "recipientKind": "group", "groupSite": "Central College hall", "households": 12,
        "evidence": "Signed list SL-14", "deliveredOn": date.today().isoformat(), **overrides,
    }


def test_relief_is_handed_out_only_from_stock_the_store_holds(client, auth, staff, area, db_session):
    supply(client, auth, staff["officer"], area, quantity=50)

    too_much = client.post("/v1/relief/distributions", json=distribution(area, quantity=51), headers=auth(staff["officer"]))
    given = client.post("/v1/relief/distributions", json=distribution(area, quantity=30), headers=auth(staff["officer"]))
    overview = client.get("/v1/relief", headers=auth(staff["coordinator"])).json()

    assert too_much.json()["detail"]["problems"] == ["more_than_in_stock"]
    assert given.status_code == 201 and re.fullmatch(r"RD-\d{6}", given.json()["distributionRef"])
    rice = next(line for line in overview["stock"] if line["storeKey"] == f"ds:{area.ds}" and line["item"] == "rice")
    assert (rice["received"], rice["handedOut"], rice["balance"], rice["unit"]) == (50, 30, 20, "kg")
    assert len(overview["items"]) == 10


def test_a_recipient_is_an_open_case_in_the_area_or_a_group_never_a_name(
    client, auth, staff, member_in, area, elsewhere, db_session
):
    supply(client, auth, staff["officer"], area)
    applicant = member_in(area)
    case = client.post("/v1/assistance/requests", json={
        "category": "food", "summary": "Our family lost its food stock in the flood.", "emergency": False, "consent": True,
        "fullName": "Applicant Person",
    }, headers=auth(applicant)).json()

    unknown = client.post("/v1/relief/distributions", json=distribution(area, recipientKind="case", caseRef="AS-AAAAAAAA",
                                                                         groupSite=None, households=None),
                          headers=auth(staff["officer"]))
    no_site = client.post("/v1/relief/distributions", json=distribution(area, groupSite=None), headers=auth(staff["officer"]))
    to_case = client.post("/v1/relief/distributions", json=distribution(area, recipientKind="case", caseRef=case["caseRef"],
                                                                         groupSite=None, households=None),
                          headers=auth(staff["officer"]))
    outside = client.post("/v1/relief/distributions", json=distribution(area, area={"level": "gn", "code": elsewhere.gn}),
                          headers=auth(staff["officer"]))
    listed = client.get("/v1/relief/distributions", headers=auth(staff["officer"])).json()

    assert unknown.json()["detail"]["problems"] == ["case_not_found"]
    assert no_site.json()["detail"]["problems"] == ["group_details_required"]
    assert to_case.status_code == 201 and to_case.json()["caseRef"] == case["caseRef"]
    assert outside.status_code == 403
    # FR-DIS-005: nothing about the person, membership or support travels with a distribution.
    assert set(listed[0]) == {
        "id", "distributionRef", "storeKey", "areaKey", "item", "unit", "quantity", "recipientKind", "caseRef", "groupSite",
        "households", "evidence", "deliveredOn", "alertId", "createdAt",
    }
    # The firewall: unless the relief module opens it, the rows are invisible.
    hidden, shown = hidden_and_shown(db_session, "relief", "distribution")
    assert hidden == 0 and shown >= 1


def test_relief_records_cannot_be_changed_afterwards(client, auth, staff, area, db_session):
    supply(client, auth, staff["officer"], area)
    given = client.post("/v1/relief/distributions", json=distribution(area), headers=auth(staff["officer"])).json()
    db_session.execute(text("SELECT set_config('relief.firewall', 'open', true)"))

    with pytest.raises(Exception, match="append-only"):
        with db_session.begin_nested():
            db_session.execute(text("UPDATE relief.distribution SET quantity = 1 WHERE id = :id"), {"id": given["id"]})


def test_home_shows_how_many_warnings_are_current_for_the_home_area(client, auth, staff, member_in, area, elsewhere):
    here, there = member_in(area), member_in(elsewhere)
    relay(client, auth, staff["relayer"], area)

    assert client.get("/v1/home", headers=auth(here)).json()["safetyAlerts"] == 1
    assert client.get("/v1/home", headers=auth(there)).json()["safetyAlerts"] == 0
