"""Volunteering (BRD H10 to H12, S10, FR-VOL-001 to 008) against a real database."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.engagement.volunteering import rules


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def coordinator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "2B", "ds", area.ds, ["volunteers.manage"], granted_by=super_admin)
    return person


def briefing(area, **overrides):
    starts = datetime.now(UTC) + timedelta(days=5)
    return {
        "titleEn": "Health camp at the school", "titleTa": "பாடசாலையில் சுகாதார முகாம்",
        "roleEn": "Registration desk", "roleTa": "பதிவு மேசை",
        "descriptionEn": "Help families register for the free health camp.",
        "descriptionTa": "இலவச சுகாதார முகாமுக்குக் குடும்பங்கள் பதிவுசெய்ய உதவுங்கள்.",
        "placeEn": "Nallur Central School hall", "placeTa": "நல்லூர் மத்திய பாடசாலை மண்டபம்",
        "bringEn": "Water bottle and a pen", "bringTa": "தண்ணீர்ப் போத்தலும் பேனாவும்",
        "teamEn": "Nallur volunteer team", "teamTa": "நல்லூர் தன்னார்வக் குழு",
        "startsAt": starts.isoformat(), "endsAt": (starts + timedelta(hours=4)).isoformat(),
        "skills": ["event_logistics"], "places": 1,
        "area": {"level": "ds", "code": area.ds},
        **overrides,
    }


def open_opportunity(client, auth, coordinator, area, **overrides):
    created = client.post("/v1/volunteering/manage/opportunities", json=briefing(area, **overrides), headers=auth(coordinator))
    assert created.status_code == 201, created.json()
    opened = client.post(f"/v1/volunteering/manage/opportunities/{created.json()['id']}/state", json={"state": "open"},
                         headers=auth(coordinator))
    return opened.json()


def notices(db_session, member, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = :t"),
        {"id": member.id, "t": template},
    )


def test_skills_are_saved_only_with_consent_and_shown_to_coordinators(client, auth, member_in, area, coordinator):
    member = member_in(area, verified=True, active=True)

    listing = client.get("/v1/volunteering/skills", headers=auth(member)).json()
    unconsented = client.put("/v1/volunteering/profile", json={
        "skills": ["teaching", "translation"], "availability": ["weekends"], "travelArea": "my_ds", "consent": False,
    }, headers=auth(member))
    saved = client.put("/v1/volunteering/profile", json={
        "skills": ["teaching", "translation"], "availability": ["weekends"], "travelArea": "my_ds", "consent": True,
    }, headers=auth(member))
    seen = client.get("/v1/volunteering/manage/volunteers", headers=auth(coordinator)).json()

    assert [s["key"] for s in listing["skills"]] == ["teaching", "it_support", "translation", "field_work", "event_logistics"]
    assert listing["profile"] is None
    assert unconsented.json()["detail"]["problems"] == ["consent_required"]
    assert saved.json()["skills"] == ["teaching", "translation"] and saved.json()["travelArea"] == "my_ds"
    mine = [card for card in seen if card["memberId"] == str(member.id)]
    assert mine and mine[0]["availability"] == ["weekends"] and "phone" not in mine[0]

    client.delete("/v1/volunteering/profile", headers=auth(member))
    after = client.get("/v1/volunteering/manage/volunteers", headers=auth(coordinator)).json()
    assert str(member.id) not in [card["memberId"] for card in after]


def test_an_offer_is_confirmed_with_a_role_and_meeting_point(client, auth, member_in, area, coordinator, db_session):
    member = member_in(area, verified=True, active=True)
    opportunity = open_opportunity(client, auth, coordinator, area)

    listed = client.get("/v1/volunteering/opportunities", headers=auth(member)).json()
    offered = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member))
    again = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member))
    offer_id = offered.json()["id"]
    cards = client.get(f"/v1/volunteering/manage/opportunities/{opportunity['id']}/offers", headers=auth(coordinator)).json()
    missing_place = client.post(f"/v1/volunteering/manage/offers/{offer_id}/decision", json={"confirm": True},
                                headers=auth(coordinator))
    confirmed = client.post(f"/v1/volunteering/manage/offers/{offer_id}/decision", json={
        "confirm": True, "meetingPointEn": "School gate, 8:30", "meetingPointTa": "பாடசாலை வாயில், 8:30",
    }, headers=auth(coordinator))
    mine = client.get("/v1/volunteering/assignments", headers=auth(member)).json()

    assert [o["id"] for o in listed] == [opportunity["id"]]
    assert all(listed[0][key] for key in ("startsAt", "placeEn", "roleEn", "bringEn", "teamEn"))  # FR-VOL-004
    assert offered.status_code == 201 and offered.json()["state"] == "offered" and offered.json()["offerRef"].startswith("VF-")
    assert again.json()["detail"]["problems"] == ["already_offered"]
    assert cards[0]["volunteerName"] and "phone" not in cards[0]
    assert missing_place.json()["detail"]["problems"] == ["meeting_point_required"]
    assert confirmed.json()["state"] == "confirmed" and confirmed.json()["roleEn"] == "Registration desk"
    assert mine[0]["offer"]["meetingPointEn"] == "School gate, 8:30"
    assert [e["toState"] for e in mine[0]["history"]] == ["offered", "confirmed"]
    assert notices(db_session, member, "volunteer_confirmed") == 1

    second = member_in(area, verified=True, active=True)
    late = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(second)).json()["id"]
    full = client.post(f"/v1/volunteering/manage/offers/{late}/decision", json={
        "confirm": True, "meetingPointEn": "Gate", "meetingPointTa": "வாயில்",
    }, headers=auth(coordinator))
    assert full.json()["detail"]["problems"] == ["places_filled"]


def test_a_change_request_needs_a_reason_and_confirmation_and_reaches_the_coordinator(
    client, auth, member_in, area, coordinator, db_session
):
    member = member_in(area, verified=True, active=True)
    opportunity = open_opportunity(client, auth, coordinator, area)
    offer_id = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member)).json()["id"]

    too_early = client.post(f"/v1/volunteering/offers/{offer_id}/contact",
                            json={"kind": "change_request", "body": "I can only come after ten.", "confirmed": True},
                            headers=auth(member))
    client.post(f"/v1/volunteering/manage/offers/{offer_id}/decision", json={
        "confirm": True, "meetingPointEn": "School gate", "meetingPointTa": "பாடசாலை வாயில்",
    }, headers=auth(coordinator))
    unconfirmed = client.post(f"/v1/volunteering/offers/{offer_id}/contact",
                              json={"kind": "change_request", "body": "I can only come after ten.", "confirmed": False},
                              headers=auth(member))
    sent = client.post(f"/v1/volunteering/offers/{offer_id}/contact",
                       json={"kind": "change_request", "body": "I can only come after ten.", "confirmed": True},
                       headers=auth(member))
    inbox = client.get("/v1/volunteering/manage/inbox", headers=auth(coordinator)).json()
    answered = client.post(f"/v1/volunteering/manage/inbox/{sent.json()['id']}/answer",
                           json={"answer": "That is fine, come at ten."}, headers=auth(coordinator))
    mine = client.get("/v1/volunteering/assignments", headers=auth(member)).json()[0]

    assert too_early.json()["detail"]["problems"] == ["not_confirmed"]
    assert unconfirmed.json()["detail"]["problems"] == ["confirmation_required"]
    assert sent.status_code == 201 and notices(db_session, coordinator, "volunteer_contact_received") == 1
    assert [item["kind"] for item in inbox] == ["change_request"] and "phone" not in inbox[0]
    assert answered.json()["state"] == "answered"
    assert mine["offer"]["state"] == "confirmed"  # the assignment stays as it is (FR-VOL-008)
    assert mine["contacts"][0]["answer"] == "That is fine, come at ten."
    assert notices(db_session, member, "volunteer_answered") == 1


def test_only_verified_active_members_offer_and_only_in_their_area(client, auth, member_in, area, coordinator, db_session):
    pending = member_in(area)
    opportunity = open_opportunity(client, auth, coordinator, area)
    other = db_session.execute(
        text(
            """SELECT g.gn_code AS gn, g.ds_code AS ds, ds.district_code AS district FROM geo.gn_division g
               JOIN geo.ds_division ds ON ds.ds_code = g.ds_code WHERE g.ds_code <> :ds ORDER BY g.gn_code LIMIT 1"""
        ),
        {"ds": area.ds},
    ).one()
    elsewhere = member_in(other, verified=True, active=True)

    refused = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(pending))
    hidden = client.get(f"/v1/volunteering/opportunities/{opportunity['id']}", headers=auth(elsewhere))

    assert refused.json()["detail"]["problems"] == ["identity_not_verified"]
    assert hidden.status_code == 404
    assert client.get("/v1/volunteering/opportunities", headers=auth(elsewhere)).json() == []


def test_coordinators_work_only_inside_their_area(client, auth, create_member, assign, super_admin, area, db_session):
    other_ds = db_session.scalar(text("SELECT ds_code FROM geo.ds_division WHERE ds_code <> :ds ORDER BY ds_code LIMIT 1"),
                                 {"ds": area.ds})
    outsider = create_member(verified=True)
    assign(outsider, "2B", "ds", other_ds, ["volunteers.manage"], granted_by=super_admin)

    refused = client.post("/v1/volunteering/manage/opportunities", json=briefing(area), headers=auth(outsider))

    assert (refused.status_code, refused.json()["detail"]) == (403, "outside_your_area")


def test_cancelling_tells_everyone_who_offered(client, auth, member_in, area, coordinator, db_session):
    member = member_in(area, verified=True, active=True)
    opportunity = open_opportunity(client, auth, coordinator, area)
    client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member))

    no_reason = client.post(f"/v1/volunteering/manage/opportunities/{opportunity['id']}/state", json={"state": "cancelled"},
                            headers=auth(coordinator))
    cancelled = client.post(f"/v1/volunteering/manage/opportunities/{opportunity['id']}/state",
                            json={"state": "cancelled", "reason": "The camp moved to next month."}, headers=auth(coordinator))

    assert no_reason.json()["detail"]["problems"] == ["reason_required"]
    assert cancelled.json()["state"] == "cancelled"
    assert client.get("/v1/volunteering/assignments", headers=auth(member)).json()[0]["offer"]["state"] == "cancelled"
    assert notices(db_session, member, "volunteer_cancelled") == 1


def test_the_offer_history_cannot_be_rewritten(client, auth, member_in, area, coordinator, db_session):
    member = member_in(area, verified=True, active=True)
    opportunity = open_opportunity(client, auth, coordinator, area)
    client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member))

    with pytest.raises(Exception, match="append-only"):
        with db_session.begin_nested():
            db_session.execute(text("DELETE FROM engagement.volunteer_offer_event"))


def test_rules_for_offers_and_decisions():
    now = datetime.now(UTC)
    later = now + timedelta(days=1)
    assert rules.check_offer(identity_verified=True, membership_active=False, state="open", starts_at=later, now=now,
                             existing_state=None) == "membership_not_active"
    assert rules.check_offer(identity_verified=True, membership_active=True, state="open", starts_at=now, now=now,
                             existing_state=None) == "opportunity_not_open"
    assert rules.check_offer(identity_verified=True, membership_active=True, state="open", starts_at=later, now=now,
                             existing_state="withdrawn") is None
    assert rules.check_decision(offer_state="offered", confirm=False, confirmed=0, places=1, reason=" ",
                                meeting_point_en=None, meeting_point_ta=None) == "reason_required"
    assert rules.check_move("draft", "closed", None) == "not_allowed_from:draft"
    assert rules.visible_to("ds:A", ["platform", "province:P", "district:D", "ds:A", "gn:G"]) is True
    assert rules.visible_to("ds:B", ["platform", "province:P", "district:D", "ds:A", "gn:G"]) is False


def test_an_offer_appears_in_my_activity(client, auth, member_in, area, coordinator):
    member = member_in(area, verified=True, active=True)
    opportunity = open_opportunity(client, auth, coordinator, area)
    offer = client.post(f"/v1/volunteering/opportunities/{opportunity['id']}/offer", headers=auth(member)).json()

    activity = client.get("/v1/profile/activity?kind=volunteer_offer", headers=auth(member)).json()

    assert [(a["reference"], a["state"]) for a in activity] == [(offer["offerRef"], "offered")]


def test_a_coordinator_reads_one_opportunity(client, auth, area, coordinator):
    opportunity = open_opportunity(client, auth, coordinator, area)

    found = client.get(f"/v1/volunteering/manage/opportunities/{opportunity['id']}", headers=auth(coordinator)).json()

    assert (found["id"], found["places"], found["state"]) == (opportunity["id"], 1, "open")
