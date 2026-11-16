"""Offline field visits (S05 to S07, D24) and the election duty roster (M30, S15)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.access import repository as access_repository
from app.modules.access.rules import Area
from app.modules.audit import service as audit
from app.modules.engagement.field import repository as field_repository
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


def open_field_firewall(db_session):
    """Field rows sit behind row-level security (Alembic 0042); a direct read opens it as the API does."""
    db_session.execute(text("SELECT set_config('field.firewall', 'open', true)"))


def field_role(db_session):
    """An ordinary role: the test user is a superuser, which row-level security never applies to."""
    db_session.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_field_user') THEN
                    CREATE ROLE test_field_user;
                END IF;
                GRANT USAGE ON SCHEMA field TO test_field_user;
                GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA field TO test_field_user;
                GRANT USAGE ON SCHEMA npm TO test_field_user;
                GRANT SELECT ON npm.member TO test_field_user;
            END
            $$;
            """
        )
    )


def test_consent_comes_first_and_a_declined_visit_keeps_nothing(client, auth, coordinator, area, db_session):
    # A declined visit sent with text keeps none of it: the record ends with the place and time only.
    declined = sync(client, auth, coordinator, visit(area, consent="declined", notes="Spoke briefly", placeText="Near the temple"))[0]
    no_concern = sync(client, auth, coordinator, visit(area, concerns=[]))[0]

    assert declined["outcome"] == "created"
    assert (declined["visit"]["notes"], declined["visit"]["placeText"], declined["visit"]["concerns"]) == (None, None, [])
    assert no_concern["problems"] == ["concerns_required"]


def test_voting_intention_is_always_refused_even_when_confirmed(client, auth, coordinator, area):
    # FR-FLD-006, BR-134: there is no field for voting intention, and confirming does not create one.
    flagged = visit(area, notes="He said he will vote for the other party.")

    refused = sync(client, auth, coordinator, flagged)[0]
    confirmed = sync(client, auth, coordinator, {**flagged, "confirmedNotPolitical": True})[0]
    in_follow_up = sync(client, auth, coordinator, visit(area, followUp="Persuade the family before polling day",
                                                         confirmedNotPolitical=True))[0]
    in_tamil = sync(client, auth, coordinator, visit(area, notes="அவர் எந்தக் கட்சிக்கு ஓட்டுப் போடுவார் என்று சொன்னார்",
                                                     confirmedNotPolitical=True))[0]

    assert (refused["outcome"], refused["problems"]) == ("refused", ["political_profiling"])
    assert (confirmed["outcome"], confirmed["problems"]) == ("refused", ["political_profiling"])
    assert in_follow_up["problems"] == ["political_profiling"] and in_tamil["problems"] == ["political_profiling"]


def test_ambiguous_words_are_refused_until_removed_or_confirmed(client, auth, coordinator, area):
    flagged = visit(area, notes="A supporter of the school committee asked about the well.")

    refused = sync(client, auth, coordinator, flagged)[0]
    confirmed = sync(client, auth, coordinator, {**flagged, "confirmedNotPolitical": True})[0]
    tamil = sync(client, auth, coordinator, visit(area, notes="பாடசாலைக் குழுவின் ஆதரவாளர் கிணறு பற்றிக் கேட்டார்.",
                                                  confirmedNotPolitical=True))[0]

    assert refused["problems"] == ["political_content"]
    assert confirmed["outcome"] == "created" and tamil["outcome"] == "created"


@pytest.mark.parametrize("words", [
    "will vote for", "voting for the UNP", "He won't vote this time", "They didn't vote", "a swing voter",
    "tried to persuade her", "persuasion score 3", "Which party do they back?", "party supporter",
    "அவர் வாக்களிப்பேன் என்றார்", "வாக்குப் போட மாட்டேன்", "ஓட்டு போடுவார்", "எந்தக் கட்சி", "கட்சிக்கு ஆதரவு",
])
def test_the_hard_list_covers_english_and_tamil(words):
    assert field_rules.records_political_profile(words) is True
    assert field_rules.check_visit(consent="given", concerns=["water"], notes=words, place_text=None, follow_up=None,
                                   case_number=None, confirmed_not_political=True) == ["political_profiling"]


@pytest.mark.parametrize("words", ["supporter", "ஆதரவாளர்", "voter registration help", "the election office", "தேர்தல்"])
def test_ambiguous_words_can_be_confirmed(words):
    assert field_rules.records_political_profile(words) is False
    assert field_rules.looks_political(words) is True
    assert field_rules.check_visit(consent="given", concerns=["water"], notes=words, place_text=None, follow_up=None,
                                   case_number=None, confirmed_not_political=True) == []


def test_community_notes_pass():
    assert field_rules.looks_political("The well needs repair", "கிணறு திருத்தப்பட வேண்டும்", "காட்சி மண்டபம் அருகே") is False


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


def test_a_resend_of_what_the_server_holds_is_unchanged_not_a_conflict(client, auth, coordinator, area):
    # S07: the phone saved the visit but missed the answer, so it sends the same visit again.
    first = visit(area, visitedAt="2026-11-10T09:30:00.000Z", concerns=["water", "roads"])
    created = sync(client, auth, coordinator, first)[0]
    resent = sync(client, auth, coordinator, {**first, "concerns": ["roads", "water"]})[0]
    resent_from_version = sync(client, auth, coordinator, {**first, "baseVersion": 1})[0]
    changed = sync(client, auth, coordinator, {**first, "notes": "Edited before the answer came."})[0]

    assert created["outcome"] == "created"
    assert (resent["outcome"], resent["visit"]["version"], resent["visit"]["visitRef"]) == ("unchanged", 1, created["visit"]["visitRef"])
    assert (resent_from_version["outcome"], resent_from_version["visit"]["version"]) == ("unchanged", 1)
    assert changed["outcome"] == "conflict"  # a different edit from no base version still conflicts


def test_the_place_is_a_gn_a_ds_or_none(client, auth, create_member, assign, area, super_admin, db_session):
    # S05: location is optional, chosen by hand: a GN or a DS division, or none.
    ds_coordinator = create_member(verified=True)
    assign(ds_coordinator, "2A", "ds", area.ds, ["field.collect"], granted_by=super_admin)
    two_areas = create_member(verified=True)
    assign(two_areas, "2A", "ds", area.ds, ["field.collect"], granted_by=super_admin)
    other_ds = db_session.scalar(text("SELECT ds_code FROM geo.ds_division WHERE ds_code <> :ds ORDER BY ds_code LIMIT 1"),
                                 {"ds": area.ds})
    assign(two_areas, "2A", "ds", other_ds, ["field.collect"], granted_by=super_admin)

    by_gn = sync(client, auth, ds_coordinator, visit(area))[0]
    by_ds = sync(client, auth, ds_coordinator, visit(area, gnCode=None, dsCode=area.ds))[0]
    no_place = sync(client, auth, ds_coordinator, visit(area, gnCode=None))[0]
    both = sync(client, auth, ds_coordinator, visit(area, dsCode=area.ds))[0]
    outside_ds = sync(client, auth, ds_coordinator, visit(area, gnCode=None, dsCode=other_ds))[0]
    must_choose = sync(client, auth, two_areas, visit(area, gnCode=None))[0]

    assert by_gn["outcome"] == "created" and by_gn["visit"]["areaKey"] == f"gn:{area.gn}"
    assert by_ds["outcome"] == "created"
    assert (by_ds["visit"]["gnCode"], by_ds["visit"]["dsCode"], by_ds["visit"]["areaKey"]) == (None, area.ds, f"ds:{area.ds}")
    assert no_place["outcome"] == "created"
    assert (no_place["visit"]["gnCode"], no_place["visit"]["dsCode"], no_place["visit"]["areaKey"]) == (None, None, f"ds:{area.ds}")
    assert both["problems"] == ["one_place_only"]
    assert outside_ds["problems"] == ["outside_your_area"]
    assert must_choose["problems"] == ["place_required"]

    supervised = client.get("/v1/field/manage/visits", headers=auth(ds_coordinator)).json()
    counts = client.get("/v1/field/manage/counts", headers=auth(ds_coordinator)).json()
    assert {by_gn["visit"]["id"], by_ds["visit"]["id"], no_place["visit"]["id"]} <= {v["id"] for v in supervised}
    assert any(c["areaKey"] == f"ds:{area.ds}" and c["gnCode"] is None and c["visits"] >= 2 for c in counts)
    assert any(c["areaKey"] == f"gn:{area.gn}" and c["gnCode"] == area.gn and c["visits"] >= 1 for c in counts)


def test_a_gn_coordinator_with_one_area_may_leave_the_place_out(client, auth, coordinator, area):
    no_place = sync(client, auth, coordinator, visit(area, gnCode=None))[0]
    assert no_place["outcome"] == "created" and no_place["visit"]["areaKey"] == f"gn:{area.gn}"
    assert no_place["visit"]["gnCode"] is None


def test_old_visits_are_deleted_and_only_counts_remain(client, auth, coordinator, area, db_session):
    sync(client, auth, coordinator, visit(area, visitedAt=(datetime.now(UTC) - timedelta(days=400)).isoformat()))
    sync(client, auth, coordinator, visit(area))

    removed = field.purge(db_session, datetime.now(UTC))
    open_field_firewall(db_session)
    left = db_session.scalar(text("SELECT count(*) FROM field.visit WHERE coordinator_id = :c"), {"c": coordinator.id})
    counts = client.get("/v1/field/manage/counts", headers=auth(coordinator)).json()

    assert removed >= 1 and left == 1
    assert sum(c["visits"] for c in counts if c["gnCode"] == area.gn and c["concern"] == "water") >= 2


def test_retention_is_twelve_calendar_months(client, auth, coordinator, area, db_session):
    # OD-38: 12 calendar months, not 360 days. On 13 November 2026 a visit from 15 November 2025 stays.
    now = datetime(2026, 11, 13, 12, 0, tzinfo=UTC)
    kept = visit(area, visitedAt=datetime(2025, 11, 15, 12, 0, tzinfo=UTC).isoformat())
    deleted = visit(area, visitedAt=datetime(2025, 11, 12, 12, 0, tzinfo=UTC).isoformat())
    sync(client, auth, coordinator, kept, deleted)

    field.purge(db_session, now)
    open_field_firewall(db_session)
    left = {str(row[0]) for row in db_session.execute(text("SELECT client_id FROM field.visit WHERE coordinator_id = :c"),
                                                      {"c": coordinator.id})}

    assert kept["clientId"] in left and deleted["clientId"] not in left


def test_a_visit_without_a_gn_is_counted_under_its_area_after_deletion(client, auth, coordinator, area, db_session):
    old = (datetime.now(UTC) - timedelta(days=400)).isoformat()
    sync(client, auth, coordinator, visit(area, gnCode=None, visitedAt=old, concerns=["housing"]))

    field.purge(db_session, datetime.now(UTC))
    counts = client.get("/v1/field/manage/counts", headers=auth(coordinator)).json()

    assert any(c["areaKey"] == f"gn:{area.gn}" and c["concern"] == "housing" and c["visits"] >= 1 for c in counts)


def test_field_rows_are_invisible_without_the_firewall_setting(client, auth, coordinator, area, db_session):
    # MP-FEA-002 §8: field data lives in its own tables behind row-level security.
    sync(client, auth, coordinator, visit(area))
    field_role(db_session)
    count = text("SELECT count(*) FROM field.visit WHERE coordinator_id = :c")
    try:
        db_session.execute(text("SET ROLE test_field_user"))
        db_session.execute(text("SELECT set_config('field.firewall', '', true)"))
        hidden = db_session.scalar(count, {"c": coordinator.id})
        hidden_counts = db_session.scalar(text("SELECT count(*) FROM field.visit_count"))
        db_session.execute(text("SELECT set_config('field.firewall', 'open', true)"))
        shown = db_session.scalar(count, {"c": coordinator.id})
        db_session.execute(text("SELECT set_config('field.firewall', '', true)"))
        through_the_repository = field_repository.mine(db_session, coordinator.id, None)  # opens it itself
    finally:
        db_session.execute(text("RESET ROLE"))

    assert (hidden, hidden_counts, shown) == (0, 0, 1)
    assert len(through_the_repository) == 1


def test_writing_a_field_row_needs_the_firewall_open(db_session, area):
    field_role(db_session)
    savepoint = db_session.begin_nested()
    try:
        db_session.execute(text("SET LOCAL ROLE test_field_user"))
        db_session.execute(text("SELECT set_config('field.firewall', '', true)"))
        with pytest.raises(Exception, match="row-level security"):
            db_session.execute(text("INSERT INTO field.visit_count (place_key, area_path, month, concern, visits) "
                                    "VALUES (:g, ARRAY['platform'], '2025-01-01', 'water', 1)"), {"g": f"gn:{area.gn}"})
    finally:
        savepoint.rollback()
        db_session.execute(text("RESET ROLE"))


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


def open_shift(client, auth, coordinator, area, period_id, places=3):
    starts = datetime.now(UTC) + timedelta(minutes=30)
    return client.post("/v1/election/roster/manage/shifts", json={
        "periodId": period_id, "roleEn": "Help desk", "roleTa": "உதவி மேசை", "siteEn": "Nallur community hall",
        "siteTa": "நல்லூர் சமூக மண்டபம்", "area": {"level": "gn", "code": area.gn},
        "startsAt": starts.isoformat(), "endsAt": (starts + timedelta(hours=4)).isoformat(), "places": places,
    }, headers=auth(coordinator)).json()


def offered_to(client, auth, coordinator, shift_id, volunteer, db_session):
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": volunteer.id})
    client.post(f"/v1/election/roster/manage/shifts/{shift_id}/offers", json={"memberCode": code}, headers=auth(coordinator))
    return client.get("/v1/election/roster/mine", headers=auth(volunteer)).json()[0]["assignmentId"]


def test_operational_messages_go_to_rostered_volunteers_only_and_are_listed(client, auth, coordinator, member_in, area,
                                                                            super_admin, db_session):
    # S15, FR-ELX-007: rostered means accepted; an open or declined offer gets no duty message.
    period_id = declared_period(db_session, area, super_admin)
    shift = open_shift(client, auth, coordinator, area, period_id)
    accepted, declined, waiting = (member_in(area, verified=True, active=True) for _ in range(3))
    for person, answer in ((accepted, True), (declined, False)):
        assignment_id = offered_to(client, auth, coordinator, shift["id"], person, db_session)
        client.post(f"/v1/election/roster/assignments/{assignment_id}/answer", json={"accept": answer}, headers=auth(person))
    offered_to(client, auth, coordinator, shift["id"], waiting, db_session)

    sent = client.post(f"/v1/election/roster/manage/shifts/{shift['id']}/messages", json={
        "bodyEn": "Doors open at 6 in the morning.", "bodyTa": "காலை 6 மணிக்குக் கதவுகள் திறக்கப்படும்.",
    }, headers=auth(coordinator)).json()
    shift_file = client.get(f"/v1/election/roster/manage/shifts/{shift['id']}", headers=auth(coordinator)).json()
    told = {row[0] for row in db_session.execute(
        text("SELECT member_id FROM notifications.notification WHERE template = 'roster_message' AND target_id = :s"),
        {"s": shift["id"]},
    )}

    assert sent == {"recipients": 1}
    assert len(shift_file["messages"]) == 1
    message = shift_file["messages"][0]
    assert (message["bodyEn"], message["recipients"]) == ("Doors open at 6 in the morning.", 1)
    assert message["bodyTa"].startswith("காலை") and message["sentByName"]
    assert told == {accepted.id}


def test_the_period_report_counts_and_lists_what_happened_in_its_area(client, auth, coordinator, member_in, area,
                                                                       super_admin, db_session):
    # FR-ELX-009: messages, roster changes and content published, inside the period's time and area.
    period_id = declared_period(db_session, area, super_admin)
    before = client.get(f"/v1/election/roster/periods/{period_id}/report", headers=auth(super_admin)).json()
    shift = open_shift(client, auth, coordinator, area, period_id)
    gn_path = access_repository.area_path(db_session, Area("gn", area.gn))
    province_path = access_repository.area_path(db_session, Area("province", area.province))
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY 1 LIMIT 1"), {"d": area.district})
    elsewhere = access_repository.area_path(db_session, Area("district", other_district))

    def record(action, target, path):
        target_id = str(uuid.uuid4())
        audit.record(db_session, actor_id=super_admin.id, action=action, target_type=target, target_id=target_id,
                     area_path=path)
        return target_id

    record("gallery.album.published", "album", gn_path)
    record("promise.published", "promise", gn_path)
    record("scorecard.published", "scorecard", None)  # platform-wide: it reached the period's area too
    record("messaging.broadcast.sent", "broadcast", province_path)
    outside = record("events.event.published", "event", elsewhere)  # another district: not in this report
    label = record("gallery.album.publish", "album", gn_path)  # a silence check's label, not a publication

    report = client.get(f"/v1/election/roster/periods/{period_id}/report", headers=auth(super_admin)).json()
    entries = client.get(f"/v1/election/roster/periods/{period_id}/report/entries", headers=auth(super_admin)).json()

    assert report["contentPublished"] - before["contentPublished"] == 3
    assert report["broadcastsSent"] - before["broadcastsSent"] == 1
    actions = [entry["action"] for entry in entries]
    assert {"gallery.album.published", "promise.published", "scorecard.published", "messaging.broadcast.sent",
            "election.roster.shift_created"} <= set(actions)
    assert not {outside, label} & {entry["targetId"] for entry in entries}
    shift_entry = next(entry for entry in entries if entry["action"] == "election.roster.shift_created")
    assert shift_entry["targetType"] == "roster_shift" and shift_entry["targetId"] == shift["id"]
    # Ids only: no text, details or people's names.
    assert all(set(entry) == {"action", "targetType", "targetId", "occurredAt"} for entry in entries)
    assert [entry["occurredAt"] for entry in entries] == sorted((entry["occurredAt"] for entry in entries), reverse=True)


def test_the_period_report_needs_election_mode_over_the_periods_area(client, auth, create_member, assign, area, super_admin,
                                                                      db_session):
    period_id = declared_period(db_session, area, super_admin)
    other = db_session.scalar(text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY 1 LIMIT 1"),
                              {"d": area.district})
    outside, inside = create_member(verified=True), create_member(verified=True)
    assign(outside, "5", "district", other, ["election.mode.manage"], granted_by=super_admin)
    assign(inside, "5", "district", area.district, ["election.mode.manage"], granted_by=super_admin)

    refused = client.get(f"/v1/election/roster/periods/{period_id}/report", headers=auth(outside))
    refused_entries = client.get(f"/v1/election/roster/periods/{period_id}/report/entries", headers=auth(outside))
    allowed = client.get(f"/v1/election/roster/periods/{period_id}/report", headers=auth(inside))
    missing = client.get(f"/v1/election/roster/periods/{uuid.uuid4()}/report/entries", headers=auth(inside))

    assert (refused.status_code, refused.json()["detail"]) == (403, "outside_your_area")
    assert refused_entries.status_code == 403
    assert allowed.status_code == 200
    assert missing.status_code == 404
