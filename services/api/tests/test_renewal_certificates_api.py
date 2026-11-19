"""Certificates (M34, D25, INT-22, FR-RNW-004 to 008, BR-137) against the real API."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.membership.certificates import rules


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def officer(create_member, assign, area, super_admin):
    """A district officer holding certificate.issue_revoke (PRM-52, T3B by explicit grant)."""
    person = create_member(verified=True)
    assign(person, "3B", "district", area.district, ["certificate.issue_revoke"], granted_by=super_admin)
    return person


def token_of(certificate: dict) -> str:
    return certificate["verifyUrl"].rsplit("/certificate/", 1)[1]


def membership_certificate(client, auth, member) -> dict:
    response = client.post("/v1/membership/certificates/me", json={"kind": "membership"}, headers=auth(member))
    assert response.status_code == 201, response.json()
    return response.json()


def test_an_active_member_gets_a_membership_certificate_that_verifies_publicly(client, auth, member_in, area):
    member = member_in(area, verified=True, active=True)

    first = membership_certificate(client, auth, member)
    again = membership_certificate(client, auth, member)
    checked = client.get(f"/v1/public/certificates/{token_of(first)}")
    unknown = client.get("/v1/public/certificates/AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB")
    mine = client.get("/v1/membership/certificates/me", headers=auth(member)).json()

    assert first["certificateRef"].startswith("CT-") and first["status"] == "valid"
    assert first["verifyUrl"].startswith("https://") and "/certificate/" in first["verifyUrl"]
    assert again["id"] == first["id"]  # nothing changed, so the same certificate
    # FR-RNW-007: the type, the holder's name, the issue date and the status, and nothing else.
    assert checked.json() == {"kind": "membership", "holderName": "Test Member", "issuedOn": first["issuedOn"],
                              "status": "valid"}
    assert unknown.status_code == 404
    assert [c["id"] for c in mine["certificates"]] == [first["id"]] and mine["membershipProblems"] == []
    # No ID number is ever part of a certificate.
    assert "nic" not in str(first).lower() and "passport" not in str(first).lower()


def test_a_member_who_is_not_active_gets_no_membership_certificate(client, auth, member_in, area):
    member = member_in(area, verified=True)
    refused = client.post("/v1/membership/certificates/me", json={"kind": "membership"}, headers=auth(member))
    no_event = client.post("/v1/membership/certificates/me", json={"kind": "event_participation"}, headers=auth(member))
    no_service = client.post("/v1/membership/certificates/me", json={"kind": "volunteer_service"}, headers=auth(member))

    assert refused.json()["detail"]["problems"] == ["membership_not_active"]
    assert no_event.json()["detail"]["problems"] == ["event_required"]
    assert no_service.json()["detail"]["problems"] == ["no_completed_assignments"]


def test_revoked_and_reissued_certificates_verify_as_such(client, auth, member_in, area, officer, db_session):
    member = member_in(area, verified=True, active=True)
    certificate = membership_certificate(client, auth, member)

    reissued = client.post(f"/v1/membership/certificates/manage/{certificate['id']}/reissue",
                           json={"reason": "The holder's name was corrected"}, headers=auth(officer))
    assert reissued.status_code == 200, reissued.json()
    new = reissued.json()
    old_check = client.get(f"/v1/public/certificates/{token_of(certificate)}").json()
    mine = client.get("/v1/membership/certificates/me", headers=auth(member)).json()
    new_token = token_of(next(c for c in mine["certificates"] if c["id"] == new["id"]))
    revoked = client.post(f"/v1/membership/certificates/manage/{new['id']}/revoke",
                          json={"reason": "Issued in error"}, headers=auth(officer))
    twice = client.post(f"/v1/membership/certificates/manage/{new['id']}/revoke",
                        json={"reason": "Issued in error"}, headers=auth(officer))
    no_reason = client.post(f"/v1/membership/certificates/manage/{new['id']}/revoke", json={"reason": " "},
                            headers=auth(officer))

    assert new["id"] != certificate["id"] and new["memberCode"] and new["status"] == "valid"
    assert old_check["status"] == "superseded"  # FR-RNW-008
    old_mine = next(c for c in mine["certificates"] if c["id"] == certificate["id"])
    assert old_mine["supersededByRef"] == new["certificateRef"] and old_mine["statusReason"]
    assert revoked.json()["status"] == "revoked" and revoked.json()["statusReason"] == "Issued in error"
    assert client.get(f"/v1/public/certificates/{new_token}").json()["status"] == "revoked"
    assert twice.json()["detail"]["problems"] == ["not_allowed_from:revoked"]
    assert no_reason.status_code == 422
    sent = list(db_session.scalars(text("SELECT template FROM notifications.notification WHERE member_id = :id"),
                                   {"id": member.id}))
    assert {"certificate_reissued", "certificate_revoked"} <= set(sent)
    # The audit entries hold codes, never the reason's words.
    details = db_session.scalars(
        text("SELECT details::text FROM ops.audit_log WHERE action LIKE 'certificate.%' AND target_id = :id"),
        {"id": new["id"]},
    ).all()
    assert details and not any("Issued in error" in d for d in details)


def test_staff_issue_only_in_their_area_and_never_to_themselves(client, auth, member_in, area, officer, create_member,
                                                                assign, super_admin, db_session):
    member = member_in(area, verified=True, active=True)
    code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member.id})
    elsewhere = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
        {"d": area.district},
    )
    outsider = create_member(verified=True)
    assign(outsider, "3B", "district", elsewhere, ["certificate.issue_revoke"], granted_by=super_admin)
    own_code = db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": officer.id})

    issued = client.post("/v1/membership/certificates/manage", json={"memberCode": code, "kind": "membership"},
                         headers=auth(officer))
    duplicate = client.post("/v1/membership/certificates/manage", json={"memberCode": code, "kind": "membership"},
                            headers=auth(officer))
    outside = client.post("/v1/membership/certificates/manage", json={"memberCode": code, "kind": "membership"},
                          headers=auth(outsider))
    own = client.post("/v1/membership/certificates/manage", json={"memberCode": own_code, "kind": "membership"},
                      headers=auth(officer))
    listed = client.get("/v1/membership/certificates/manage", params={"ref": code}, headers=auth(officer)).json()
    not_listed = client.get("/v1/membership/certificates/manage", params={"ref": code}, headers=auth(outsider)).json()
    plain = client.get("/v1/membership/certificates/manage", headers=auth(member))

    assert issued.status_code == 201 and issued.json()["areaKey"] == f"gn:{area.gn}"
    assert "verifyUrl" not in issued.json() or issued.json()["verifyUrl"] is None
    assert duplicate.json()["detail"]["problems"] == ["already_issued"]
    assert (outside.status_code, outside.json()["detail"]) == (403, "outside_your_area")
    assert (own.status_code, own.json()["detail"]) == (403, "own_record")
    assert [c["id"] for c in listed] == [issued.json()["id"]] and not_listed == []
    assert plain.status_code == 403


def test_suspending_a_membership_revokes_its_certificate(client, auth, member_in, area, super_admin):
    member = member_in(area, verified=True, active=True)
    certificate = membership_certificate(client, auth, member)

    suspended = client.post(f"/v1/membership/members/{member.id}/changes",
                            json={"action": "suspend", "reasonCode": "conduct_investigation"}, headers=auth(super_admin))

    assert suspended.status_code == 200, suspended.json()
    assert client.get(f"/v1/public/certificates/{token_of(certificate)}").json()["status"] == "revoked"


def test_event_and_volunteer_certificates_come_from_recorded_attendance_and_service(
    client, auth, member_in, area, super_admin, db_session
):
    member = member_in(area, verified=True, active=True)
    now = datetime.now(UTC)
    event_id = db_session.scalar(
        text(
            """
            INSERT INTO events.event (title_en, title_ta, event_type, starts_at, ends_at, checkin_opens_at, checkin_closes_at,
                                      venue, area_key, area_path, state, created_by, updated_by, published_at)
            VALUES ('Village clean-up', 'கிராமச் சிரமதானம்', 'community', :start, :end, :start, :end, 'Temple hall',
                    'platform', '{platform}', 'published', :admin, :admin, :start)
            RETURNING id
            """
        ),
        {"start": now - timedelta(days=3), "end": now - timedelta(days=3) + timedelta(hours=3), "admin": super_admin.id},
    )
    db_session.execute(text("INSERT INTO events.attendance (event_id, member_id, scanned_by) VALUES (:e, :m, :a)"),
                       {"e": event_id, "m": member.id, "a": super_admin.id})
    for title in ("Library reading day helpers", "Well cleaning team support", "Flood relief packing crew"):
        opportunity = db_session.scalar(
            text(
                """
                INSERT INTO engagement.volunteer_opportunity (title_en, title_ta, role_en, role_ta, description_en,
                    description_ta, place_en, place_ta, bring_en, bring_ta, team_en, team_ta, starts_at, ends_at, places,
                    area_key, area_path, state, created_by)
                VALUES (:title, 'தன்னார்வப் பணி ஒன்று', 'Helper', 'உதவியாளர்', 'Helping the community for a day.',
                    'சமூகத்துக்கு ஒரு நாள் உதவுதல்.', 'Town hall', 'நகர மண்டபம்', 'Water', 'தண்ணீர்', 'Youth team',
                    'இளைஞர் அணி', :start, :end, 5, 'platform', '{platform}', 'closed', :admin)
                RETURNING id
                """
            ),
            {"title": title, "start": now - timedelta(days=10), "end": now - timedelta(days=9), "admin": super_admin.id},
        )
        db_session.execute(
            text(
                """
                INSERT INTO engagement.volunteer_offer (opportunity_id, member_id, state, meeting_point_en, meeting_point_ta)
                VALUES (:o, :m, 'confirmed', 'Main gate', 'பிரதான வாயில்')
                """
            ),
            {"o": opportunity, "m": member.id},
        )

    mine = client.get("/v1/membership/certificates/me", headers=auth(member)).json()
    event = client.post("/v1/membership/certificates/me", json={"kind": "event_participation", "eventId": str(event_id)},
                        headers=auth(member))
    service = client.post("/v1/membership/certificates/me", json={"kind": "volunteer_service"}, headers=auth(member))
    not_attended = client.post("/v1/membership/certificates/me",
                               json={"kind": "event_participation", "eventId": "00000000-0000-0000-0000-000000000001"},
                               headers=auth(member))

    assert [e["eventId"] for e in mine["events"]] == [str(event_id)] and mine["completedAssignments"] == 3
    assert event.status_code == 201 and event.json()["details"]["eventTitleEn"] == "Village clean-up"
    assert event.json()["details"]["eventDate"]
    assert service.json()["details"]["assignmentCount"] == 3  # FR-RNW-006: it lists them
    assert {a["titleEn"] for a in service.json()["details"]["assignments"]} == {
        "Library reading day helpers", "Well cleaning team support", "Flood relief packing crew"}
    assert not_attended.json()["detail"]["problems"] == ["no_attendance_recorded"]
    after = client.get("/v1/membership/certificates/me", headers=auth(member)).json()
    assert after["events"][0]["hasCertificate"]


def test_the_public_check_is_rate_limited(client, auth, member_in, area, monkeypatch):
    member = member_in(area, verified=True, active=True)
    token = token_of(membership_certificate(client, auth, member))
    monkeypatch.setattr(rules, "CHECKS_PER_HOUR", 2)

    answers = [client.get(f"/v1/public/certificates/{token}").status_code for _ in range(3)]

    assert answers == [200, 200, 429]
