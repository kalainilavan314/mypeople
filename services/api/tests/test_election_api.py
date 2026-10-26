"""/v1/election and the silence-period controls against a real database (BRD NFR-ELC-01, 03, 05, 06, 08;
FR-ELX-001, 004, 008, 010; FR-THL-008). Skipped without DATABASE_URL; changes are rolled back."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.integrations.push import NoPush
from app.integrations.sms import DevelopmentSms
from app.modules.election.rules import LOCAL_OFFSET, local_day_bounds
from app.tasks.notifications import run_once

SEND = "notifications.send"
MANAGE_EVENTS = "events.manage"


@pytest.fixture
def client(db_client) -> TestClient:
    db_client.app.state.sms = DevelopmentSms()
    return db_client


def period_body(level: str, code: str | None, *, polling_in_days: int = 5, **overrides) -> dict:
    """A period from an hour ago to a week after polling, silent for two days before polling and on the day."""
    now = datetime.now(UTC)
    polling_day = (now + LOCAL_OFFSET).date() + timedelta(days=polling_in_days)
    poll_start, poll_end = local_day_bounds(polling_day)
    return {
        "electionType": "provincial",
        "titleEn": "Northern Provincial Council election",
        "titleTa": "வட மாகாண சபைத் தேர்தல்",
        "area": {"level": level, "code": code},
        "startsAt": (now - timedelta(hours=1)).isoformat(),
        "endsAt": (poll_end + timedelta(days=7)).isoformat(),
        "silenceStartsAt": (poll_start - timedelta(days=2)).isoformat(),
        "silenceEndsAt": poll_end.isoformat(),
        "pollingDay": polling_day.isoformat(),
        "sourceUrl": "https://elections.example/gazette-2026-14",
        "sourceReference": "Gazette 2026/14",
        "sourcePublishedAt": (now - timedelta(days=1)).isoformat(),
        **overrides,
    }


def declare(client, auth, admin: Row, body: dict) -> dict:
    response = client.post("/v1/election/periods", json=body, headers=auth(admin))
    assert response.status_code == 201, response.text
    return response.json()


def other_district(db_session, area: Row) -> str:
    """Another district of the same province."""
    return db_session.scalar(
        text(
            """
            SELECT district_code FROM geo.district WHERE province_code = :province AND district_code <> :code
            ORDER BY district_code LIMIT 1
            """
        ),
        {"province": area.province, "code": area.district},
    )


# --- Declaring periods (D22, NFR-ELC-01, 05) ----------------------------------------------------------------


def test_tier_5_declares_periods_and_is_warned_of_overlaps(client, db_session, auth, super_admin, area, make_reviewer):
    first = declare(client, auth, super_admin, period_body("district", area.district))
    second = declare(client, auth, super_admin, period_body("province", area.province, electionType="local"))
    elsewhere = declare(client, auth, super_admin, period_body("district", other_district(db_session, area)))
    invalid = client.post(
        "/v1/election/periods",
        json=period_body("district", area.district, silenceEndsAt=(datetime.now(UTC) + timedelta(days=2)).isoformat()),
        headers=auth(super_admin),
    )
    coordinator = make_reviewer(area.district, permissions=(MANAGE_EVENTS,))
    refused = client.post("/v1/election/periods", json=period_body("district", area.district), headers=auth(coordinator))

    assert first["periodRef"].startswith("EP-") and first["state"] == "declared" and first["overlaps"] == []
    assert second["overlaps"] == [first["periodRef"]]  # several at once are allowed (NFR-ELC-05)
    assert elsewhere["overlaps"] == [second["periodRef"]]  # the province contains the other district
    assert invalid.status_code == 422 and "silence_must_cover_polling_day" in invalid.json()["detail"]["problems"]
    assert refused.status_code == 403
    listed = client.get("/v1/election/periods", headers=auth(super_admin)).json()
    assert {first["id"], second["id"], elsewhere["id"]} <= {p["id"] for p in listed}


def test_a_period_is_ended_or_withdrawn_once_with_a_reason(client, db_session, auth, super_admin, area):
    period = declare(client, auth, super_admin, period_body("district", area.district))

    withdrawn = client.post(
        f"/v1/election/periods/{period['id']}/close",
        json={"action": "withdraw", "reason": "Declared for the wrong district"},
        headers=auth(super_admin),
    )
    again = client.post(
        f"/v1/election/periods/{period['id']}/close", json={"action": "end", "reason": "Over"}, headers=auth(super_admin)
    )

    assert withdrawn.json()["state"] == "withdrawn" and withdrawn.json()["closedAt"]
    assert (again.status_code, again.json()) == (409, {"detail": "not_allowed_from:withdrawn"})
    stored = db_session.scalar(text("SELECT close_reason FROM election.period WHERE id = :id"), {"id": period["id"]})
    assert stored == "Declared for the wrong district"
    actions = db_session.scalars(
        text("SELECT action FROM ops.audit_log WHERE target_id = :id ORDER BY id"), {"id": period["id"]}
    ).all()
    assert actions == ["election.period.declared", "election.period.withdrawn"]


# --- What members see (FR-ELX-001, 004; NFR-ELC-06) ---------------------------------------------------------


def test_members_in_the_area_see_the_date_countdown_source_and_labelled_notices(client, auth, super_admin, member_in, create_member, area):
    period = declare(client, auth, super_admin, period_body("district", area.district, polling_in_days=5))
    notices = f"/v1/election/periods/{period['id']}/notices"
    text_fields = {"titleEn": "Polling hours", "titleTa": "வாக்களிப்பு நேரம்", "bodyEn": "7am to 4pm.", "bodyTa": "காலை 7 முதல் மாலை 4 வரை."}

    unsourced = client.post(notices, json={"source": "election_commission", **text_fields}, headers=auth(super_admin))
    official = client.post(
        notices,
        json={
            "source": "election_commission",
            **text_fields,
            "sourceUrl": "https://elections.example/polling-hours",
            "documentReference": "EC/2026/77",
            "sourcePublishedAt": (datetime.now(UTC) - timedelta(hours=3)).isoformat(),
        },
        headers=auth(super_admin),
    ).json()
    party = client.post(
        notices, json={"source": "party", **text_fields, "titleEn": "Volunteer briefing"}, headers=auth(super_admin)
    ).json()
    superseded = client.post(f"/v1/election/notices/{party['id']}/withdraw", headers=auth(super_admin))

    member, unplaced = member_in(area), create_member()
    banner = client.get("/v1/election/current", headers=auth(member)).json()

    assert (unsourced.status_code, unsourced.json()["detail"]["problems"]) == (422, ["official_source_required"])
    assert superseded.json()["withdrawnAt"]
    assert len(banner) == 1
    assert banner[0]["periodRef"] == period["periodRef"] and banner[0]["daysToPolling"] == 5
    assert banner[0]["inSilence"] is False
    assert banner[0]["sourceUrl"] == "https://elections.example/gazette-2026-14"
    assert banner[0]["labelEn"] == "Election Commission information"
    assert [(n["id"], n["labelEn"]) for n in banner[0]["notices"]] == [(official["id"], "Election Commission information")]
    assert client.get("/v1/election/current", headers=auth(unplaced)).json() == []  # a district election is not theirs


# --- Silence: publishing refused (NFR-ELC-03, FR-THL-008) ---------------------------------------------------


def event_body(area_code: str, starts_at: datetime) -> dict:
    return {
        "titleEn": "Village meeting",
        "titleTa": "கிராமக் கூட்டம்",
        "eventType": "community_meeting",
        "startsAt": starts_at.isoformat(),
        "endsAt": (starts_at + timedelta(hours=2)).isoformat(),
        "venue": "Community hall",
        "meetingPoint": "Main gate",
        "agenda": "Roads and water",
        "accessibility": "Step-free entrance",
        "contactRoute": "Through the district office",
        "area": {"level": "district", "code": area_code},
    }


def test_no_event_is_published_during_silence_in_its_area(client, db_session, auth, make_reviewer, area, silence):
    silence(area)
    manager = make_reviewer(area.district, permissions=(MANAGE_EVENTS,))
    elsewhere_code = other_district(db_session, area)
    other_manager = make_reviewer(elsewhere_code, permissions=(MANAGE_EVENTS,))
    soon = datetime.now(UTC) + timedelta(minutes=30)
    event = client.post("/v1/events", json=event_body(area.district, soon), headers=auth(manager)).json()
    other = client.post("/v1/events", json=event_body(elsewhere_code, soon), headers=auth(other_manager)).json()

    blocked = client.post(f"/v1/events/{event['id']}/publish", headers=auth(manager))
    allowed = client.post(f"/v1/events/{other['id']}/publish", headers=auth(other_manager))

    assert (blocked.status_code, blocked.json()) == (409, {"detail": "silence_period"})
    assert allowed.json()["state"] == "published"
    entry = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'election.silence.blocked' AND target_id = :id"),
        {"id": event["id"]},
    ).one()
    assert entry.details["blockedAction"] == "events.event.publish" and len(entry.details["periodRefs"]) == 1


def test_no_event_may_take_place_inside_a_coming_silence(client, auth, super_admin, make_reviewer, area):
    period = declare(client, auth, super_admin, period_body("district", area.district, polling_in_days=5))
    manager = make_reviewer(area.district, permissions=(MANAGE_EVENTS,))
    in_silence = datetime.fromisoformat(period["silenceStartsAt"]) + timedelta(hours=6)
    before = datetime.now(UTC) + timedelta(days=1)
    inside = client.post("/v1/events", json=event_body(area.district, in_silence), headers=auth(manager)).json()
    outside = client.post("/v1/events", json=event_body(area.district, before), headers=auth(manager)).json()

    refused = client.post(f"/v1/events/{inside['id']}/publish", headers=auth(manager))
    published = client.post(f"/v1/events/{outside['id']}/publish", headers=auth(manager))
    moved = client.patch(
        f"/v1/events/{outside['id']}",
        json={
            "startsAt": in_silence.isoformat(),
            "endsAt": (in_silence + timedelta(hours=2)).isoformat(),
            "checkinOpensAt": (in_silence - timedelta(hours=1)).isoformat(),
            "checkinClosesAt": (in_silence + timedelta(hours=2)).isoformat(),
        },
        headers=auth(manager),
    )

    assert (refused.status_code, refused.json()) == (409, {"detail": "silence_period"})
    assert published.json()["state"] == "published"
    assert (moved.status_code, moved.json()) == (409, {"detail": "silence_period"})


# --- Silence: campaign messages held (NFR-ELC-03, FR-ELX-008) -----------------------------------------------


def broadcast(client, auth, sender: Row, area: Row, topic: str) -> dict:
    body = {
        "topic": topic,
        "titleEn": "Water supply notice",
        "titleTa": "நீர் விநியோக அறிவிப்பு",
        "bodyEn": "Water will be off on Saturday morning.",
        "bodyTa": "சனிக்கிழமை காலை நீர் நிறுத்தப்படும்.",
        "area": {"level": "district", "code": area.district},
    }
    draft = client.post("/v1/notifications/broadcasts", json=body, headers=auth(sender)).json()
    scheduled = client.post(f"/v1/notifications/broadcasts/{draft['id']}/submit", json={}, headers=auth(sender))
    assert scheduled.json()["state"] == "scheduled", scheduled.text
    return draft


def test_announcements_are_held_through_silence_and_emergencies_still_go(client, db_session, auth, make_reviewer, super_admin, area, silence):
    period_id = silence(area)
    sender = make_reviewer(area.district, permissions=(SEND,))
    announcement = broadcast(client, auth, sender, area, "announcements")
    emergency = broadcast(client, auth, sender, area, "emergency")

    first = run_once(db_session, NoPush())
    second = run_once(db_session, NoPush())
    held = client.get("/v1/notifications/broadcasts", params={"state": "scheduled"}, headers=auth(sender)).json()
    closed = client.post(
        f"/v1/election/periods/{period_id}/close", json={"action": "end", "reason": "Results declared"}, headers=auth(super_admin)
    )
    after = run_once(db_session, NoPush())

    assert (first["broadcastsSent"], second["broadcastsSent"], after["broadcastsSent"]) == (1, 0, 1)
    assert [b["heldAt"] is not None for b in held if b["id"] == announcement["id"]] == [True]
    assert closed.json()["state"] == "ended"
    audit = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_id = ANY(CAST(:ids AS text[])) ORDER BY id"),
        {"ids": [announcement["id"], emergency["id"]]},
    ).all()
    held_entries = [row for row in audit if row.action == "election.silence.held"]
    sent = {row.details["broadcastRef"]: row.details for row in audit if row.action == "messaging.broadcast.sent"}
    assert len(held_entries) == 1  # recorded once, however often the dispatcher runs
    assert sent[emergency["broadcastRef"]]["duringSilence"] and sent[announcement["broadcastRef"]]["duringSilence"] is None


# --- FR-ELX-010 -----------------------------------------------------------------------------------------------


def test_no_field_records_a_vote_an_intention_or_proof_of_voting(make_client):
    spec = make_client().app.openapi()
    names = set(spec["paths"])
    for name, schema in spec["components"]["schemas"].items():
        names.add(name)
        names.update(schema.get("properties", {}))
    for operations in spec["paths"].values():
        for operation in operations.values():
            names.update(parameter["name"] for parameter in operation.get("parameters", []))

    assert [n for n in names if re.search(r"vot(e|ed|er|ing)|ballot|intention", n, re.IGNORECASE)] == []
