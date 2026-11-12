"""My Area, issue reporting and the five-tier case workflow (BRD H05 to H09, W03 to W08,
FR-RPT-001 to 017, FR-WEB-014 to 029) against a real database."""

import io
import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from PIL import Image
from sqlalchemy import text

from app.modules.community.issues import breaches

DESCRIPTION = "The water pipe beside the school gate has been leaking for a week and the road is flooding."


@pytest.fixture
def client(identity_client):
    return identity_client


@pytest.fixture
def team(create_member, assign, area, super_admin):
    """One person for each tier of the decision line in the test area; the Super Administrator
    (Tier 5 by default holds cases.approve_executive) grants the others."""

    def staff(tier, level, code, permissions):
        person = create_member(verified=True)
        assign(person, tier, level, code, permissions, granted_by=super_admin)
        return person

    return {
        "gn": staff("1", "gn", area.gn, ["cases.collect", "cases.view_reporter_contact"]),
        "ds": staff("2A", "ds", area.ds, ["cases.research", "cases.view_reporter_contact"]),
        "ds_assistant": staff("2B", "ds", area.ds, ["cases.research"]),
        "district": staff(
            "3A", "district", area.district,
            ["cases.decide_district", "cases.implement_and_close", "cases.view_reporter_contact", "content.moderate"],
        ),
        "regional": staff("4", "province", area.province, ["cases.plan_regional", "cases.implement_and_close"]),
        "executive": super_admin,
    }


def notices(db_session, member, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = :template"),
        {"id": member.id, "template": template},
    )


def report(client, auth, member, **overrides):
    body = {
        "clientReference": str(uuid.uuid4()),
        "category": "water",
        "title": "Leaking water pipe at the school",
        "description": DESCRIPTION,
        "locationKind": "my_gn",
        "visibility": "team",
        **overrides,
    }
    return client.post("/v1/issues", json=body, headers=auth(member))


def jpeg_with_camera_details() -> bytes:
    image = Image.new("RGB", (900, 600), "steelblue")
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    exif[0x0110] = "Model 7"  # Model
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def staff_post(client, auth, person, case_id, step, body):
    return client.post(f"/v1/cases/{case_id}/{step}", json=body, headers=auth(person))


def in_days(days):
    return (date.today() + timedelta(days=days)).isoformat()


# --- Reporting ------------------------------------------------------------------------------------------


def test_only_verified_and_active_members_may_report(client, auth, member_in, area):
    pending = member_in(area)

    options = client.get("/v1/issues/reporting", headers=auth(pending)).json()
    refused = report(client, auth, pending)

    assert (options["allowed"], options["reason"]) == (False, "identity_not_verified")
    assert options["categories"][0] == "road" and options["descriptionMin"] == 20
    assert refused.status_code == 422
    assert refused.json()["detail"] == {"code": "issue_refused", "problems": ["identity_not_verified"]}


def test_a_report_becomes_one_case_however_often_submit_is_tapped(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    reference = str(uuid.uuid4())

    first = report(client, auth, member, clientReference=reference)
    second = report(client, auth, member, clientReference=reference)

    assert first.status_code == second.status_code == 201
    receipt = first.json()
    assert receipt["id"] == second.json()["id"] and receipt["caseNumber"].startswith("CI-")
    assert (receipt["status"], receipt["stage"], receipt["responsibleTier"]) == ("received", 1, "gn_coordinator")
    assert receipt["report"]["nextStep"] == "gn_review" and receipt["report"]["visibility"] == "team"
    assert receipt["steps"][0]["reachedAt"] is not None and receipt["steps"][1]["reachedAt"] is None
    count = db_session.scalar(text("SELECT count(*) FROM community.issue WHERE reporter_id = :id"), {"id": member.id})
    assert count == 1
    # The area's only GN coordinator owns the new case and is told.
    case = client.get(f"/v1/cases/{receipt['id']}", headers=auth(team["gn"])).json()
    assert case["ownerId"] == str(team["gn"].id)
    assert notices(db_session, team["gn"], "case_assigned") == 1
    assert client.get("/v1/issues/mine", headers=auth(member)).json()["items"][0]["id"] == receipt["id"]


def test_a_place_is_needed_and_typed_places_work_without_gps(client, auth, member_in, area, team):
    member = member_in(area, verified=True, active=True)

    missing = report(client, auth, member, locationKind="landmark")
    typed = report(client, auth, member, locationKind="text", locationText="Nallur bus stop junction")

    assert missing.json()["detail"]["problems"] == ["location_required"]
    assert typed.status_code == 201 and typed.json()["report"]["locationText"] == "Nallur bus stop junction"


def test_report_photos_lose_their_metadata_and_stay_out_of_the_gallery(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)

    uploaded = client.post(
        "/v1/issues/photos", content=jpeg_with_camera_details(), headers={**auth(member), "Content-Type": "image/jpeg"}
    )
    photo_id = uploaded.json()["id"]
    sent = report(client, auth, member, photoIds=[photo_id])
    case_id = sent.json()["id"]
    image = client.get(f"/v1/cases/{case_id}/photos/{photo_id}", headers=auth(team["gn"]))

    assert uploaded.status_code == 201 and sent.json()["report"]["photos"] == 1
    assert image.headers["content-type"] == "image/webp"
    with Image.open(io.BytesIO(image.content)) as stored:
        assert dict(stored.getexif()) == {}
    assert db_session.scalar(text("SELECT count(*) FROM content.photo WHERE id = :id"), {"id": photo_id}) == 0
    # Someone else's photo cannot be attached to a report.
    other = member_in(area, verified=True, active=True)
    stolen = report(client, auth, other, photoIds=[photo_id])
    assert stolen.json()["detail"]["problems"] == ["photo_not_found"]


# --- The decision line ----------------------------------------------------------------------------------


def test_a_case_climbs_from_gn_to_executive_and_is_closed_with_evidence(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]
    gn, ds, district, regional, executive = (team[k] for k in ("gn", "ds", "district", "regional", "executive"))

    # W03: nothing is forwarded without a fact, a completeness check and an eligible DS owner.
    early = staff_post(client, auth, gn, case_id, "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True, "ownerId": str(ds.id), "note": "Seen on site",
    })
    assert early.status_code == 409 and early.json()["detail"]["problems"] == ["facts_required"]
    no_source = staff_post(client, auth, gn, case_id, "facts", {"statement": "Pipe cracked at the joint"})
    assert no_source.status_code == 422
    assert staff_post(client, auth, gn, case_id, "facts", {"statement": "Pipe cracked at the joint",
                                                            "source": "Site visit by GN coordinator"}).status_code == 200
    wrong_owner = staff_post(client, auth, gn, case_id, "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True,
        "ownerId": str(team["ds_assistant"].id), "note": "Seen on site",
    })
    assert wrong_owner.json()["detail"]["problems"] == ["owner_not_eligible"]  # 2B never owns a decision
    forwarded = staff_post(client, auth, gn, case_id, "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True, "ownerId": str(ds.id),
        "note": "Confirmed on site; needs the water board.",
    })
    assert forwarded.json()["stage"] == "ds" and forwarded.json()["ownerName"]
    assert notices(db_session, member, "issue_progress") == 1
    assert notices(db_session, ds, "case_assigned") == 1

    # W04: the assistant adds findings but cannot send the report (FR-WEB-020).
    assert staff_post(client, auth, team["ds_assistant"], case_id, "findings",
                      {"kind": "stakeholder", "statement": "School principal"}).status_code == 200
    assisted = client.get(f"/v1/cases/{case_id}", headers=auth(team["ds_assistant"])).json()
    assert "finding" in assisted["allowedActions"] and "ds_report" not in assisted["allowedActions"]
    refused = staff_post(client, auth, team["ds_assistant"], case_id, "ds-report", {
        "summary": "Leak confirmed", "recommendation": "Repair the main", "districtOwnerId": str(district.id),
    })
    assert refused.status_code == 403
    sent = staff_post(client, auth, ds, case_id, "ds-report", {
        "summary": "Leak confirmed by the water board inspector.", "evidenceRefs": ["NWSDB inspection 2026/77"],
        "recommendation": "Replace the cracked section of the main.", "districtOwnerId": str(district.id),
    })
    assert sent.json()["stage"] == "district"

    # W05: escalation is recorded as escalated, never approved.
    escalated = staff_post(client, auth, district, case_id, "district-decision", {
        "decision": "escalate", "reason": "Cost is beyond district authority.",
        "decisionRequired": "Funding for the replacement", "regionalOwnerId": str(regional.id),
    })
    assert escalated.json()["stage"] == "regional"
    assert [h["kind"] for h in escalated.json()["history"]][-1] == "escalated"

    # W06 and W07.
    planned = staff_post(client, auth, regional, case_id, "regional-plan", {
        "solution": "Replace 40 m of main with the water board.", "responsibleTier": "4",
        "resources": "Water board crew", "expectedOutcome": "No leak; road dry.",
        "reportingPlan": "Weekly photo update to Tier 5.",
    })
    assert planned.json()["stage"] == "executive"
    incomplete = staff_post(client, auth, executive, case_id, "executive-decision", {"decision": "approve", "scope": "Main"})
    assert incomplete.json()["detail"]["problems"] == ["conditions_and_implementer_required"]
    approved = staff_post(client, auth, executive, case_id, "executive-decision", {
        "decision": "approve", "conditions": "Work outside school hours.", "implementerId": str(regional.id),
        "scope": "Replace the cracked main section.", "reportingDuty": "Weekly", "dueDate": in_days(30),
    })
    assert approved.json()["stage"] == "implementation" and approved.json()["implementationDueAt"]

    # W08: Resolved only with evidence and a member summary in both languages.
    staff_post(client, auth, regional, case_id, "progress", {"step": "Trench dug", "evidenceRefs": ["Photo log 1"]})
    unproven = staff_post(client, auth, regional, case_id, "close", {
        "outcome": "Main replaced and tested.", "summaryEn": "The pipe has been replaced.",
        "summaryTa": "குழாய் மாற்றப்பட்டது, நீர்க்கசிவு நிறுத்தப்பட்டது.",
    })
    assert unproven.json()["detail"]["problems"] == ["evidence_required"]
    closed = staff_post(client, auth, regional, case_id, "close", {
        "outcome": "Main replaced and tested.", "evidenceRefs": ["Water board completion note 114"],
        "summaryEn": "The pipe has been replaced and the leak has stopped.",
        "summaryTa": "குழாய் மாற்றப்பட்டது, நீர்க்கசிவு நிறுத்தப்பட்டது.",
    })
    assert (closed.json()["stage"], closed.json()["closedLevel"]) == ("resolved", "executive")
    kinds = [h["kind"] for h in closed.json()["history"]]
    assert kinds[:2] == ["submitted", "fact"] and kinds[-1] == "closed"
    assert all(h["previousOwnerName"] is not None for h in closed.json()["history"] if h["kind"] in ("ds_report", "escalated"))

    view = client.get(f"/v1/issues/{case_id}", headers=auth(member)).json()
    assert (view["status"], view["stage"], view["report"]["nextStep"]) == ("resolved", 4, "rate_closure")
    assert all(step["reachedAt"] for step in view["steps"])
    assert view["closingSummaryTa"].startswith("குழாய்")
    assert notices(db_session, member, "issue_closed") == 1


def test_a_challenge_reopens_the_case_with_a_new_owner(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]
    gn, ds, district = team["gn"], team["ds"], team["district"]
    staff_post(client, auth, gn, case_id, "facts", {"statement": "Leak seen", "source": "Visit"})
    staff_post(client, auth, gn, case_id, "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True, "ownerId": str(ds.id), "note": "Seen on site",
    })
    staff_post(client, auth, ds, case_id, "ds-report", {
        "summary": "Small leak at the joint.", "recommendation": "District maintenance crew can fix it.",
        "districtOwnerId": str(district.id),
    })
    acted = staff_post(client, auth, district, case_id, "district-decision", {
        "decision": "act", "authority": "District maintenance budget", "resources": "Two plumbers",
        "office": "District secretariat", "ownerId": str(district.id), "dueDate": in_days(7),
    })
    assert acted.json().get("stage") == "implementation", acted.json()
    closed = staff_post(client, auth, district, case_id, "close", {
        "outcome": "Joint resealed.", "evidenceRefs": ["Job card 55"], "summaryEn": "The joint was resealed.",
        "summaryTa": "இணைப்பு மீண்டும் அடைக்கப்பட்டது.",
    })
    assert closed.json()["closedLevel"] == "district"
    # FR-WEB-022: Tiers 4 and 5 hear about every district closure, and can list them.
    assert notices(db_session, team["regional"], "case_district_closure") == 1
    assert notices(db_session, team["executive"], "case_district_closure") == 1
    listed = client.get("/v1/cases", params={"districtClosures": True}, headers=auth(team["executive"])).json()
    assert case_id in [item["id"] for item in listed["items"]]

    challenged = client.post(
        f"/v1/issues/{case_id}/closure-response", json={"resolved": False, "note": "It is leaking again."},
        headers=auth(member),
    )
    again = client.post(f"/v1/issues/{case_id}/closure-response", json={"resolved": True, "rating": 4}, headers=auth(member))
    assert challenged.status_code == 200 and challenged.json()["report"]["response"]["state"] == "challenge_open"
    assert again.json()["detail"]["problems"] == ["already_responded"]
    assert notices(db_session, district, "case_challenged") == 1

    reopened = staff_post(client, auth, district, case_id, "challenge-decision", {
        "accept": True, "reason": "Leak confirmed again on a second visit.", "stage": "implementation",
        "ownerId": str(team["regional"].id), "dueDate": in_days(10),
    })
    assert (reopened.json()["stage"], reopened.json()["ownerId"]) == ("implementation", str(team["regional"].id))
    assert reopened.json()["closedAt"] is None and [h["kind"] for h in reopened.json()["history"]][-1] == "reopened"
    assert notices(db_session, member, "issue_challenge_decided") == 1


def test_a_returned_report_comes_back_to_the_gn_stage_when_the_reporter_answers(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]

    returned = staff_post(client, auth, team["gn"], case_id, "return", {"question": "Which side of the gate is the leak?"})
    view = client.get(f"/v1/issues/{case_id}", headers=auth(member)).json()
    reply = client.post(f"/v1/issues/{case_id}/information", json={"body": "On the left, near the bus stop."},
                        headers=auth(member))
    case = client.get(f"/v1/cases/{case_id}", headers=auth(team["gn"])).json()

    assert returned.json()["stage"] == "returned"
    assert (view["status"], view["report"]["returnedQuestion"], view["report"]["nextStep"]) == (
        "needs_details", "Which side of the gate is the leak?", "add_details",
    )
    assert notices(db_session, member, "issue_returned") == 1
    assert reply.status_code == 201 and reply.json()["isReply"] is True
    assert case["stage"] == "gn" and case["additions"][0]["fromReporter"] is True
    assert notices(db_session, team["gn"], "case_reporter_replied") == 1


def test_a_duplicate_is_linked_and_its_reporter_hears_the_parents_progress(client, auth, member_in, area, team, db_session):
    first, second = (member_in(area, verified=True, active=True) for _ in range(2))
    parent = report(client, auth, first).json()
    child = report(client, auth, second, title="Water leaking near the school").json()

    linked = staff_post(client, auth, team["gn"], child["id"], "link", {"parentCaseNumber": parent["caseNumber"]})
    staff_post(client, auth, team["gn"], parent["id"], "facts", {"statement": "Leak seen", "source": "Visit"})
    staff_post(client, auth, team["gn"], parent["id"], "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True, "ownerId": str(team["ds"].id),
        "note": "Two reports of the same leak.",
    })
    child_view = client.get(f"/v1/issues/{child['id']}", headers=auth(second)).json()
    parent_file = client.get(f"/v1/cases/{parent['id']}", headers=auth(team["ds"])).json()

    assert linked.json()["stage"] == "linked" and linked.json()["parentCaseNumber"] == parent["caseNumber"]
    assert child_view["report"]["linkedTo"] == parent["caseNumber"] and child_view["stage"] == 2
    assert notices(db_session, second, "issue_progress") == 1
    assert [r["caseNumber"] for r in parent_file["linkedReports"]] == [child["caseNumber"]]


# --- Areas, privacy and moderation ----------------------------------------------------------------------


def test_cases_outside_the_staff_area_do_not_exist_for_them(
    client, auth, member_in, area, team, create_member, assign, super_admin, db_session
):
    other_gn = db_session.execute(
        text("SELECT gn_code FROM geo.gn_division WHERE gn_code <> :gn ORDER BY gn_code LIMIT 1"), {"gn": area.gn}
    ).scalar_one()
    elsewhere = create_member(verified=True)
    assign(elsewhere, "1", "gn", other_gn, ["cases.collect"], granted_by=super_admin)
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]

    assert client.get(f"/v1/cases/{case_id}", headers=auth(elsewhere)).status_code == 404
    assert client.get("/v1/cases", headers=auth(elsewhere)).json()["total"] == 0
    assert client.get("/v1/cases", headers=auth(member)).status_code == 403


def test_reporter_contact_is_for_the_owner_only_and_every_look_is_audited(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]

    owner_view = client.get(f"/v1/cases/{case_id}/reporter-contact", headers=auth(team["gn"]))
    district_view = client.get(f"/v1/cases/{case_id}/reporter-contact", headers=auth(team["district"]))

    assert owner_view.status_code == 200 and owner_view.json()["memberCode"].startswith("TEST-")
    assert district_view.status_code == 403
    audited = db_session.scalar(
        text("SELECT count(*) FROM ops.audit_log WHERE action = 'case.reporter_contact.viewed' AND target_id = :id"),
        {"id": case_id},
    )
    assert audited == 1


def test_staff_never_act_on_a_case_they_reported(client, auth, area, team, db_session):
    gn = team["gn"]
    db_session.execute(
        text("UPDATE npm.member SET gs_code = :gn, ds_code = :ds, district_code = :d WHERE id = :id"),
        {"gn": area.gn, "ds": area.ds, "d": area.district, "id": gn.id},
    )
    case = report(client, auth, gn).json()
    file = client.get(f"/v1/cases/{case['id']}", headers=auth(gn)).json()

    assert file["ownerId"] is None  # not given their own report
    assert "forward" not in file["allowedActions"] and "fact" not in file["allowedActions"]
    refused = staff_post(client, auth, gn, case["id"], "facts", {"statement": "Leak", "source": "Me"})
    assert (refused.status_code, refused.json()["detail"]) == (403, "own_record")


def test_a_public_summary_is_published_by_a_moderator_and_shown_in_my_area(client, auth, member_in, area, team, db_session):
    reporter = member_in(area, verified=True, active=True)
    neighbour = member_in(area, verified=True, active=True)
    case_id = report(client, auth, reporter, visibility="public").json()["id"]

    before = client.get("/v1/issues/area", headers=auth(neighbour)).json()
    hidden = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour))
    published = staff_post(client, auth, team["district"], case_id, "public-summary", {
        "publish": True, "titleEn": "Leaking water main near the school", "titleTa": "பாடசாலை அருகே நீர்க்குழாய் கசிவு",
        "summaryEn": "A leaking water main near the school gate has been reported.",
        "summaryTa": "பாடசாலை வாயில் அருகே நீர்க்குழாய் கசிவு முறையிடப்பட்டுள்ளது.",
    })
    after = client.get("/v1/issues/area", headers=auth(neighbour)).json()
    seen = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()

    assert before["hasArea"] is True and before["issues"] == [] and hidden.status_code == 404
    assert published.json()["publicState"] == "published"
    assert [i["titleEn"] for i in after["issues"]] == ["Leaking water main near the school"]
    assert seen["report"] is None and seen["canFollow"] is True
    assert DESCRIPTION not in str(seen)  # the reporter's own words stay private

    followed = client.put(f"/v1/issues/{case_id}/follow", json={"follow": True}, headers=auth(neighbour))
    added = client.post(f"/v1/issues/{case_id}/information", json={"body": "The leak is worse after rain."},
                        headers=auth(neighbour))
    assert followed.json()["following"] is True and added.json()["state"] == "pending"
    assert client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()["communityUpdates"] == []
    addition_id = added.json()["id"]
    staff_post(client, auth, team["district"], case_id, f"additions/{addition_id}/moderation", {"approve": True})
    updates = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()["communityUpdates"]
    assert [u["body"] for u in updates] == ["The leak is worse after rain."]

    staff_post(client, auth, team["gn"], case_id, "facts", {"statement": "Leak seen", "source": "Visit"})
    staff_post(client, auth, team["gn"], case_id, "forward", {
        "locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True, "ownerId": str(team["ds"].id),
        "note": "Seen on site",
    })
    assert notices(db_session, neighbour, "issue_followed_progress") == 1
    assert client.get("/v1/issues/area", headers=auth(neighbour)).json()["updates"][0]["stage"] == 2


def test_a_team_only_report_cannot_be_published(client, auth, member_in, area, team):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]

    refused = staff_post(client, auth, team["district"], case_id, "public-summary", {
        "publish": True, "titleEn": "Leaking water main", "titleTa": "நீர்க்குழாய் கசிவு",
        "summaryEn": "A leaking water main was reported.", "summaryTa": "நீர்க்குழாய் கசிவு முறையிடப்பட்டது.",
    })
    assert refused.status_code == 403


# --- Time limits and history ----------------------------------------------------------------------------


def test_an_overrun_stage_alerts_the_next_tier_once(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]
    db_session.execute(
        text("UPDATE community.issue SET stage_due_at = now() - interval '1 day' WHERE id = :id"), {"id": case_id}
    )

    first = breaches.alert_breaches(db_session, datetime.now(UTC))
    second = breaches.alert_breaches(db_session, datetime.now(UTC))
    listed = client.get("/v1/cases", params={"overdue": True}, headers=auth(team["ds"])).json()

    assert (first, second) == (1, 0)
    assert notices(db_session, team["ds"], "case_overdue") == 1
    assert notices(db_session, team["gn"], "case_overdue") == 0
    assert listed["items"][0]["overdue"] is True and listed["counts"]["overdue"] == 1


def test_the_case_history_cannot_be_rewritten(client, auth, member_in, area, team, db_session):
    member = member_in(area, verified=True, active=True)
    case_id = report(client, auth, member).json()["id"]

    with pytest.raises(Exception, match="append-only"):
        with db_session.begin_nested():
            db_session.execute(text("DELETE FROM community.case_action WHERE issue_id = :id"), {"id": case_id})


def test_a_report_appears_in_my_activity(client, auth, member_in, area, team):
    member = member_in(area, verified=True, active=True)
    receipt = report(client, auth, member).json()

    activity = client.get("/v1/profile/activity?kind=issue_report", headers=auth(member)).json()

    assert [(a["kind"], a["reference"], a["state"], a["targetId"]) for a in activity] == [
        ("issue_report", receipt["caseNumber"], "gn", receipt["id"])
    ]
