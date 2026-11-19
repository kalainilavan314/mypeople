"""Meet Your Representative (M41, M42, S17, D29; FR-APT-001 to 007, BR-143, BR-159)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.modules.events.appointments import rules
from app.modules.events.appointments import service as appointments


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def manager(super_admin):
    return super_admin  # Tier 5 holds appointment.profile.manage by default


@pytest.fixture
def representative(create_member, assign, area, super_admin, db_session):
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, ["appointment.manage_own"], granted_by=super_admin)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})
    return person, code


def profile_body(area, code, **overrides):
    return {
        "memberCode": code,
        "roleEn": "District Coordinator", "roleTa": "மாவட்ட ஒருங்கிணைப்பாளர்",
        "displayNameEn": "S. Kumaran", "displayNameTa": "சி. குமரன்",
        "officeHoursEn": "Monday to Friday, 9 am to 12 noon", "officeHoursTa": "திங்கள் முதல் வெள்ளி, காலை 9 முதல் நண்பகல் 12 வரை",
        "publicPhone": "021 222 3344", "publicEmail": None,
        "officeAddressEn": "TMK district office, Hospital Road", "officeAddressTa": "தமக மாவட்ட அலுவலகம், வைத்தியசாலை வீதி",
        "area": {"level": "district", "code": area.district},
        **overrides,
    }


def slot_body(start, **overrides):
    return {"startsAt": start.isoformat(), "minutes": 30, "count": 3, "mode": "in_person",
            "placeEn": "TMK district office", "placeTa": "தமக மாவட்ட அலுவலகம்", **overrides}


def tomorrow_at(hour):
    day = datetime.now(UTC) + timedelta(days=1)
    return day.replace(hour=hour, minute=0, second=0, microsecond=0)


def published_profile(client, auth, manager, representative, area):
    person, code = representative
    created = client.post("/v1/appointments/profiles", json=profile_body(area, code), headers=auth(manager))
    assert created.status_code == 201, created.json()
    profile_id = created.json()["id"]
    published = client.post(f"/v1/appointments/profiles/{profile_id}/publish", headers=auth(manager))
    assert published.json()["state"] == "published", published.json()
    return profile_id


def notices(db_session, member, key):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :m AND template = :k"),
        {"m": member.id, "k": key},
    )


def book_body(slot_id, **overrides):
    return {"slotId": slot_id, "topic": "Water supply for our lane", "contactPreference": "in_app", **overrides}


def test_profiles_show_role_area_and_hours_and_contacts_only_after_approval(
    client, auth, manager, representative, area, member_in, db_session
):
    # FR-APT-001, FR-APT-007, BR-143.
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    profile_id = published_profile(client, auth, manager, representative, area)

    listed = client.get("/v1/appointments/representatives", headers=auth(member)).json()
    before = client.get(f"/v1/appointments/representatives/{profile_id}", headers=auth(member)).json()
    approved = client.post("/v1/appointments/calendar/contacts", json={"approve": True}, headers=auth(person))
    after = client.get(f"/v1/appointments/representatives/{profile_id}", headers=auth(member)).json()
    # A manager changing a contact route clears the approval and asks again.
    changed = client.put(f"/v1/appointments/profiles/{profile_id}",
                         json={k: v for k, v in profile_body(area, "x", publicPhone="0771234567").items()
                               if k not in ("memberCode", "area")}, headers=auth(manager))
    again = client.get(f"/v1/appointments/representatives/{profile_id}", headers=auth(member)).json()

    mine = [r for r in listed if r["id"] == profile_id][0]
    assert (mine["roleEn"], mine["areaKey"], mine["coversMyArea"]) == ("District Coordinator", f"district:{area.district}", True)
    assert mine["officeHoursEn"].startswith("Monday")
    assert before["contacts"] == {"phone": None, "email": None, "officeAddressEn": None, "officeAddressTa": None}
    # FR-APT-002: no slots yet, so the office hours are the way to meet.
    assert before["slots"] == [] and before["officeHoursTa"]
    assert approved.status_code == 200 and approved.json()["contactsApprovedAt"]
    assert after["contacts"]["phone"] == "0212223344"
    assert changed.json()["contactsApprovedAt"] is None and again["contacts"]["phone"] is None
    assert notices(db_session, person, "representative_contacts_approval") == 2


def test_publishing_needs_the_persons_calendar_permission(client, auth, manager, create_member, area, db_session):
    person = create_member(verified=True, active=True)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})
    created = client.post("/v1/appointments/profiles", json=profile_body(area, code), headers=auth(manager)).json()

    refused = client.post(f"/v1/appointments/profiles/{created['id']}/publish", headers=auth(manager))
    unknown = client.post("/v1/appointments/profiles", json=profile_body(area, "NO-SUCH-CODE"), headers=auth(manager))
    twice = client.post("/v1/appointments/profiles", json=profile_body(area, code), headers=auth(manager))

    assert created["holdsCalendarPermission"] is False
    assert refused.json()["detail"]["problems"] == ["representative_lacks_calendar_permission"]
    assert unknown.json()["detail"]["problems"] == ["unknown_member_code"]
    assert twice.json()["detail"]["problems"] == ["profile_exists"]
    assert client.get("/v1/appointments/profiles", headers=auth(person)).status_code == 403


def test_slots_never_overlap(client, auth, manager, representative, area, db_session):
    person, _ = representative
    profile_id = published_profile(client, auth, manager, representative, area)
    first = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4)), headers=auth(person))
    overlapping = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(5)), headers=auth(person))
    by_manager = client.post(f"/v1/appointments/profiles/{profile_id}/slots",
                             json=slot_body(tomorrow_at(6), mode="phone_call", placeEn=None, placeTa=None),
                             headers=auth(manager))
    past = client.post("/v1/appointments/calendar/slots", json=slot_body(datetime.now(UTC) - timedelta(hours=1)),
                       headers=auth(person))
    no_place = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(9), placeEn=None),
                           headers=auth(person))

    assert first.status_code == 201 and len(first.json()) == 3
    assert overlapping.json()["detail"]["problems"] == ["overlaps_existing_slot"]
    assert by_manager.status_code == 201 and by_manager.json()[0]["placeEn"] is None
    assert "starts_in_past" in past.json()["detail"]["problems"]
    assert no_place.json()["detail"]["problems"] == ["place_required"]
    # The database refuses an overlap too, whatever wrote it.
    with pytest.raises(DBAPIError):
        with db_session.begin_nested():
            db_session.execute(
                text("""INSERT INTO events.appointment_slot (representative_id, starts_at, ends_at, mode, created_by)
                        VALUES (:rep, :s, :e, 'phone_call', :by)"""),
                {"rep": profile_id, "s": tomorrow_at(4) + timedelta(minutes=10),
                 "e": tomorrow_at(4) + timedelta(minutes=40), "by": person.id},
            )


def test_booking_keeps_needs_and_a_case_link_only_with_consent(
    client, auth, manager, representative, area, member_in, db_session
):
    # FR-APT-004, FR-APT-005, BR-159; one booking per slot.
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    other = member_in(area, verified=True, active=True)
    pending = member_in(area)
    published_profile(client, auth, manager, representative, area)
    slots = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4)), headers=auth(person)).json()

    no_consent = client.post("/v1/appointments", json=book_body(
        slots[0]["id"], needs=["tamil_interpreter", "step_free_access"], needsNote="I use a wheelchair",
        caseRef="CI-00128", caseLinkConsent=False, contactPreference="phone_call", contactPhone="077 123 4567",
    ), headers=auth(member))
    taken = client.post("/v1/appointments", json=book_body(slots[0]["id"]), headers=auth(other))
    with_consent = client.post("/v1/appointments", json=book_body(slots[1]["id"], caseRef="ci-00128",
                                                                  caseLinkConsent=True), headers=auth(other))
    unverified = client.post("/v1/appointments", json=book_body(slots[2]["id"]), headers=auth(pending))
    no_phone = client.post("/v1/appointments", json=book_body(slots[2]["id"], contactPreference="sms"),
                           headers=auth(member))
    own = client.post("/v1/appointments", json=book_body(slots[2]["id"]), headers=auth(person))
    calendar = client.get("/v1/appointments/calendar", headers=auth(person)).json()

    assert no_consent.status_code == 201, no_consent.json()
    assert no_consent.json()["caseRef"] is None and no_consent.json()["contactPhone"] == "0771234567"
    assert taken.json()["detail"]["problems"] == ["slot_taken"]
    assert with_consent.json()["caseRef"] == "CI-00128"
    assert unverified.json()["detail"]["problems"] == ["identity_not_verified"]
    assert set(no_phone.json()["detail"]["problems"]) == {"contact_phone_required", "already_booked_with_representative"}
    assert "own_calendar" in own.json()["detail"]["problems"]
    stored = db_session.scalar(text("SELECT case_ref FROM events.appointment WHERE id = :id"), {"id": no_consent.json()["id"]})
    assert stored is None
    booked = [s["booking"] for s in calendar["slots"] if s["booking"]]
    first = [b for b in booked if b["id"] == no_consent.json()["id"]][0]
    # "Given 'Tamil interpreter needed', then the representative sees it."
    assert "tamil_interpreter" in first["needs"] and first["needsNote"] == "I use a wheelchair"
    assert first["memberName"] == "Test Member" and first["memberCode"].startswith("TEST-")
    assert notices(db_session, person, "appointment_booked") == 2


def test_cancel_and_move_free_the_slot_and_tell_the_representative(
    client, auth, manager, representative, area, member_in, db_session
):
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    profile_id = published_profile(client, auth, manager, representative, area)
    slots = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4)), headers=auth(person)).json()
    booked = client.post("/v1/appointments", json=book_body(slots[0]["id"]), headers=auth(member)).json()

    moved = client.post(f"/v1/appointments/mine/{booked['id']}/reschedule", json={"slotId": slots[1]["id"]},
                        headers=auth(member))
    free_again = client.get(f"/v1/appointments/representatives/{profile_id}", headers=auth(member)).json()
    cancelled = client.post(f"/v1/appointments/mine/{booked['id']}/cancel", json={"reason": "I found help"},
                            headers=auth(member))
    twice = client.post(f"/v1/appointments/mine/{booked['id']}/cancel", json={}, headers=auth(member))
    someone_else = client.get(f"/v1/appointments/mine/{booked['id']}", headers=auth(member_in(area)))

    assert moved.json()["slot"]["id"] == slots[1]["id"]
    assert slots[0]["id"] in [s["id"] for s in free_again["slots"]] and slots[1]["id"] not in [s["id"] for s in free_again["slots"]]
    assert (cancelled.json()["state"], cancelled.json()["cancelledBy"]) == ("cancelled", "member")
    assert twice.json()["detail"]["problems"] == ["not_allowed_from:cancelled"]
    assert someone_else.status_code == 404
    assert notices(db_session, person, "appointment_moved") == 1
    assert notices(db_session, person, "appointment_cancelled_by_member") == 1


def test_reminders_arrive_a_day_and_an_hour_before(client, auth, manager, representative, area, member_in, db_session):
    # FR-APT-003: "Given a booking, then reminders arrive 24 hours and 1 hour before."
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    published_profile(client, auth, manager, representative, area)
    slots = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4) + timedelta(days=2)),
                        headers=auth(person)).json()
    booked = client.post("/v1/appointments", json=book_body(slots[0]["id"]), headers=auth(member)).json()
    starts = datetime.fromisoformat(slots[0]["startsAt"])
    db_session.execute(text("UPDATE events.appointment SET booked_at = now() - interval '3 days' WHERE id = :id"),
                       {"id": booked["id"]})

    too_early = appointments.remind(db_session, starts - timedelta(hours=30))
    day = appointments.remind(db_session, starts - timedelta(hours=20))
    day_again = appointments.remind(db_session, starts - timedelta(hours=19))
    hour = appointments.remind(db_session, starts - timedelta(minutes=50))
    hour_again = appointments.remind(db_session, starts - timedelta(minutes=40))

    assert (too_early, day, day_again, hour, hour_again) == (0, 1, 0, 1, 0)
    assert notices(db_session, member, "appointment_tomorrow") == 1
    assert notices(db_session, member, "appointment_soon") == 1


def test_the_follow_up_note_reaches_the_member_and_my_activity(
    client, auth, manager, representative, area, member_in, db_session
):
    # FR-APT-006: "Given a follow-up saved, then the member sees it in P04."
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    published_profile(client, auth, manager, representative, area)
    slots = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4)), headers=auth(person)).json()
    booked = client.post("/v1/appointments", json=book_body(slots[0]["id"]), headers=auth(member)).json()

    too_soon = client.post(f"/v1/appointments/calendar/bookings/{booked['id']}/follow-up",
                           json={"outcome": "completed", "note": "We spoke about the water supply."}, headers=auth(person))
    db_session.execute(
        text("""UPDATE events.appointment_slot SET starts_at = starts_at - interval '2 days',
                       ends_at = ends_at - interval '2 days' WHERE id = :id"""),
        {"id": slots[0]["id"]},
    )
    no_note = client.post(f"/v1/appointments/calendar/bookings/{booked['id']}/follow-up", json={"outcome": "completed"},
                          headers=auth(person))
    saved = client.post(f"/v1/appointments/calendar/bookings/{booked['id']}/follow-up",
                        json={"outcome": "completed", "note": "The water board will visit your lane on Monday."},
                        headers=auth(person))
    seen = client.get(f"/v1/appointments/mine/{booked['id']}", headers=auth(member)).json()
    activity = client.get("/v1/profile/activity", headers=auth(member)).json()

    assert too_soon.json()["detail"]["problems"] == ["not_started_yet"]
    assert no_note.json()["detail"]["problems"] == ["note_required"]
    assert saved.json()["state"] == "completed"
    assert seen["followUpNote"] == "The water board will visit your lane on Monday."
    assert notices(db_session, member, "appointment_follow_up") == 1
    item = [a for a in activity if a["kind"] == "appointment"][0]
    assert (item["reference"], item["state"], item["targetId"]) == (booked["appointmentRef"], "completed", booked["id"])


def test_withdrawing_a_booked_slot_cancels_the_booking_and_tells_the_member(
    client, auth, manager, representative, area, member_in, db_session
):
    person, _ = representative
    member = member_in(area, verified=True, active=True)
    profile_id = published_profile(client, auth, manager, representative, area)
    slots = client.post("/v1/appointments/calendar/slots", json=slot_body(tomorrow_at(4)), headers=auth(person)).json()
    booked = client.post("/v1/appointments", json=book_body(slots[0]["id"]), headers=auth(member)).json()

    withdrawn = client.post(f"/v1/appointments/calendar/slots/{slots[0]['id']}/withdraw",
                            json={"reason": "Called to an emergency meeting"}, headers=auth(person))
    seen = client.get(f"/v1/appointments/mine/{booked['id']}", headers=auth(member)).json()
    managed = client.get(f"/v1/appointments/profiles/{profile_id}", headers=auth(manager)).json()
    gone = client.post(f"/v1/appointments/profiles/{profile_id}/withdraw", json={"reason": "Role ended"},
                       headers=auth(manager))
    hidden = client.get(f"/v1/appointments/representatives/{profile_id}", headers=auth(member))

    assert withdrawn.json()["state"] == "withdrawn"
    assert (seen["state"], seen["cancelledBy"], seen["cancelReason"]) == ("cancelled", "representative",
                                                                          "Called to an emergency meeting")
    assert notices(db_session, member, "appointment_cancelled") == 1
    # D29 sees whether a slot is taken, never by whom.
    assert all(set(s) == {"id", "startsAt", "endsAt", "mode", "placeEn", "placeTa", "state", "booked"} for s in managed["slots"])
    assert gone.json()["state"] == "withdrawn" and hidden.status_code == 404


def test_the_rules():
    assert rules.stored_case_ref("CI-00128", False) is None and rules.stored_case_ref("CI-00128", True) == "CI-00128"
    assert rules.check_contact("phone_call", None) == ["contact_phone_required"] and rules.check_contact("in_app", None) == []
    start = datetime(2026, 12, 1, 4, 0, tzinfo=UTC)
    assert rules.series(start, 20, 2) == [(start, start + timedelta(minutes=20)),
                                          (start + timedelta(minutes=20), start + timedelta(minutes=40))]
    assert rules.overlaps((start, start + timedelta(minutes=30)), (start + timedelta(minutes=29), start + timedelta(hours=1)))
    assert not rules.overlaps((start, start + timedelta(minutes=30)), (start + timedelta(minutes=30), start + timedelta(hours=1)))
