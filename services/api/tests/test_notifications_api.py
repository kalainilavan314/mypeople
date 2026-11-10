"""/v1/notifications, the dispatcher and staff broadcasts against a real database. Skipped without
DATABASE_URL. Everything is rolled back; pushes go to an in-memory outbox.
"""

from datetime import UTC, datetime, time, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.integrations.push import DevelopmentPush, NoPush
from app.modules.messaging.notifications import service as notifications
from app.tasks.notifications import run_once

SEND = "notifications.send"
TOKEN = "device-token-0123456789"


@pytest.fixture
def client(identity_client) -> TestClient:
    return identity_client


def inbox(client, auth, member: Row, **query) -> dict:
    return client.get("/v1/notifications", params=query, headers=auth(member)).json()


def daytime() -> datetime:
    """Noon in Sri Lanka, outside any quiet hours these tests set."""
    return datetime(2026, 10, 26, 6, 30, tzinfo=UTC)


# --- Notices from decisions (FR-REG-021) and the inbox (H03) ---------------------------------------------


def test_an_identity_correction_is_action_needed_until_it_is_resubmitted(client, auth, upload, submitted, member_in, area, make_reviewer):
    member = member_in(area)
    reviewer = make_reviewer(area.district)
    ref = submitted(member)["reviewRef"]
    [listed] = [r for r in client.get("/v1/identity/reviews", headers=auth(reviewer)).json() if r["reviewRef"] == ref]
    client.post(f"/v1/identity/reviews/{listed['id']}/claim", headers=auth(reviewer))
    client.post(
        f"/v1/identity/reviews/{listed['id']}/decision",
        json={"decision": "request_update", "items": ["nic_back"], "reasonCategory": "image_unreadable"},
        headers=auth(reviewer),
    )

    needed = inbox(client, auth, member, view="action_needed")
    [item] = needed["items"]
    client.post(f"/v1/notifications/{item['id']}/read", headers=auth(member))
    still = inbox(client, auth, member, view="action_needed")
    upload(member, "nic_back")
    client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member))
    done = inbox(client, auth, member)

    assert (item["template"], item["targetKind"], item["targetId"]) == ("identity_needs_update", "identity_review", listed["id"])
    assert (needed["unread"], needed["actionNeeded"]) == (1, 1)
    assert still["actionNeeded"] == 1 and still["items"][0]["read"] is True  # read is not done (BR-027)
    assert done["actionNeeded"] == 0 and done["items"][0]["actionNeeded"] is False


def test_membership_changes_and_event_cancellations_reach_the_inbox(client, db_session, auth, member_in, area, make_reviewer):
    member = member_in(area, verified=True)
    activator = make_reviewer(area.district, permissions=("members.activate",))
    client.post(
        f"/v1/membership/members/{member.id}/changes",
        json={"action": "activate", "reasonCode": "identity_verified"},
        headers=auth(activator),
    )

    items = inbox(client, auth, member)["items"]
    events_only = inbox(client, auth, member, topic="events")["items"]

    assert [(i["template"], i["topic"]) for i in items] == [("membership_changed", "account")]
    assert events_only == []


# --- Choices, devices and pushes (FR-PROF-012, FR-STF-009, INT-02) ---------------------------------------


def test_choices_lock_account_and_review_and_keep_quiet_hours(client, auth, member_in, area):
    member = member_in(area)

    locked = client.put("/v1/notifications/choices", json={"topics": [{"topic": "review", "push": False, "sms": False}]}, headers=auth(member))
    chosen = client.put(
        "/v1/notifications/choices",
        json={"topics": [{"topic": "events", "push": False, "sms": False}], "quietStart": "22:00:00", "quietEnd": "06:00:00"},
        headers=auth(member),
    ).json()

    assert (locked.status_code, locked.json()) == (409, {"detail": "topic_locked"})
    topics = {c["topic"]: c for c in chosen["topics"]}
    assert (topics["events"]["push"], topics["review"]["locked"], topics["review"]["push"]) == (False, True, True)
    assert (chosen["quietStart"], chosen["quietEnd"]) == ("22:00:00", "06:00:00")


def test_pushes_follow_choices_quiet_hours_and_carry_no_personal_data(client, db_session, auth, member_in, area):
    member = member_in(area)
    client.post("/v1/notifications/devices", json={"token": TOKEN, "platform": "android"}, headers=auth(member))
    client.put("/v1/notifications/choices", json={"topics": [{"topic": "events", "push": False, "sms": False}]}, headers=auth(member))
    notifications.notify(db_session, member.id, "event_cancelled", None, body_en="Village meeting", body_ta="கூட்டம்")
    notifications.notify(db_session, member.id, "membership_changed", member.id)
    push = DevelopmentPush()

    result = notifications.dispatch(db_session, push, daytime())

    assert (result.sent, result.skipped, result.waiting) == (1, 1, 0)  # events off: skipped; account: sent
    [message] = push.sent
    assert message.token == TOKEN and "membership" in message.title and "Village" not in message.title
    states = dict(db_session.execute(
        text("SELECT template, push_state FROM notifications.notification WHERE member_id = :id"), {"id": member.id}
    ).all())
    assert states == {"event_cancelled": "skipped", "membership_changed": "sent"}


def test_quiet_hours_hold_a_push_until_they_end_and_a_dead_token_is_retired(client, db_session, auth, member_in, area):
    member = member_in(area)
    client.post("/v1/notifications/devices", json={"token": TOKEN, "platform": "ios"}, headers=auth(member))
    client.put("/v1/notifications/choices", json={"quietStart": "11:00:00", "quietEnd": "13:00:00"}, headers=auth(member))
    notifications.notify(db_session, member.id, "membership_changed", member.id)
    push = DevelopmentPush()

    during = notifications.dispatch(db_session, push, daytime())  # 12:00 local
    push.invalid_tokens.add(TOKEN)
    after = notifications.dispatch(db_session, push, daytime() + timedelta(hours=2))

    assert during.waiting == 1 and not push.sent
    assert after.skipped == 1
    assert db_session.scalar(
        text("SELECT revoked_at IS NOT NULL FROM notifications.device WHERE token = :token"), {"token": TOKEN}
    )


def test_without_a_push_provider_the_inbox_is_the_fallback(client, db_session, auth, member_in, area):
    member = member_in(area)
    client.post("/v1/notifications/devices", json={"token": TOKEN, "platform": "web"}, headers=auth(member))
    notifications.notify(db_session, member.id, "membership_changed", member.id)

    result = notifications.dispatch(db_session, NoPush(), daytime())

    assert result.skipped == 1
    assert inbox(client, auth, member)["unread"] == 1


# --- Staff broadcasts (FR-ADM-007) -------------------------------------------------------------------------


def broadcast_body(level: str, code: str | None, **overrides) -> dict:
    return {
        "topic": "announcements",
        "titleEn": "Water supply notice",
        "titleTa": "நீர் விநியோக அறிவிப்பு",
        "bodyEn": "Water will be off on Saturday morning.",
        "bodyTa": "சனிக்கிழமை காலை நீர் நிறுத்தப்படும்.",
        "area": {"level": level, "code": code},
        **overrides,
    }


def _activate(db_session, member: Row) -> None:
    db_session.execute(
        text(
            "INSERT INTO membership.membership (member_id, state, reason_code) "
            "VALUES (:id, 'active', 'identity_verified') ON CONFLICT (member_id) DO UPDATE SET state = 'active'"
        ),
        {"id": member.id},
    )


def test_a_district_broadcast_reaches_the_district_and_nobody_else(client, db_session, auth, member_in, create_member, area, make_reviewer):
    coordinator = make_reviewer(area.district, permissions=(SEND,))
    # The default audience is the area's Active members (D09), so an active member
    # outside the district shows the area boundary and a member in the district
    # without an Active membership shows the membership condition.
    inside, not_active, outside = member_in(area), member_in(area), create_member()
    for member in (inside, outside):
        _activate(db_session, member)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )

    elsewhere = client.post("/v1/notifications/broadcasts", json=broadcast_body("district", other_district), headers=auth(coordinator))
    draft = client.post("/v1/notifications/broadcasts", json=broadcast_body("district", area.district), headers=auth(coordinator)).json()
    preview = client.post(f"/v1/notifications/broadcasts/{draft['id']}/preview", headers=auth(coordinator)).json()
    scheduled = client.post(f"/v1/notifications/broadcasts/{draft['id']}/submit", json={}, headers=auth(coordinator)).json()
    result = run_once(db_session, NoPush())

    assert (elsewhere.status_code, elsewhere.json()) == (403, {"detail": "outside_your_area"})  # BR-083
    assert preview["reaches"] >= 1 and preview["problems"] == [] and preview["needsApproval"] is False
    assert scheduled["state"] == "scheduled" and result["broadcastsSent"] >= 1
    assert [i["titleEn"] for i in inbox(client, auth, inside, topic="announcements")["items"]] == ["Water supply notice"]
    assert inbox(client, auth, not_active)["items"] == []
    assert inbox(client, auth, outside)["items"] == []
    sent = client.get("/v1/notifications/broadcasts", params={"state": "sent"}, headers=auth(coordinator)).json()
    assert [b["recipients"] for b in sent if b["id"] == draft["id"]] == [preview["reaches"]]


def test_a_broadcast_with_an_id_number_is_refused(client, auth, area, make_reviewer):
    coordinator = make_reviewer(area.district, permissions=(SEND,))
    draft = client.post(
        "/v1/notifications/broadcasts",
        json=broadcast_body("district", area.district, bodyEn="Bring 199012345678 to the office."),
        headers=auth(coordinator),
    ).json()

    response = client.post(f"/v1/notifications/broadcasts/{draft['id']}/submit", json={}, headers=auth(coordinator))

    assert (response.status_code, response.json()["detail"]["problems"]) == (422, ["contains_id_number"])


def test_a_province_broadcast_waits_for_a_senior_second_person(client, auth, area, make_reviewer):
    regional = make_reviewer(area.province, permissions=(SEND,), tier="4", level="province")
    other_regional = make_reviewer(area.province, permissions=(SEND,), tier="4", level="province")
    draft = client.post("/v1/notifications/broadcasts", json=broadcast_body("province", area.province), headers=auth(regional)).json()

    submitted = client.post(f"/v1/notifications/broadcasts/{draft['id']}/submit", json={}, headers=auth(regional)).json()
    own = client.post(f"/v1/notifications/broadcasts/{draft['id']}/approve", headers=auth(regional))
    approved = client.post(f"/v1/notifications/broadcasts/{draft['id']}/approve", headers=auth(other_regional)).json()

    assert submitted["state"] == "pending_approval"
    assert (own.status_code, own.json()) == (409, {"detail": "own_submission"})
    assert approved["state"] == "scheduled"


# --- The Tier 5 alert at 18 hours (FR-ADM-006) -----------------------------------------------------------


def test_a_removal_request_open_18_hours_alerts_tier_5_once_until_decided(client, db_session, auth, create_member, assign, member_in, area):
    tier5 = create_member(verified=True)
    assign(tier5, "5", "platform", None, ["gallery.takedown"])
    member = member_in(area)
    album_id = db_session.scalar(
        text(
            """
            INSERT INTO content.album (title_en, title_ta, category, album_date, publisher, area_key, area_path,
                                       state, published_at, created_by)
            VALUES ('A', 'அ', 'community', '2026-10-20', 'Team', 'platform', '{platform}', 'published', now(), :by)
            RETURNING id
            """
        ),
        {"by": tier5.id},
    )
    photo_id = db_session.scalar(
        text(
            """
            INSERT INTO content.photo (id, album_id, position, width, height, created_by)
            VALUES (gen_random_uuid(), :album, 1, 10, 10, :by) RETURNING id
            """
        ),
        {"album": album_id, "by": tier5.id},
    )
    request_id = db_session.scalar(
        text(
            """
            INSERT INTO content.removal_request (photo_id, reason, requester_id, requester_ip, area_path, created_at)
            VALUES (:photo, 'safety', :member, '203.0.113.5', '{platform}', now() - interval '19 hours') RETURNING id
            """
        ),
        {"photo": photo_id, "member": member.id},
    )

    first = run_once(db_session, NoPush())
    second = run_once(db_session, NoPush())

    [alert] = inbox(client, auth, tier5, view="action_needed")["items"]
    assert (first["removalsEscalated"], second["removalsEscalated"]) == (1, 0)
    assert (alert["template"], alert["targetId"]) == ("removal_escalated", str(request_id))
