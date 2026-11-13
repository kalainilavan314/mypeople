"""Promise Tracker (M18, M19, D16) and the accountability scorecard (M20, D17)."""

from datetime import UTC, date, datetime, timedelta

import json

import pytest
from sqlalchemy import text

from app.modules.community.promises import rules as promise_rules
from app.modules.community.promises import service as promises
from app.modules.community.scorecards import rules as scorecard_rules


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def office(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["promise.edit"], granted_by=super_admin)
    return person


@pytest.fixture
def approver(super_admin):
    return super_admin  # Tier 5 holds promise.publish and content.moderate by default


def promise_body(area, **overrides):
    today = date.today()
    return {
        "titleEn": "Repair the Point Pedro coast road", "titleTa": "பருத்தித்துறை கரையோர வீதியைச் சீரமைத்தல்",
        "descriptionEn": "Resurface the damaged coast road in two phases.",
        "descriptionTa": "சேதமடைந்த கரையோர வீதியை இரண்டு கட்டங்களில் மீள அமைத்தல்.",
        "sourceReference": "Manifesto 2026, page 12", "sourcePublishedOn": (today - timedelta(days=200)).isoformat(),
        "officeEn": "District Roads Office", "officeTa": "மாவட்ட வீதி அலுவலகம்",
        "kind": "government_responsibility", "theme": "roads_transport",
        "plannedStart": (today - timedelta(days=60)).isoformat(), "dueDate": (today + timedelta(days=120)).isoformat(),
        "targetEn": "12 km resurfaced", "targetTa": "12 கி.மீ. மீள அமைக்கப்படும்",
        "milestones": [{"titleEn": "Survey done", "titleTa": "அளவீடு முடிந்தது"}],
        "area": {"level": "district", "code": area.district},
        **overrides,
    }


def published_promise(client, auth, office, approver, area, **overrides):
    created = client.post("/v1/promises/manage", json=promise_body(area, **overrides), headers=auth(office))
    assert created.status_code == 201, created.json()
    promise_id = created.json()["id"]
    client.post(f"/v1/promises/manage/{promise_id}/request-publication", headers=auth(office))
    decided = client.post(f"/v1/promises/manage/{promise_id}/publication-decision", json={"approve": True}, headers=auth(approver))
    assert decided.json()["publication"] == "published", decided.json()
    return promise_id


def test_a_second_person_publishes_and_the_drafter_cannot(client, auth, office, approver, area, member_in, db_session):
    created = client.post("/v1/promises/manage", json=promise_body(area, milestones=[]), headers=auth(office)).json()
    no_milestone = client.post(f"/v1/promises/manage/{created['id']}/request-publication", headers=auth(office))
    member = member_in(area, verified=True, active=True)

    promise_id = published_promise(client, auth, office, approver, area)
    hidden_draft = client.get(f"/v1/promises/{created['id']}", headers=auth(member))
    listed = client.get("/v1/promises", params={"status": "not_started"}, headers=auth(member)).json()

    assert no_milestone.json()["detail"]["problems"] == ["milestones_required"]
    assert hidden_draft.status_code == 404
    # Only published promises are listed (the database may hold others, such as demo data).
    mine = [p for p in listed if p["id"] in (promise_id, created["id"])]
    assert [p["id"] for p in mine] == [promise_id] and mine[0]["kind"] == "government_responsibility"
    # Someone holding both permissions still cannot approve their own request (FR-PRM-003).
    db_session.execute(
        text("UPDATE access.staff_assignment SET permissions = array_append(permissions, 'promise.edit') WHERE member_id = :m"),
        {"m": approver.id},
    )
    own_id = client.post("/v1/promises/manage", json=promise_body(area), headers=auth(approver)).json()["id"]
    client.post(f"/v1/promises/manage/{own_id}/request-publication", headers=auth(approver))
    own = client.post(f"/v1/promises/manage/{own_id}/publication-decision", json={"approve": True}, headers=auth(approver))
    assert (own.status_code, own.json()["detail"]) == (403, "own_draft")


def test_status_changes_need_evidence_and_approval_and_corrections_keep_the_original(client, auth, office, approver, area,
                                                                                      member_in):
    promise_id = published_promise(client, auth, office, approver, area)
    member = member_in(area, verified=True, active=True)

    no_evidence = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "completed", "noteEn": "All 12 km resurfaced.", "noteTa": "12 கி.மீ. முழுமையாக மீள அமைக்கப்பட்டது.",
    }, headers=auth(office))
    update = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "in_progress", "noteEn": "Phase one has started.", "noteTa": "முதல் கட்டம் ஆரம்பமானது.",
        "evidenceRefs": ["Contract RDA/114"],
    }, headers=auth(office)).json()
    before = client.get(f"/v1/promises/{promise_id}", headers=auth(member)).json()
    own = client.post(f"/v1/promises/manage/updates/{update['id']}/decision", json={"approve": True}, headers=auth(office))
    approved = client.post(f"/v1/promises/manage/updates/{update['id']}/decision", json={"approve": True}, headers=auth(approver))
    correction = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "noteEn": "Correction: phase one started on 2 November.", "noteTa": "திருத்தம்: முதல் கட்டம் நவம்பர் 2 ஆரம்பமானது.",
        "correctsId": update["id"],
    }, headers=auth(office)).json()
    client.post(f"/v1/promises/manage/updates/{correction['id']}/decision", json={"approve": True}, headers=auth(approver))
    after = client.get(f"/v1/promises/{promise_id}", headers=auth(member)).json()

    assert no_evidence.json()["detail"]["problems"] == ["evidence_required"]
    assert before["status"] == "not_started" and before["updates"] == []
    assert own.status_code == 403  # promise.edit cannot approve; and the drafter never may
    assert approved.json()["decision"] == "approved"
    assert after["status"] == "in_progress" and after["lastVerifiedAt"] is not None
    assert [u["noteEn"] for u in after["updates"]] == ["Phase one has started.", "Correction: phase one started on 2 November."]
    assert after["updates"][1]["correctsId"] == update["id"]


def test_a_promise_past_its_due_date_becomes_delayed_and_the_office_is_asked(client, auth, office, approver, area, db_session):
    promise_id = published_promise(client, auth, office, approver, area)
    db_session.execute(text("UPDATE community.promise SET due_date = current_date - 1 WHERE id = :id"), {"id": promise_id})

    changed = promises.mark_delayed(db_session, datetime.now(UTC))
    again = promises.mark_delayed(db_session, datetime.now(UTC))
    found = db_session.execute(text("SELECT status, update_due_at FROM community.promise WHERE id = :id"), {"id": promise_id}).one()
    tasks = db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :m AND template = 'promise_update_due'"),
        {"m": office.id},
    )

    assert (changed, again) == (1, 0)
    assert found.status == "delayed" and found.update_due_at is not None and tasks == 1


def test_the_drafter_cannot_approve_publication_even_when_someone_else_asked(client, auth, office, approver, area,
                                                                               create_member, assign, super_admin):
    drafter = create_member(verified=True)
    assign(drafter, "5", "platform", None, ["promise.edit", "promise.publish"], granted_by=super_admin)
    promise_id = client.post("/v1/promises/manage", json=promise_body(area), headers=auth(drafter)).json()["id"]
    client.post(f"/v1/promises/manage/{promise_id}/request-publication", headers=auth(office))

    waiting = client.get("/v1/promises/manage/pending", headers=auth(approver)).json()
    own = client.post(f"/v1/promises/manage/{promise_id}/publication-decision", json={"approve": True},
                      headers=auth(drafter))
    second = client.post(f"/v1/promises/manage/{promise_id}/publication-decision", json={"approve": True},
                         headers=auth(approver))

    assert promise_id in [p["id"] for p in waiting["publications"]]  # D16: on the pending work list
    assert (own.status_code, own.json()["detail"]) == (403, "own_draft")
    assert second.json()["publication"] == "published"
    after = client.get("/v1/promises/manage/pending", headers=auth(approver)).json()
    assert promise_id not in [p["id"] for p in after["publications"]]


def test_an_overdue_promise_stays_delayed_until_it_is_completed_or_withdrawn(client, auth, office, approver, area,
                                                                              member_in, db_session):
    promise_id = published_promise(client, auth, office, approver, area)
    member = member_in(area, verified=True, active=True)
    started = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "in_progress", "noteEn": "Phase one has started.", "noteTa": "முதல் கட்டம் ஆரம்பமானது.",
    }, headers=auth(office)).json()
    db_session.execute(text("UPDATE community.promise SET due_date = current_date - 1 WHERE id = :id"), {"id": promise_id})

    late_approval = client.post(f"/v1/promises/manage/updates/{started['id']}/decision", json={"approve": True},
                                headers=auth(approver))
    blocked = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "blocked", "noteEn": "No funds were released this year.", "noteTa": "இவ்வாண்டு நிதி விடுவிக்கப்படவில்லை.",
    }, headers=auth(office))
    note_only = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "noteEn": "Funding is being discussed again.", "noteTa": "நிதி பற்றி மீண்டும் பேசப்படுகிறது.",
    }, headers=auth(office))
    short_tamil = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "withdrawn", "noteEn": "The ministry cancelled the project.", "noteTa": "இரத்து",
    }, headers=auth(office))
    withdrawn = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "newStatus": "withdrawn", "noteEn": "The ministry cancelled the project.",
        "noteTa": "அமைச்சு இத்திட்டத்தை இரத்து செய்தது.",
    }, headers=auth(office)).json()
    client.post(f"/v1/promises/manage/updates/{withdrawn['id']}/decision", json={"approve": True}, headers=auth(approver))
    shown = client.get(f"/v1/promises/{promise_id}", headers=auth(member)).json()

    assert late_approval.json()["detail"]["problems"] == ["overdue_stays_delayed"]
    assert blocked.json()["detail"]["problems"] == ["overdue_stays_delayed"]
    assert note_only.status_code == 201
    assert short_tamil.json()["detail"]["problems"] == ["reason_required"]
    assert shown["status"] == "withdrawn"
    assert (shown["statusReason"], shown["statusReasonTa"]) == ("The ministry cancelled the project.",
                                                                "அமைச்சு இத்திட்டத்தை இரத்து செய்தது.")


def test_a_missed_update_is_raised_once_with_the_publishers(client, auth, office, approver, area, db_session):
    promise_id = published_promise(client, auth, office, approver, area)
    db_session.execute(text("UPDATE community.promise SET due_date = current_date - 1 WHERE id = :id"), {"id": promise_id})
    promises.mark_delayed(db_session, datetime.now(UTC))
    not_yet = promises.escalate_missed_updates(db_session, datetime.now(UTC))
    db_session.execute(text("UPDATE community.promise SET update_due_at = now() - interval '1 minute' WHERE id = :id"),
                       {"id": promise_id})

    raised = promises.escalate_missed_updates(db_session, datetime.now(UTC))
    again = promises.escalate_missed_updates(db_session, datetime.now(UTC))
    told = db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :m AND template = 'promise_update_missed' "
             "AND target_id = :p"),
        {"m": approver.id, "p": promise_id},
    )
    alerted = db_session.scalar(text("SELECT update_missed_alerted_at FROM community.promise WHERE id = :id"), {"id": promise_id})
    update = client.post(f"/v1/promises/manage/{promise_id}/updates", json={
        "noteEn": "The contractor resumes work next month.", "noteTa": "ஒப்பந்தக்காரர் அடுத்த மாதம் வேலையைத் தொடர்வார்.",
    }, headers=auth(office)).json()
    client.post(f"/v1/promises/manage/updates/{update['id']}/decision", json={"approve": True}, headers=auth(approver))
    after = db_session.execute(text("SELECT update_due_at, update_missed_alerted_at FROM community.promise WHERE id = :id"),
                               {"id": promise_id}).one()

    assert (not_yet, raised, again) == (0, 1, 0)
    assert told == 1 and alerted is not None
    assert (after.update_due_at, after.update_missed_alerted_at) == (None, None)


def test_feedback_is_moderated_and_the_office_replies(client, auth, office, approver, area, member_in):
    promise_id = published_promise(client, auth, office, approver, area)
    member = member_in(area, verified=True, active=True)

    sent = client.post(f"/v1/promises/{promise_id}/feedback", json={"body": "The road near the market is still broken."},
                       headers=auth(member)).json()
    hidden = client.get(f"/v1/promises/{promise_id}", headers=auth(member)).json()["feedback"]
    client.post(f"/v1/promises/manage/feedback/{sent['id']}/moderation", json={"publish": True}, headers=auth(approver))
    client.post(f"/v1/promises/manage/feedback/{sent['id']}/reply", json={
        "replyEn": "The market stretch is in phase two.", "replyTa": "சந்தைப் பகுதி இரண்டாம் கட்டத்தில் உள்ளது.",
    }, headers=auth(office))
    shown = client.get(f"/v1/promises/{promise_id}", headers=auth(member)).json()["feedback"]

    assert sent["state"] == "pending" and hidden == []
    assert [(f["body"], f["replyEn"]) for f in shown] == [
        ("The road near the market is still broken.", "The market stretch is in phase two.")
    ]


def test_promise_rules():
    assert promise_rules.check_update(current="completed", new_status="in_progress", evidence_refs=[], note="x" * 20) == [
        "not_allowed_from:completed"
    ]
    assert promise_rules.check_update(current="in_progress", new_status="withdrawn", evidence_refs=[], note="short") == [
        "reason_required"
    ]
    assert promise_rules.is_overdue("in_progress", date(2026, 1, 1), date(2026, 1, 2)) is True
    assert promise_rules.is_overdue("withdrawn", date(2026, 1, 1), date(2026, 1, 2)) is False
    # Past the due date only Completed, Withdrawn or a note without a new status are accepted.
    late = {"current": "delayed", "evidence_refs": ["Gazette 1/2027"], "note": "x" * 20, "overdue": True}
    assert promise_rules.check_update(new_status="in_progress", **late) == ["overdue_stays_delayed"]
    assert promise_rules.check_update(new_status="completed", **late) == []
    assert promise_rules.check_update(new_status=None, **late) == []
    assert promise_rules.check_second_person("drafter", "drafter", "asker") == "own_draft"
    assert promise_rules.check_second_person("drafter", "asker", "asker") == "own_draft"
    assert promise_rules.check_second_person("drafter", "third", "asker") is None


# --- Scorecards ------------------------------------------------------------------------------------------


def test_figures_need_ten_accepted_cases_and_carry_their_parts():
    facts = [
        scorecard_rules.CaseFacts(["platform", "district:D", "ds:S"], closed=i < 6, on_time=i < 3, delayed=i == 9,
                                  processing_days=10.0 if i < 6 else None, confirmed=True if i < 2 else None,
                                  reopened=i == 0)
        for i in range(10)
    ] + [scorecard_rules.CaseFacts(["platform", "district:D", "ds:T"], True, True, False, 4.0, None, False)]
    figures = scorecard_rules.figures(facts)

    assert figures["ds:T"] == {"insufficient": True}
    district = figures["district:D"]["metrics"]
    assert district["resolution_rate"] == {"value": 63.6, "numerator": 7, "denominator": 11}
    # M20: every value with its numerator and denominator; closures are out of the accepted cases.
    assert district["closed_with_evidence"] == {"value": 7, "numerator": 7, "denominator": 11}
    assert district["reopen_rate"]["numerator"] == 1 and district["currently_delayed"]["value"] == 1
    assert figures["ds:S"]["metrics"]["member_confirmed_rate"] == {"value": 100.0, "numerator": 2, "denominator": 2}


def test_quarters_follow_sri_lankan_time():
    start, end = scorecard_rules.period_bounds("2026-Q4")
    assert start == datetime(2026, 9, 30, 18, 30, tzinfo=UTC) and end == datetime(2026, 12, 31, 18, 30, tzinfo=UTC)
    assert scorecard_rules.previous_periods("2027-Q1", 4) == ["2027-Q1", "2026-Q4", "2026-Q3", "2026-Q2"]


def test_a_scorecard_is_shared_for_ten_working_days_then_published_in_versions(client, auth, approver, member_in, area,
                                                                               db_session):
    member = member_in(area, verified=True, active=True)
    unfinished = client.post("/v1/scorecards/manage", json={"period": "2099-Q1"}, headers=auth(approver))
    drafted = client.post("/v1/scorecards/manage", json={"period": "2026-Q2"}, headers=auth(approver)).json()
    shared = client.post(f"/v1/scorecards/manage/{drafted['id']}/share", headers=auth(approver)).json()
    early = client.post(f"/v1/scorecards/manage/{drafted['id']}/publish", headers=auth(approver))
    db_session.execute(text("UPDATE community.scorecard SET publishable_at = now() - interval '1 minute' WHERE id = :id"),
                       {"id": drafted["id"]})
    published = client.post(f"/v1/scorecards/manage/{drafted['id']}/publish", headers=auth(approver)).json()
    # A correction names one of the card's areas (there are no cases in this quarter, so one is set).
    db_session.execute(text("UPDATE community.scorecard SET figures = CAST(:f AS jsonb) WHERE id = :id"),
                       {"f": json.dumps({f"district:{area.district}": {"insufficient": True}}), "id": drafted["id"]})
    correction = client.post(f"/v1/scorecards/manage/{drafted['id']}/corrections", json={
        "areaKey": f"district:{area.district}", "metric": "resolution_rate", "reason": "Two closures were recorded late.",
    }, headers=auth(approver)).json()
    version_two = client.post(f"/v1/scorecards/manage/corrections/{correction['id']}/decision",
                              json={"accept": True, "note": "Late closures included."}, headers=auth(approver)).json()
    mine = client.get("/v1/scorecards/area", headers=auth(member)).json()
    versions = client.get("/v1/scorecards/manage", headers=auth(approver)).json()

    assert unfinished.json()["detail"]["problems"] == ["period_not_finished"]
    assert shared["state"] == "shared" and shared["publishableAt"] is not None
    assert early.json()["detail"]["problems"] == ["review_period_running"]
    assert published["state"] == "published"
    assert (version_two["version"], version_two["state"], version_two["correctionReason"]) == (2, "published",
                                                                                              "Late closures included.")
    states = {(v["period"], v["version"]): v["state"] for v in versions if v["period"] == "2026-Q2"}
    assert states == {("2026-Q2", 1): "superseded", ("2026-Q2", 2): "published"}
    assert [a["areaKey"].split(":")[0] for a in mine["areas"]] == ["gn", "ds", "district"]
    assert mine["areas"][0]["periods"][0]["figures"] == {"insufficient": True}


def _published_version(client, auth, approver, db_session, period):
    drafted = client.post("/v1/scorecards/manage", json={"period": period}, headers=auth(approver))
    assert drafted.status_code == 201, drafted.json()
    card_id = drafted.json()["id"]
    client.post(f"/v1/scorecards/manage/{card_id}/share", headers=auth(approver))
    db_session.execute(text("UPDATE community.scorecard SET publishable_at = now() - interval '1 minute' WHERE id = :id"),
                       {"id": card_id})
    published = client.post(f"/v1/scorecards/manage/{card_id}/publish", headers=auth(approver))
    assert published.status_code == 200, published.json()
    return published.json()


def test_a_new_version_of_a_published_quarter_supersedes_the_old_one(client, auth, approver, member_in, area, db_session):
    member = member_in(area, verified=True, active=True)

    first = _published_version(client, auth, approver, db_session, "2026-Q3")
    second = _published_version(client, auth, approver, db_session, "2026-Q3")
    versions = client.get("/v1/scorecards/manage", headers=auth(approver)).json()
    mine = client.get("/v1/scorecards/area", headers=auth(member)).json()

    states = {v["version"]: v["state"] for v in versions if v["period"] == "2026-Q3"}
    assert states == {first["version"]: "superseded", second["version"]: "published"}
    assert [p["period"] for p in mine["areas"][0]["periods"]].count("2026-Q3") == 1  # members see the quarter once


def test_sharing_tells_the_case_handlers_of_its_areas_and_only_they_ask_for_corrections(
    client, auth, approver, create_member, assign, super_admin, area, db_session
):
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
        {"d": area.district},
    )
    local, elsewhere = create_member(verified=True), create_member(verified=True)
    assign(local, "3A", "district", area.district, ["cases.decide_district"], granted_by=super_admin)
    assign(elsewhere, "3A", "district", other_district, ["cases.decide_district"], granted_by=super_admin)
    key = f"district:{area.district}"
    drafted = client.post("/v1/scorecards/manage", json={"period": "2026-Q1"}, headers=auth(approver)).json()
    db_session.execute(text("UPDATE community.scorecard SET figures = CAST(:f AS jsonb) WHERE id = :id"),
                       {"f": json.dumps({key: {"insufficient": True}}), "id": drafted["id"]})

    client.post(f"/v1/scorecards/manage/{drafted['id']}/share", headers=auth(approver))
    correction = {"metric": "accepted", "reason": "Two accepted cases are missing."}
    outside = client.post(f"/v1/scorecards/manage/{drafted['id']}/corrections", json={"areaKey": key, **correction},
                          headers=auth(elsewhere))
    not_on_card = client.post(f"/v1/scorecards/manage/{drafted['id']}/corrections",
                              json={"areaKey": f"district:{other_district}", **correction}, headers=auth(local))
    asked = client.post(f"/v1/scorecards/manage/{drafted['id']}/corrections", json={"areaKey": key, **correction},
                        headers=auth(local))

    def told(person):
        return db_session.scalar(
            text("SELECT count(*) FROM notifications.notification WHERE member_id = :m AND template = 'scorecard_shared' "
                 "AND target_id = :s"),
            {"m": person.id, "s": drafted["id"]},
        )

    assert (told(local), told(elsewhere), told(approver)) == (1, 0, 0)
    assert (outside.status_code, outside.json()["detail"]) == (403, "outside_your_area")
    assert not_on_card.json()["detail"]["problems"] == ["area_not_on_scorecard"]
    assert asked.status_code == 201 and asked.json()["areaKey"] == key
