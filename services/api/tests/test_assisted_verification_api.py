"""Assisted identity verification (M05, S04, FR-IDV-014, FR-STF-004, BR-010, BR-021, OD-04) against the real API."""

import random
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.identity.assisted.rules import CHECKLIST

EVERY_ITEM = list(CHECKLIST)


def confirm_number(db_session, member) -> str:
    phone = f"+9477{random.randrange(10**6, 10**7)}"
    db_session.execute(text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
                       {"id": member.id, "phone": phone})
    return phone


@pytest.fixture
def client(identity_client):
    return identity_client


@pytest.fixture
def coordinator(create_member, assign, area, super_admin):
    """A trained GN coordinator holding the assisted-session grant (OD-04)."""
    person = create_member(verified=True)
    assign(person, "1", "gn", area.gn, ["members.assisted_verification"], granted_by=super_admin)
    return person


@pytest.fixture
def asker(member_in, area, db_session):
    member = member_in(area)
    confirm_number(db_session, member)
    return member


def ask(client, auth, member, **overrides) -> dict:
    response = client.post("/v1/identity/assisted/me", json={"reason": "no_camera", "route": "supervised_capture",
                                                             **overrides}, headers=auth(member))
    assert response.status_code == 201, response.json()
    return response.json()


def templates(db_session, member) -> list[str]:
    return list(db_session.scalars(
        text("SELECT template FROM notifications.notification WHERE member_id = :id ORDER BY created_at"), {"id": member.id}
    ))


def test_a_member_asks_for_help_with_no_id_data_and_the_coordinator_is_told(client, auth, asker, coordinator,
                                                                            member_in, area, db_session):
    unreachable = member_in(area)
    no_number = client.post("/v1/identity/assisted/me", json={"reason": "no_camera", "route": "office_visit"},
                            headers=auth(unreachable))
    first = ask(client, auth, asker, preferredTime="morning")
    again = ask(client, auth, asker)
    mine = client.get("/v1/identity/assisted/me", headers=auth(asker)).json()

    assert no_number.json()["detail"]["problems"] == ["contact_not_confirmed"]
    assert first["requestRef"].startswith("AV-") and first["state"] == "requested"
    assert again["id"] == first["id"]  # a second tap never opens a second request
    assert mine["request"]["id"] == first["id"] and mine["checkFailuresBeforeHelp"] == 3
    assert templates(db_session, coordinator) == ["assisted_request_received"]


def test_the_session_cannot_be_submitted_until_the_checklist_and_images_are_complete(
    client, auth, asker, coordinator, upload, db_session
):
    request_id = ask(client, auth, asker)["id"]
    staff = auth(coordinator)

    queue = client.get("/v1/identity/assisted/manage", headers=staff).json()
    file = client.get(f"/v1/identity/assisted/manage/{request_id}", headers=staff).json()
    when = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    scheduled = client.post(f"/v1/identity/assisted/manage/{request_id}/schedule",
                            json={"scheduledFor": when, "meetingPlace": "GN office, Nallur"}, headers=staff)
    session = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions", json={"device": "member_device"},
                          headers=staff).json()
    complete = f"/v1/identity/assisted/manage/{request_id}/sessions/{session['id']}/complete"
    incomplete = client.post(complete, json={"checklist": EVERY_ITEM[:4]}, headers=staff)
    no_images = client.post(complete, json={"checklist": EVERY_ITEM}, headers=staff)
    # The member takes the photos on their own phone; they go only through the evidence vault.
    for kind in ("nic_front", "nic_back", "selfie"):
        upload(asker, kind)
    done = client.post(complete, json={"checklist": EVERY_ITEM, "notes": "Met at the GN office."}, headers=staff)
    review = client.get("/v1/identity/me/review", headers=auth(asker)).json()

    assert request_id in {item["id"] for item in queue}
    assert file["phone"].startswith("+9477") and file["identityRoute"] == "nic"
    assert [image["receivedAt"] for image in file["images"]] == [None, None, None]
    assert scheduled.json()["state"] == "scheduled" and "assisted_scheduled" in templates(db_session, asker)
    assert session["device"] == "member_device" and session["witnessTier"] == "1" and session["mine"]
    assert incomplete.json()["detail"]["problems"] == [
        "checklist_incomplete:no_copies_kept", "checklist_incomplete:declaration_by_member", "consent_required",
        "missing:nic_front", "missing:nic_back", "missing:selfie",
    ]
    assert no_images.json()["detail"]["problems"] == ["consent_required", "missing:nic_front", "missing:nic_back",
                                                      "missing:selfie"]
    assert done.status_code == 200, done.json()
    body = done.json()
    assert body["state"] == "completed" and body["phone"] is None  # the number is shown only while it is open
    assert body["sessions"][0]["outcome"] == "completed"
    assert review["state"] == "submitted"  # the normal review, which a reviewer decides
    assert templates(db_session, asker)[-1] == "assisted_submitted"
    # BR-021: no image, phone number or notes in the audit log.
    logged = db_session.scalars(
        text("SELECT details::text FROM ops.audit_log WHERE target_id = :id"), {"id": request_id}
    ).all()
    assert logged and not any("+9477" in entry or "GN office" in entry for entry in logged)


def test_the_witness_never_decides_the_review_the_session_fed(client, auth, asker, make_reviewer, area, upload,
                                                             db_session):
    witness = make_reviewer(area.district, ("members.verify", "members.view_identity_evidence",
                                            "members.assisted_verification"))
    other = make_reviewer(area.district)
    request_id = ask(client, auth, asker)["id"]
    session = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions", json={"device": "office_device"},
                          headers=auth(witness)).json()
    for kind in ("nic_front", "nic_back", "selfie"):
        upload(asker, kind)
    stranger = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions/{session['id']}/complete",
                           json={"checklist": EVERY_ITEM}, headers=auth(other))
    done = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions/{session['id']}/complete",
                       json={"checklist": EVERY_ITEM}, headers=auth(witness))
    review_id = db_session.scalar(text("SELECT id FROM identity.identity_review WHERE member_id = :id"), {"id": asker.id})

    own_claim = client.post(f"/v1/identity/reviews/{review_id}/claim", headers=auth(witness))
    claimed = client.post(f"/v1/identity/reviews/{review_id}/claim", headers=auth(other))
    seen = client.get(f"/v1/identity/assisted/reviews/{review_id}", headers=auth(other)).json()

    assert (stranger.status_code, stranger.json()["detail"]) == (409, "not_your_session")
    assert done.status_code == 200, done.json()
    assert (own_claim.status_code, own_claim.json()["detail"]) == (409, "witnessed_by_you")
    assert claimed.status_code == 200
    assert len(seen) == 1 and seen[0]["checklist"] == sorted(EVERY_ITEM) and seen[0]["witnessTier"] == "3A"
    assert seen[0]["device"] == "office_device" and not seen[0]["mine"]
    assert str(witness.id) not in str(seen)  # the witness's tier, never who they are


def test_a_camera_failure_moves_the_member_to_an_office_visit(client, auth, asker, coordinator, db_session):
    request_id = ask(client, auth, asker)["id"]
    session = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions", json={"device": "member_device"},
                          headers=auth(coordinator)).json()

    abandoned = client.post(f"/v1/identity/assisted/manage/{request_id}/sessions/{session['id']}/abandon",
                            json={"reason": "camera_failure"}, headers=auth(coordinator)).json()

    assert (abandoned["state"], abandoned["route"]) == ("requested", "office_visit")
    assert abandoned["sessions"][0]["abandonReason"] == "camera_failure"
    assert templates(db_session, asker)[-1] == "assisted_rearrange"


def test_staff_act_only_in_their_area_and_never_on_their_own_request(client, auth, asker, coordinator, create_member,
                                                                      assign, area, super_admin, db_session):
    request_id = ask(client, auth, asker)["id"]
    elsewhere = db_session.scalar(text("SELECT gn_code FROM geo.gn_division WHERE gn_code <> :gn ORDER BY gn_code LIMIT 1"),
                                  {"gn": area.gn})
    outsider = create_member(verified=True)
    assign(outsider, "1", "gn", elsewhere, ["members.assisted_verification"], granted_by=super_admin)
    plain = create_member(verified=True, active=True)

    outside = client.get(f"/v1/identity/assisted/manage/{request_id}", headers=auth(outsider))
    outside_queue = client.get("/v1/identity/assisted/manage", headers=auth(outsider)).json()
    refused = client.get("/v1/identity/assisted/manage", headers=auth(plain))

    assert (outside.status_code, outside.json()["detail"]) == (403, "outside_your_area")
    assert request_id not in {item["id"] for item in outside_queue}
    assert refused.status_code == 403


def test_the_member_cancels_before_a_session_and_a_verified_member_needs_no_help(client, auth, asker, member_in, area,
                                                                                db_session):
    ask(client, auth, asker)
    cancelled = client.post("/v1/identity/assisted/me/cancel", headers=auth(asker)).json()
    verified = member_in(area, verified=True)
    confirm_number(db_session, verified)
    refused = client.post("/v1/identity/assisted/me", json={"reason": "member_asked", "route": "call_back"},
                          headers=auth(verified))

    assert cancelled["state"] == "cancelled"
    assert refused.json()["detail"]["problems"] == ["already_verified"]
