"""/v1/events against a real database. Skipped without DATABASE_URL.

Everything is rolled back afterwards; SMS go to an in-memory outbox.
"""

import random
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

from app.integrations.sms import DevelopmentSms
from app.modules.events import rules

MANAGE = "events.manage"
SCAN = "events.checkin_scan"


@pytest.fixture
def client(db_client) -> TestClient:
    db_client.app.state.sms = DevelopmentSms()
    return db_client


@pytest.fixture
def manager(make_reviewer, area) -> Row:
    """A district coordinator who manages events in the district."""
    return make_reviewer(area.district, permissions=(MANAGE,))


@pytest.fixture
def scanner(make_reviewer, area) -> Row:
    return make_reviewer(area.district, permissions=(SCAN,))


@pytest.fixture
def member(member_in, area) -> Row:
    """An Active member in the event's district, with a confirmed number."""
    person = member_in(area, verified=True, active=True)
    return person


def iso(moment: datetime) -> str:
    return moment.isoformat()


@pytest.fixture
def new_event(client, auth, manager, area) -> Callable[..., dict]:
    """A published event (by default) starting in 30 minutes, so check-in is open now."""

    def create(publish: bool = True, **overrides) -> dict:
        start = datetime.now(UTC) + timedelta(minutes=30)
        body = {
            "titleEn": "Village meeting",
            "titleTa": "கிராமக் கூட்டம்",
            "eventType": "community_meeting",
            "startsAt": iso(start),
            "endsAt": iso(start + timedelta(hours=2)),
            "venue": "Community hall",
            "meetingPoint": "Main gate",
            "agenda": "Roads and water",
            "accessibility": "Step-free entrance",
            "contactRoute": "Through the district office",
            "area": {"level": "district", "code": area.district},
            **overrides,
        }
        created = client.post("/v1/events", json=body, headers=auth(manager))
        assert created.status_code == 201, created.text
        event = created.json()
        if publish:
            published = client.post(f"/v1/events/{event['id']}/publish", headers=auth(manager))
            assert published.status_code == 200, published.text
            event = published.json()
        return event

    return create


def confirm_phone(db_session, member: Row) -> str:
    phone = f"+9477{random.randrange(10**6, 10**7)}"
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": phone},
    )
    return phone


def rsvp(client, auth, person: Row, event: dict, response: str):
    return client.put(f"/v1/events/{event['id']}/rsvp", json={"response": response}, headers=auth(person))


def pass_code(client, auth, person: Row, event: dict) -> str:
    response = client.get(f"/v1/events/{event['id']}/pass/code", headers=auth(person))
    assert response.status_code == 200, response.text
    return response.json()["code"]


def test_manager_list_pages_through_all_scoped_drafts(client, auth, manager, new_event):
    first = new_event(publish=False)
    second = new_event(publish=False)
    headers = auth(manager)

    page_one = client.get("/v1/events/manage", params={"state": "draft", "limit": 1, "offset": 0}, headers=headers)
    page_two = client.get("/v1/events/manage", params={"state": "draft", "limit": 1, "offset": 1}, headers=headers)
    page_three = client.get("/v1/events/manage", params={"state": "draft", "limit": 1, "offset": 2}, headers=headers)

    assert page_one.status_code == page_two.status_code == page_three.status_code == 200
    assert {page_one.json()[0]["id"], page_two.json()[0]["id"]} == {first["id"], second["id"]}
    assert page_three.json() == []


def test_manager_roster_csv_is_scoped_audited_and_spreadsheet_safe(client, db_session, auth, manager, member, new_event):
    event = new_event()
    db_session.execute(text("UPDATE npm.member SET full_name = '=1+1' WHERE id = :id"), {"id": member.id})
    assert rsvp(client, auth, member, event, "going").status_code == 200

    assert client.get(f"/v1/events/{event['id']}/attendance", headers=auth(manager)).status_code == 200

    exported = client.get(f"/v1/events/manage/{event['id']}/attendance.csv", headers=auth(manager))

    assert exported.status_code == 200
    assert "attachment" in exported.headers["content-disposition"]
    assert "'=1+1" in exported.text
    assert "no-store" in exported.headers["cache-control"]
    audit_row = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'events.roster.exported' AND target_id = :id"),
        {"id": event["id"]},
    ).one()
    assert audit_row.details["rows"] == 1


def scan(client, auth, scanner: Row, event: dict, code: str) -> dict:
    response = client.post(f"/v1/events/{event['id']}/scan", json={"code": code}, headers=auth(scanner))
    assert response.status_code == 200, response.text
    return response.json()


# --- Managing events (GAP-03, FR-ADM-004) -------------------------------------------------------------


def test_a_manager_creates_a_draft_members_cannot_see_until_published(client, db_session, auth, manager, member, new_event):
    draft = new_event(publish=False)

    assert (draft["state"], draft["eventRef"][:3]) == ("draft", "EV-")
    opens = datetime.fromisoformat(draft["checkinOpensAt"])
    assert datetime.fromisoformat(draft["startsAt"]) - opens == timedelta(hours=1)  # the default window
    assert client.get(f"/v1/events/{draft['id']}", headers=auth(member)).json() == {"detail": "not_found"}
    assert draft["id"] not in {e["id"] for e in client.get("/v1/events?scope=all", headers=auth(member)).json()}

    client.post(f"/v1/events/{draft['id']}/publish", headers=auth(manager))

    detail = client.get(f"/v1/events/{draft['id']}", headers=auth(member)).json()
    assert (detail["state"], detail["meetingPoint"], detail["accessibility"]) == (
        "published", "Main gate", "Step-free entrance"
    )
    actions = db_session.scalars(
        text("SELECT action FROM ops.audit_log WHERE target_type = 'event' AND target_id = :id ORDER BY id"),
        {"id": draft["id"]},
    ).all()
    assert actions == ["events.event.created", "events.event.published"]


def test_my_area_is_the_default_filter_never_a_restriction(client, auth, create_member, member, new_event):
    event = new_event()
    elsewhere = create_member()  # no area: only platform-wide events are "theirs"

    mine = {e["id"] for e in client.get("/v1/events", headers=auth(member)).json()}
    theirs = {e["id"] for e in client.get("/v1/events", headers=auth(elsewhere)).json()}
    everything = {e["id"] for e in client.get("/v1/events?scope=all", headers=auth(elsewhere)).json()}

    assert event["id"] in mine and event["id"] not in theirs and event["id"] in everything  # BR-057


def test_managers_act_only_in_their_own_areas_and_with_valid_details(client, db_session, auth, make_reviewer, new_event, area):
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = make_reviewer(other_district, permissions=(MANAGE,))
    event = new_event()
    start = datetime.now(UTC) + timedelta(days=1)

    edit = client.patch(f"/v1/events/{event['id']}", json={"venue": "Elsewhere"}, headers=auth(outsider))
    backwards = client.post(
        "/v1/events",
        json={
            "titleEn": "x", "titleTa": "x", "eventType": "training", "startsAt": iso(start),
            "endsAt": iso(start - timedelta(hours=1)), "venue": "Hall", "area": {"level": "district", "code": other_district},
        },
        headers=auth(outsider),
    )

    assert (edit.status_code, edit.json()) == (403, {"detail": "outside_your_area"})
    assert (backwards.status_code, backwards.json()["detail"]["problems"]) == (422, ["ends_before_start"])


# --- RSVPs (E05, FR-EVT-009 to 011) --------------------------------------------------------------------


def test_changing_a_response_updates_the_one_rsvp_and_keeps_its_history(client, db_session, auth, member, new_event):
    event = new_event()

    assert rsvp(client, auth, member, event, "going").json() == {"response": "going"}
    assert rsvp(client, auth, member, event, "maybe").json() == {"response": "maybe"}
    assert rsvp(client, auth, member, event, "declined").json() == {"response": "declined"}  # no reason asked

    detail = client.get(f"/v1/events/{event['id']}", headers=auth(member)).json()
    assert detail["myResponse"] == "declined"
    assert [h["response"] for h in detail["myHistory"]] == ["going", "maybe", "declined"]
    assert db_session.scalar(
        text("SELECT count(*) FROM events.rsvp WHERE event_id = :id"), {"id": event["id"]}
    ) == 1
    listed = client.get("/v1/events?participation=declined", headers=auth(member)).json()
    assert [e["myResponse"] for e in listed if e["id"] == event["id"]] == ["declined"]


def test_a_full_event_waitlists_and_a_freed_place_goes_to_the_longest_waiting(client, auth, member_in, area, new_event):
    event = new_event(capacity=1)
    first, second = member_in(area, verified=True, active=True), member_in(area, verified=True, active=True)

    assert rsvp(client, auth, first, event, "going").json()["response"] == "going"
    assert rsvp(client, auth, second, event, "going").json()["response"] == "waitlisted"
    assert client.get(f"/v1/events/{event['id']}", headers=auth(second)).json()["placesLeft"] == 0

    rsvp(client, auth, first, event, "declined")

    assert client.get(f"/v1/events/{event['id']}", headers=auth(second)).json()["myResponse"] == "going"


# --- Passes and check-in (E06, FR-EVT-012 to 017, BR-058 to BR-062) ---------------------------------------


def test_a_pass_is_only_for_members_going_with_an_active_membership(client, auth, member, member_in, area, new_event):
    event = new_event()
    pending = member_in(area)

    rsvp(client, auth, member, event, "maybe")
    maybe = client.get(f"/v1/events/{event['id']}/pass", headers=auth(member))
    rsvp(client, auth, member, event, "going")
    going = client.get(f"/v1/events/{event['id']}/pass", headers=auth(member))
    rsvp(client, auth, pending, event, "going")
    not_active = client.get(f"/v1/events/{event['id']}/pass/code", headers=auth(pending))
    open_event = new_event(admitsPending=True)
    rsvp(client, auth, pending, open_event, "going")

    assert (maybe.status_code, maybe.json()) == (409, {"detail": "not_going"})
    assert going.status_code == 200
    assert (going.json()["venue"], going.json()["meetingPoint"], going.json()["attendedAt"]) == (
        "Community hall", "Main gate", None
    )
    assert "authorised staff" in going.json()["instructionsEn"]
    assert (not_active.status_code, not_active.json()) == (409, {"detail": "membership_not_active"})
    assert pass_code(client, auth, pending, open_event).startswith("E1.")  # OD-12: this event admits pending members


def test_a_scan_records_attendance_once_and_never_a_pretend_success(client, db_session, auth, member, scanner, new_event):
    event = new_event()
    rsvp(client, auth, member, event, "going")
    code = pass_code(client, auth, member, event)

    first = scan(client, auth, scanner, event, code)
    again = scan(client, auth, scanner, event, pass_code(client, auth, member, event))

    member_code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member.id})
    assert (first["result"], first["memberCode"]) == ("checked_in", member_code)
    assert first["fullName"] and first["attendedAt"]
    assert again["result"] == "already_checked_in"  # BR-061
    assert db_session.scalar(
        text("SELECT count(*) FROM events.attendance WHERE event_id = :id"), {"id": event["id"]}
    ) == 1
    assert client.get(f"/v1/events/{event['id']}/pass", headers=auth(member)).json()["attendedAt"]
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("DELETE FROM events.attendance WHERE event_id = :id"), {"id": event["id"]})


def test_the_scanner_is_told_why_a_pass_does_not_check_in(client, database_settings, auth, member, scanner, new_event):
    event, other = new_event(), new_event()
    later = new_event(startsAt=iso(datetime.now(UTC) + timedelta(days=3)), endsAt=iso(datetime.now(UTC) + timedelta(days=3, hours=2)))
    for each in (event, other, later):
        rsvp(client, auth, member, each, "going")
    code = pass_code(client, auth, member, event)
    ref = code.split(".")[1]
    secret = database_settings.jwt_secret.get_secret_value()
    stale = rules.PASS.sign(ref, secret, int(time.time()) - 120).code

    assert scan(client, auth, scanner, other, code)["result"] == "wrong_event"
    assert scan(client, auth, scanner, event, stale)["result"] == "expired"  # ask the member to refresh
    assert scan(client, auth, scanner, event, "E1.forged.1.2.x.y")["result"] == "not_valid"
    assert scan(client, auth, scanner, later, pass_code(client, auth, member, later))["result"] == "outside_window"
    for result in (scan(client, auth, scanner, event, stale), scan(client, auth, scanner, other, code)):
        assert "fullName" not in result or result["fullName"] is None  # no name without a recorded attendance

    rsvp(client, auth, member, event, "maybe")  # no longer going: the pass reference is gone
    assert scan(client, auth, scanner, event, code)["result"] == "not_valid"


def test_nobody_checks_themselves_in(client, auth, scanner, member_in, area, new_event):
    event = new_event()
    rsvp(client, auth, scanner, event, "going")

    assert scan(client, auth, scanner, event, pass_code(client, auth, scanner, event))["result"] == "not_valid"


def test_the_roster_shows_expected_and_attended(client, auth, member, member_in, area, scanner, new_event):
    event = new_event()
    absent = member_in(area, verified=True, active=True)
    for person in (member, absent):
        rsvp(client, auth, person, event, "going")
    scan(client, auth, scanner, event, pass_code(client, auth, member, event))

    roster = client.get(f"/v1/events/{event['id']}/attendance", headers=auth(scanner)).json()

    assert (roster["expected"], roster["attended"]) == (2, 1)
    attended = [e for e in roster["entries"] if e["attendedAt"]]
    assert [e["memberId"] for e in attended] == [str(member.id)]


# --- Manual check-in (FR-VOI-007) ---------------------------------------------------------------------------


def manual(client, auth, scanner: Row, event: dict, member_code: str, reason: str = "Phone camera broken") -> dict:
    response = client.post(
        f"/v1/events/{event['id']}/checkin/manual",
        json={"memberCode": member_code, "reason": reason},
        headers=auth(scanner),
    )
    assert response.status_code == 200, response.text
    return response.json()


def member_code(db_session, person: Row) -> str:
    return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})


def test_a_member_id_typed_in_checks_in_once_with_the_reason_kept(client, db_session, auth, member, scanner, new_event):
    event = new_event()
    rsvp(client, auth, member, event, "going")
    code = member_code(db_session, member)

    first = manual(client, auth, scanner, event, f"  {code} ")
    again = manual(client, auth, scanner, event, code)
    roster = client.get(f"/v1/events/{event['id']}/attendance", headers=auth(scanner)).json()

    assert first["result"] == "checked_in" and first["memberCode"] == code and first["fullName"]
    assert again["result"] == "already_checked_in"  # BR-061
    assert [e["checkinMethod"] for e in roster["entries"] if e["memberId"] == str(member.id)] == ["manual"]
    stored = db_session.execute(
        text("SELECT method, manual_reason, scanned_by FROM events.attendance WHERE event_id = :e AND member_id = :m"),
        {"e": event["id"], "m": member.id},
    ).one()
    assert (stored.method, stored.manual_reason, stored.scanned_by) == ("manual", "Phone camera broken", scanner.id)
    details = db_session.scalars(
        text("SELECT details FROM ops.audit_log WHERE action = 'events.attendance.manual' AND target_id = :id ORDER BY id"),
        {"id": event["id"]},
    ).all()
    assert [d["result"] for d in details] == ["checked_in", "already_checked_in"]
    assert all("Phone camera broken" not in str(d) for d in details)  # the reason stays on the record


def test_a_typed_member_id_meets_the_same_rules_as_a_pass(client, db_session, auth, member, member_in, area, scanner, new_event):
    event = new_event()
    later = new_event(startsAt=iso(datetime.now(UTC) + timedelta(days=3)), endsAt=iso(datetime.now(UTC) + timedelta(days=3, hours=2)))
    pending = member_in(area, verified=True)
    rsvp(client, auth, pending, event, "going")
    rsvp(client, auth, scanner, event, "going")

    assert manual(client, auth, scanner, event, "WTL-00-0000000")["result"] == "not_valid"
    assert manual(client, auth, scanner, event, member_code(db_session, member))["result"] == "not_eligible"  # not going
    assert manual(client, auth, scanner, event, member_code(db_session, pending))["result"] == "not_eligible"  # OD-12
    assert manual(client, auth, scanner, event, member_code(db_session, scanner))["result"] == "not_valid"  # BR-085
    assert manual(client, auth, scanner, later, member_code(db_session, member))["result"] == "outside_window"
    response = manual(client, auth, scanner, event, member_code(db_session, pending))
    assert response.get("fullName") is None  # no name without a recorded attendance (BR-062)


def test_manual_check_in_needs_the_scanning_permission_in_the_area(client, db_session, auth, member, make_reviewer, area, new_event):
    event = new_event()
    elsewhere = make_reviewer(
        db_session.scalar(
            text("SELECT district_code FROM geo.district WHERE district_code <> :code LIMIT 1"), {"code": area.district}
        ),
        permissions=(SCAN,),
    )
    response = client.post(
        f"/v1/events/{event['id']}/checkin/manual",
        json={"memberCode": member_code(db_session, member), "reason": "No phone"},
        headers=auth(elsewhere),
    )
    assert (response.status_code, response.json()) == (403, {"detail": "outside_your_area"})


# --- Changes and cancellation (FR-ADM-004) -----------------------------------------------------------------


def test_cancelling_stops_every_pass_and_tells_members_who_responded(client, db_session, auth, manager, member, member_in, area, scanner, new_event):
    event = new_event()
    maybe = member_in(area, verified=True, active=True)
    declined = member_in(area, verified=True, active=True)
    phones = {person.id: confirm_phone(db_session, person) for person in (member, maybe, declined)}
    rsvp(client, auth, member, event, "going")
    rsvp(client, auth, maybe, event, "maybe")
    rsvp(client, auth, declined, event, "declined")
    code = pass_code(client, auth, member, event)
    outbox: DevelopmentSms = client.app.state.sms

    cancelled = client.post(f"/v1/events/{event['id']}/cancel", json={"reason": "Heavy rain"}, headers=auth(manager)).json()

    assert (cancelled["state"], cancelled["cancelReason"], cancelled["notified"]) == ("cancelled", "Heavy rain", 2)
    told = {message.phone for message in outbox.sent if "cancelled" in message.text}
    assert told == {phones[member.id], phones[maybe.id]}
    assert scan(client, auth, scanner, event, code)["result"] == "not_valid"
    listed = client.get("/v1/events", headers=auth(member)).json()
    assert [e["state"] for e in listed if e["id"] == event["id"]] == ["cancelled"]
    assert rsvp(client, auth, member, event, "going").json() == {"detail": "event_cancelled"}
    again = client.post(f"/v1/events/{event['id']}/cancel", json={"reason": "Again"}, headers=auth(manager))
    assert (again.status_code, again.json()) == (409, {"detail": "not_allowed_from:cancelled"})


def test_a_new_place_or_time_is_told_but_a_new_agenda_is_not(client, db_session, auth, manager, member, new_event):
    event = new_event()
    confirm_phone(db_session, member)
    rsvp(client, auth, member, event, "going")

    agenda = client.patch(f"/v1/events/{event['id']}", json={"agenda": "Roads only"}, headers=auth(manager)).json()
    venue = client.patch(f"/v1/events/{event['id']}", json={"venue": "School hall"}, headers=auth(manager)).json()

    assert (agenda["agenda"], agenda["notified"]) == ("Roads only", 0)
    assert (venue["venue"], venue["notified"]) == ("School hall", 1)
    entry = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'events.event.updated' ORDER BY id DESC LIMIT 1")
    ).one()
    assert entry.details["changed"] == ["venue"]
