"""/v1/profile, area changes and /v1/auth/password against a real database. Skipped without
DATABASE_URL. Everything is rolled back; files go to a temporary evidence store and SMS to an outbox.
"""

import random

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

from app.integrations.sms import DevelopmentSms

PASSWORD = "an old long passphrase"
SAMPLE_JPEG = b"\xff\xd8\xff\xe0" + bytes(256)


@pytest.fixture
def client(identity_client) -> TestClient:
    identity_client.app.state.sms = DevelopmentSms()
    return identity_client


def confirm_phone(db_session, member: Row) -> str:
    phone = f"+9477{random.randrange(10**6, 10**7)}"
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"), {"id": member.id, "phone": phone}
    )
    return phone


# --- The profile (P01, P02) ----------------------------------------------------------------------------


def test_the_profile_shows_locks_a_masked_number_and_takes_only_display_name_and_gender(client, db_session, auth, member_in, area):
    member = member_in(area, verified=True, active=True)
    db_session.execute(text("UPDATE npm.member SET verified_at = now() WHERE id = :id"), {"id": member.id})  # as approval does
    phone = confirm_phone(db_session, member)
    legal = db_session.scalar(text("SELECT full_name FROM npm.member WHERE id = :id"), {"id": member.id})

    before = client.get("/v1/profile", headers=auth(member)).json()
    after = client.patch(
        "/v1/profile", json={"displayName": "Kalai", "gender": "female", "fullName": "Somebody Else"}, headers=auth(member)
    ).json()

    assert {f["field"] for f in before["lockedFields"]} == {"legal_name", "date_of_birth", "id_number"}
    assert before["mobileMasked"] == phone[:5] + "*****" + phone[-2:]
    assert before["identityState"] == "verified" and before["verificationValidUntil"] is not None
    assert (after["displayName"], after["gender"], after["legalName"]) == ("Kalai", "female", legal)  # BR-074
    cleared = client.patch("/v1/profile", json={"displayName": "  "}, headers=auth(member)).json()
    assert cleared["displayName"] is None


def test_my_activity_lists_receipts_newest_first_with_a_filter(client, auth, member_in, area):
    member = member_in(area)
    client.post("/v1/privacy/requests", json={"kind": "copy"}, headers=auth(member))
    client.post("/v1/profile/area-changes", json={"gnCode": "LK" + "0" * 7}, headers=auth(member))  # unknown: no receipt

    everything = client.get("/v1/profile/activity", headers=auth(member)).json()
    privacy_only = client.get("/v1/profile/activity?kind=privacy_request", headers=auth(member)).json()
    events_only = client.get("/v1/profile/activity?kind=event", headers=auth(member)).json()

    assert [i["kind"] for i in everything] == ["privacy_request"]
    assert privacy_only[0]["reference"].startswith("DSR-") and privacy_only[0]["title"] == "copy"
    assert events_only == []


def test_optional_survey_answers_can_be_changed_and_deleted_and_deletion_is_logged(client, db_session, auth, member_in, area):
    member = member_in(area)

    changed = client.put("/v1/profile/survey-answers", json={"answers": {"occupation": "teacher"}}, headers=auth(member)).json()
    deleted = client.delete("/v1/profile/survey-answers", headers=auth(member))

    assert changed == {"occupation": "teacher"}
    assert deleted.status_code == 204
    assert client.get("/v1/profile/survey-answers", headers=auth(member)).json() == {}
    entry = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE actor_id = :id ORDER BY id DESC LIMIT 1"), {"id": member.id}
    ).one()
    assert (entry.action, entry.details) == ("profile.survey.deleted", {"questions": 0})  # no answers in the log


def test_the_identity_data_notice_gives_purpose_and_retention_in_both_languages(client, auth, member_in, area):
    notice = client.get("/v1/profile/identity-data", headers=auth(member_in(area))).json()
    assert notice and all(item["purposeTa"] and item["retentionEn"] for item in notice)


# --- Area changes (FR-PROF-005, BR-076) -----------------------------------------------------------------


@pytest.fixture
def other_gn(db_session, area) -> Row:
    """Another GN division in the same district, so a district reviewer covers both."""
    return db_session.execute(
        text(
            """
            SELECT g.gn_code AS gn FROM geo.gn_division g JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
            WHERE ds.district_code = :district AND g.gn_code <> :gn ORDER BY g.gn_code LIMIT 1
            """
        ),
        {"district": area.district, "gn": area.gn},
    ).one()


def test_the_area_changes_only_when_a_reviewer_approves_the_proof(client, db_session, auth, member_in, area, other_gn, make_reviewer):
    member = member_in(area)
    reviewer = make_reviewer(area.district)

    same = client.post("/v1/profile/area-changes", json={"gnCode": area.gn}, headers=auth(member))
    receipt = client.post("/v1/profile/area-changes", json={"gnCode": other_gn.gn}, headers=auth(member)).json()
    again = client.post("/v1/profile/area-changes", json={"gnCode": other_gn.gn}, headers=auth(member))
    not_yet = client.get("/v1/profile/area-changes", headers=auth(reviewer)).json()
    submitted = client.put(
        f"/v1/profile/area-changes/{receipt['id']}/proof", content=SAMPLE_JPEG,
        headers={**auth(member), "Content-Type": "image/jpeg"},
    ).json()

    assert (same.status_code, same.json()) == (409, {"detail": "same_area"})
    assert (receipt["requestRef"][:3], receipt["state"]) == ("AC-", "awaiting_proof")
    assert (again.status_code, again.json()) == (409, {"detail": "request_open"})
    assert receipt["id"] not in {c["id"] for c in not_yet}
    assert submitted["state"] == "submitted"
    assert client.get("/v1/profile", headers=auth(member)).json()["openAreaChange"]["requestRef"] == receipt["requestRef"]
    assert db_session.scalar(text("SELECT gs_code FROM npm.member WHERE id = :id"), {"id": member.id}) == area.gn  # unchanged

    proof = client.get(f"/v1/profile/area-changes/{receipt['id']}/proof", headers=auth(reviewer))
    decided = client.post(
        f"/v1/profile/area-changes/{receipt['id']}/decision", json={"decision": "approve", "reason": "Utility bill matches"},
        headers=auth(reviewer),
    ).json()

    assert (proof.status_code, proof.content) == (200, SAMPLE_JPEG)
    assert decided["state"] == "approved"
    assert db_session.scalar(text("SELECT gs_code FROM npm.member WHERE id = :id"), {"id": member.id}) == other_gn.gn
    actions = db_session.scalars(
        text("SELECT action FROM ops.audit_log WHERE target_id = :id ORDER BY id"), {"id": receipt["id"]}
    ).all()
    assert actions == [
        "profile.area_change.requested", "profile.area_change.submitted",
        "profile.area_change.proof_viewed", "profile.area_change.approved",
    ]
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE profile.area_change SET state = 'declined' WHERE id = :id"), {"id": receipt["id"]})


def test_nobody_reviews_their_own_area_change(client, auth, member_in, area, other_gn, assign, super_admin):
    reviewer = member_in(area, verified=True)
    assign(reviewer, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)
    receipt = client.post("/v1/profile/area-changes", json={"gnCode": other_gn.gn}, headers=auth(reviewer)).json()
    client.put(
        f"/v1/profile/area-changes/{receipt['id']}/proof", content=SAMPLE_JPEG,
        headers={**auth(reviewer), "Content-Type": "image/jpeg"},
    )

    response = client.post(
        f"/v1/profile/area-changes/{receipt['id']}/decision", json={"decision": "approve", "reason": "Mine"},
        headers=auth(reviewer),
    )

    assert (response.status_code, response.json()) == (403, {"detail": "own_record"})


# --- Password (FR-PROF-014) ------------------------------------------------------------------------------


def test_the_password_changes_only_with_the_current_one_and_ends_every_session(client, db_session, create_member):
    nic = str(random.randrange(10**11, 10**12))
    member = create_member(nic=nic, password=PASSWORD)
    phone = confirm_phone(db_session, member)
    token = client.post("/v1/auth/sign-in", json={"nic": nic, "password": PASSWORD}).json()["token"]
    client.cookies.clear()
    session = {"Authorization": f"Bearer {token}"}

    wrong = client.post("/v1/auth/password", json={"currentPassword": "not it at all", "newPassword": "a brand new passphrase"}, headers=session)
    weak = client.post("/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": "short"}, headers=session)
    same = client.post("/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": PASSWORD}, headers=session)
    changed = client.post("/v1/auth/password", json={"currentPassword": PASSWORD, "newPassword": "a brand new passphrase"}, headers=session)

    assert (wrong.status_code, wrong.json()) == (401, {"detail": "wrong_password"})
    assert weak.json()["detail"]["problems"] == ["password_too_short"]
    assert "same_password" in same.json()["detail"]["problems"]
    assert changed.status_code == 204
    assert client.get("/v1/members/me", headers=session).json() == {"detail": "session_expired"}
    assert client.post("/v1/auth/sign-in", json={"nic": nic, "password": "a brand new passphrase"}).status_code == 200
    outbox: DevelopmentSms = client.app.state.sms
    assert any(m.phone == phone and "password was changed" in m.text for m in outbox.sent)
