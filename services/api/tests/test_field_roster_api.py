"""Offline field visits (S05 to S07, D24) and the election duty roster (M30, S15)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.engagement.field import rules as field_rules
from app.modules.engagement.field import service as field


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def coordinator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "1", "gn", area.gn, ["field.collect", "election.roster.manage"], granted_by=super_admin)
    return person


def visit(area, **overrides):
    return {
        "clientId": str(uuid.uuid4()), "gnCode": area.gn, "visitedAt": datetime.now(UTC).isoformat(), "consent": "given",
        "concerns": ["water"], "notes": "The well near the temple is dry.", **overrides,
    }


def sync(client, auth, person, *visits):
    return client.post("/v1/field/visits/sync", json={"visits": list(visits)}, headers=auth(person)).json()


def test_consent_comes_first_and_a_declined_visit_keeps_nothing(client, auth, coordinator, area, db_session):
    # A declined visit sent with text keeps none of it: the record ends with the place and time only.
    declined = sync(client, auth, coordinator, visit(area, consent="declined", notes="Spoke briefly", placeText="Near the temple"))[0]
    no_concern = sync(client, auth, coordinator, visit(area, concerns=[]))[0]

    assert declined["outcome"] == "created"
    assert (declined["visit"]["notes"], declined["visit"]["placeText"], declined["visit"]["concerns"]) == (None, None, [])
    assert no_concern["problems"] == ["concerns_required"]


def test_political_notes_are_refused_until_removed_or_confirmed(client, auth, coordinator, area):
    flagged = visit(area, notes="He said he will vote for the other party.")

    refused = sync(client, auth, coordinator, flagged)[0]
    confirmed = sync(client, auth, coordinator, {**flagged, "confirmedNotPolitical": True})[0]

    assert refused["problems"] == ["political_content"]
    assert confirmed["outcome"] == "created"
    assert field_rules.looks_political("அவர் வாக்களிப்பேன் என்றார்") is True
    assert field_rules.looks_political("The well needs repair") is False


def test_visits_only_in_the_coordinators_area_and_edits_from_old_versions_conflict(client, auth, coordinator, area, db_session):
    other_gn = db_session.scalar(text("SELECT gn_code FROM geo.gn_division WHERE gn_code <> :gn ORDER BY gn_code LIMIT 1"),
                                 {"gn": area.gn})
    outside = sync(client, auth, coordinator, visit(area, gnCode=other_gn))[0]
    first = visit(area)
    created = sync(client, auth, coordinator, first)[0]
    updated = sync(client, auth, coordinator, {**first, "baseVersion": 1, "notes": "The well is dry; tanker needed."})[0]
    stale = sync(client, auth, coordinator, {**first, "baseVersion": 1, "notes": "Edited on a second phone."})[0]

    assert (outside["outcome"], outside["problems"]) == ("refused", ["outside_your_area"])
    assert created["visit"]["version"] == 1 and updated["visit"]["version"] == 2
    assert stale["outcome"] == "conflict" and stale["visit"]["notes"] == "The well is dry; tanker needed."


def test_old_visits_are_deleted_and_only_counts_remain(client, auth, coordinator, area, db_session):
    sync(client, auth, coordinator, visit(area, visitedAt=(datetime.now(UTC) - timedelta(days=400)).isoformat()))
    sync(client, auth, coordinator, visit(area))

    removed = field.purge(db_session, datetime.now(UTC))
    left = db_session.scalar(text("SELECT count(*) FROM field.visit WHERE coordinator_id = :c"), {"c": coordinator.id})
    counts = client.get("/v1/field/manage/counts", headers=auth(coordinator)).json()

    assert removed >= 1 and left == 1
    assert sum(c["visits"] for c in counts if c["gnCode"] == area.gn and c["concern"] == "water") >= 2


def test_a_member_without_field_collect_gets_403(client, auth, member_in, area):
    member = member_in(area, verified=True, active=True)
    assert client.post("/v1/field/visits/sync", json={"visits": []}, headers=auth(member)).status_code == 403


# --- Duty roster ----------------------------------------------------------------------------------------


def declared_period(db_session, area, super_admin):
    now = datetime.now(UTC)
    return str(db_session.scalar(
        text(
            """INSERT INTO election.period (election_type, title_en, title_ta, area_key, area_path, starts_at, ends_at,
                                           silence_starts_at, silence_ends_at, polling_day, source_url, source_reference,
                                           source_published_at, declared_by)
               VALUES ('local', 'Local election', 'உள்ளூராட்சித் தேர்தல்', :key, :path, :s, :e, :ss, :se, :pd,
                       'https://elections.example/notice', 'Gazette 2/2026', :s, :admin) RETURNING id"""
        ),
        {"key": f"district:{area.district}", "path": ["platform", f"province:{area.province}", f"district:{area.district}"],
         "s": now - timedelta(days=5), "e": now + timedelta(days=20), "ss": now + timedelta(days=15),
         "se": now + timedelta(days=17), "pd": (now + timedelta(days=16)).date(), "admin": super_admin.id},
    ))


def test_a_volunteer_accepts_a_shift_and_checks_in_without_location(client, auth, coordinator, member_in, area, super_admin,
                                                                   db_session):
    volunteer = member_in(area, verified=True, active=True)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": volunteer.id})
    period_id = declared_period(db_session, area, super_admin)
    starts = datetime.now(UTC) + timedelta(minutes=30)

    shift = client.post("/v1/election/roster/manage/shifts", json={
        "periodId": period_id, "roleEn": "Help desk", "roleTa": "உதவி மேசை", "siteEn": "Nallur community hall",
        "siteTa": "நல்லூர் சமூக மண்டபம்", "area": {"level": "gn", "code": area.gn},
        "startsAt": starts.isoformat(), "endsAt": (starts + timedelta(hours=4)).isoformat(), "places": 2,
    }, headers=auth(coordinator)).json()
    offered = client.post(f"/v1/election/roster/manage/shifts/{shift['id']}/offers", json={"memberCode": code},
                          headers=auth(coordinator)).json()
    assert offered.get("assignments"), (shift, offered)
    mine = client.get("/v1/election/roster/mine", headers=auth(volunteer)).json()
    assignment_id = mine[0]["assignmentId"]
    early_check_in = client.post(f"/v1/election/roster/assignments/{assignment_id}/check-in", json={}, headers=auth(volunteer))
    accepted = client.post(f"/v1/election/roster/assignments/{assignment_id}/answer", json={"accept": True},
                           headers=auth(volunteer)).json()
    checked_in = client.post(f"/v1/election/roster/assignments/{assignment_id}/check-in", json={"siteConfirmed": True},
                             headers=auth(volunteer)).json()
    sent = client.post(f"/v1/election/roster/manage/shifts/{shift['id']}/messages", json={
        "bodyEn": "Please bring your member card.", "bodyTa": "உங்கள் உறுப்பினர் அட்டையைக் கொண்டு வாருங்கள்.",
    }, headers=auth(coordinator)).json()
    report = client.get(f"/v1/election/roster/periods/{period_id}/report", headers=auth(super_admin)).json()

    assert offered.get("assignments"), offered
    assert offered["assignments"][0]["state"] == "offered" and "phone" not in str(offered)
    assert early_check_in.json()["detail"]["problems"] == ["not_accepted"]
    assert accepted["state"] == "accepted"
    assert checked_in["checkedInAt"] is not None and checked_in["siteConfirmed"] is True
    assert sent == {"recipients": 1}
    assert (report["shifts"], report["rosterMessages"]) == (1, 1)
    # BR-129: no column anywhere in the roster records a vote choice or proof of voting.
    columns = {row[0] for row in db_session.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'election' AND table_name LIKE 'roster%'"))}
    assert not any(word in column for column in columns for word in ("vote", "ballot", "preference", "intention"))


def test_a_shift_must_sit_inside_its_election_area(client, auth, coordinator, area, super_admin, db_session):
    period_id = declared_period(db_session, area, super_admin)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d AND district_code LIKE 'LK%' ORDER BY 1 LIMIT 1"),
        {"d": area.district},
    )
    refused = client.post("/v1/election/roster/manage/shifts", json={
        "periodId": period_id, "roleEn": "Help desk", "roleTa": "உதவி மேசை", "siteEn": "Elsewhere hall",
        "siteTa": "வேறு மண்டபம்", "area": {"level": "district", "code": other_district},
        "startsAt": datetime.now(UTC).isoformat(), "endsAt": (datetime.now(UTC) + timedelta(hours=2)).isoformat(), "places": 1,
    }, headers=auth(coordinator))
    assert refused.json()["detail"]["problems"] == ["outside_the_election_area"]


def test_a_coordinator_sees_the_declared_periods_covering_their_area_only(client, auth, coordinator, create_member, assign,
                                                                          area, super_admin, db_session):
    period_id = declared_period(db_session, area, super_admin)
    elsewhere = create_member(verified=True)
    other = db_session.scalar(text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
                              {"d": area.district})
    assign(elsewhere, "3A", "district", other, ["election.roster.manage"], granted_by=super_admin)

    mine = client.get("/v1/election/roster/manage/periods", headers=auth(coordinator)).json()
    theirs = client.get("/v1/election/roster/manage/periods", headers=auth(elsewhere)).json()

    assert period_id in [p["id"] for p in mine]  # a district period covers the GN coordinator
    assert period_id not in [p["id"] for p in theirs]
