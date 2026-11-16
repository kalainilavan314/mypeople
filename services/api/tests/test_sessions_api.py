"""Sessions, new-device notices and the staff second factor against a real database.
Skipped without DATABASE_URL. Everything is rolled back; SMS go to an in-memory outbox.
"""

import base64
import random
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.core.security import sign_session_token
from app.integrations.sms import DevelopmentSms
from app.modules.auth import service as auth_service
from app.modules.auth import totp

PASSWORD = "a long tamil passphrase"
ANDROID = {"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131"}
IPHONE = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605"}


@pytest.fixture
def client(db_client) -> TestClient:
    db_client.app.state.sms = DevelopmentSms()
    return db_client


@pytest.fixture
def account(create_member) -> tuple[Row, str]:
    nic = str(random.randrange(10**11, 10**12))
    return create_member(nic=nic, password=PASSWORD), nic


def sign_in(client, nic: str, device: dict[str, str]) -> dict[str, str]:
    response = client.post("/v1/auth/sign-in", json={"nic": nic, "password": PASSWORD}, headers=device)
    assert response.status_code == 200, response.text
    client.cookies.clear()  # each "device" uses its own Bearer token
    return {"Authorization": f"Bearer {response.json()['token']}"}


# --- Sessions (FR-AUTH-020, 021, 025) -------------------------------------------------------------------


def test_members_see_and_end_their_sessions(client, account):
    _, nic = account
    phone = sign_in(client, nic, ANDROID)
    tablet = sign_in(client, nic, IPHONE)

    listed = client.get("/v1/auth/sessions", headers=phone).json()
    assert {(s["deviceLabel"], s["current"]) for s in listed} == {("Android browser", True), ("iPhone browser", False)}
    other = next(s["id"] for s in listed if not s["current"])

    assert client.post(f"/v1/auth/sessions/{other}/revoke", headers=phone).status_code == 204
    assert client.get("/v1/members/me", headers=tablet).json() == {"detail": "session_expired"}  # NFR-SEC-11
    assert client.get("/v1/members/me", headers=phone).status_code == 200
    assert [s["current"] for s in client.get("/v1/auth/sessions", headers=phone).json()] == [True]


def test_ending_all_other_sessions_keeps_this_one(client, account):
    _, nic = account
    phone, tablet, laptop = (sign_in(client, nic, ANDROID), sign_in(client, nic, IPHONE), sign_in(client, nic, ANDROID))

    assert client.post("/v1/auth/sessions/revoke-others", headers=laptop).status_code == 204

    assert client.get("/v1/members/me", headers=phone).status_code == 401
    assert client.get("/v1/members/me", headers=tablet).status_code == 401
    assert client.get("/v1/members/me", headers=laptop).status_code == 200


def test_another_members_session_cannot_be_ended(client, account, create_member, auth):
    _, nic = account
    phone = sign_in(client, nic, ANDROID)
    session_id = client.get("/v1/auth/sessions", headers=phone).json()[0]["id"]

    response = client.post(f"/v1/auth/sessions/{session_id}/revoke", headers=auth(create_member()))

    assert (response.status_code, response.json()) == (404, {"detail": "not_found"})
    assert client.get("/v1/members/me", headers=phone).status_code == 200


def test_a_session_unused_for_30_days_expires(client, db_session, account):
    member, nic = account
    phone = sign_in(client, nic, ANDROID)
    db_session.execute(
        text("UPDATE identity.session SET last_seen_at = now() - interval '31 days' WHERE member_id = :id"),
        {"id": member.id},
    )

    assert client.get("/v1/members/me", headers=phone).json() == {"detail": "session_expired"}
    reason = db_session.scalar(
        text("SELECT revoked_reason FROM identity.session WHERE member_id = :id"), {"id": member.id}
    )
    assert reason == "idle"


def test_a_new_device_is_announced_on_the_confirmed_number(client, db_session, account):  # FR-AUTH-019
    member, nic = account
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": f"+9477{random.randrange(10**6, 10**7)}"},
    )
    outbox: DevelopmentSms = client.app.state.sms

    sign_in(client, nic, ANDROID)  # the first device is not "new"
    sign_in(client, nic, ANDROID)
    assert len(outbox.sent) == 0
    sign_in(client, nic, IPHONE)

    assert len(outbox.sent) == 1 and "new device" in outbox.sent[0].text


def test_express_tokens_still_work_for_members(client, database_settings, account):
    member, _ = account
    token = sign_session_token(member.id, member.session_version, database_settings.jwt_secret.get_secret_value())

    assert client.get("/v1/members/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


# --- The staff second factor (NFR-SEC-04, FR-STF-001) ------------------------------------------------------


# The middle of a 30-second step, frozen for the service, so a test never crosses into the next step.
NOW = (time.time() // totp.STEP_SECONDS) * totp.STEP_SECONDS + 15


@pytest.fixture(autouse=True)
def frozen_clock(monkeypatch):
    monkeypatch.setattr(auth_service, "time", SimpleNamespace(time=lambda: NOW))


def code_now(secret_text: str, offset_steps: int = 0) -> str:
    secret = base64.b32decode(secret_text + "=" * (-len(secret_text) % 8))
    return totp.code_for_step(secret, totp.step_at(NOW) + offset_steps)


@pytest.fixture
def staff(account, assign, super_admin, area) -> tuple[Row, str]:
    member, nic = account
    assign(member, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)
    return member, nic


def test_staff_enrol_an_authenticator_before_acting_as_staff(client, db_session, staff):
    _, nic = staff
    session = sign_in(client, nic, ANDROID)

    refused = client.get("/v1/identity/reviews", headers=session)
    assert (refused.status_code, refused.json()) == (403, {"detail": "mfa_enrolment_required"})
    denied = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'access.denied' ORDER BY id DESC LIMIT 1")
    ).one()
    assert denied.details["reason"] == "mfa_enrolment_required"
    assert client.get("/v1/auth/mfa", headers=session).json() == {"enrolled": False, "enabled": False, "sessionVerified": False}

    refused_start = client.post("/v1/auth/mfa/totp", json={"currentPassword": "wrong"}, headers=session)
    assert (refused_start.status_code, refused_start.json()) == (401, {"detail": "wrong_password"})
    enrolment = client.post("/v1/auth/mfa/totp", json={"currentPassword": PASSWORD}, headers=session).json()
    assert enrolment["otpauthUri"].startswith("otpauth://totp/")
    wrong = client.post("/v1/auth/mfa/totp/confirm", json={"code": "000000"}, headers=session)
    right = client.post("/v1/auth/mfa/totp/confirm", json={"code": code_now(enrolment["secret"])}, headers=session)

    assert wrong.status_code == 401 and right.status_code == 204
    assert client.get("/v1/identity/reviews", headers=session).status_code == 200
    again = client.post("/v1/auth/mfa/totp", json={"currentPassword": PASSWORD}, headers=session)
    assert (again.status_code, again.json()) == (409, {"detail": "already_enabled"})

    # A new session asks for the code again; a code already used is refused.
    second = sign_in(client, nic, IPHONE)
    assert client.get("/v1/identity/reviews", headers=second).json() == {"detail": "mfa_required"}
    replay = client.post("/v1/auth/mfa/verify", json={"code": code_now(enrolment["secret"])}, headers=second)
    fresh = client.post("/v1/auth/mfa/verify", json={"code": code_now(enrolment["secret"], 1)}, headers=second)
    assert replay.status_code == 401 and fresh.status_code == 204
    assert client.get("/v1/identity/reviews", headers=second).status_code == 200
    assert client.get("/v1/auth/mfa", headers=second).json()["sessionVerified"] is True


@pytest.fixture
def enrolled(client, staff) -> tuple[str, str]:
    """A staff member with an enabled authenticator: (their NIC, its secret)."""
    _, nic = staff
    session = sign_in(client, nic, ANDROID)
    secret = client.post("/v1/auth/mfa/totp", json={"currentPassword": PASSWORD}, headers=session).json()["secret"]
    assert client.post("/v1/auth/mfa/totp/confirm", json={"code": code_now(secret)}, headers=session).status_code == 204
    return nic, secret


def wrong_code(client, session: dict[str, str]):
    return client.post("/v1/auth/mfa/verify", json={"code": "000000"}, headers=session)


def test_five_wrong_codes_lock_the_authenticator_and_end_the_session(client, enrolled):
    nic, _ = enrolled
    second = sign_in(client, nic, IPHONE)

    answers = [wrong_code(client, second) for _ in range(5)]

    assert [a.json() for a in answers[:4]] == [{"detail": "invalid_code"}] * 4
    assert (answers[4].status_code, answers[4].json()) == (429, {"detail": "mfa_locked"})
    assert answers[4].headers["Retry-After"] == "900"
    assert client.get("/v1/members/me", headers=second).json() == {"detail": "session_expired"}


def test_wrong_codes_count_across_sessions(client, db_session, staff, enrolled):
    """The review finding: signing in again used to start a fresh count, so codes could be guessed."""
    member, _ = staff
    nic, secret = enrolled
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": f"+9477{random.randrange(10**6, 10**7)}"},
    )
    outbox: DevelopmentSms = client.app.state.sms
    first, second = sign_in(client, nic, ANDROID), sign_in(client, nic, ANDROID)

    early = [wrong_code(client, first).json()["detail"] for _ in range(3)]
    late = [wrong_code(client, second) for _ in range(2)]
    # Locked: even the right code is not checked, in this or a new session.
    third = sign_in(client, nic, ANDROID)
    right = client.post("/v1/auth/mfa/verify", json={"code": code_now(secret, 1)}, headers=third)

    assert early == ["invalid_code"] * 3 and late[0].json() == {"detail": "invalid_code"}
    assert (late[1].status_code, late[1].json()["detail"]) == (429, "mfa_locked")
    assert (right.status_code, right.json()["detail"]) == (429, "mfa_locked")
    assert 0 < int(right.headers["Retry-After"]) <= 900
    assert client.get("/v1/members/me", headers=first).status_code == 200  # three wrong codes there: still signed in
    assert len([m for m in outbox.sent if "authenticator is locked" in m.text]) == 1  # told once, when it locked
    actions = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_type = 'mfa_factor' AND target_id = :id ORDER BY id"),
        {"id": str(member.id)},
    ).all()
    assert [a.action for a in actions] == ["auth.mfa.failed"] * 5 + ["auth.mfa.locked"]
    assert (actions[-1].details["seconds"], actions[-1].details["lockout"]) == (900, 1)
    assert "000000" not in str([a.details for a in actions])


def test_each_lockout_lasts_longer_until_a_right_code(client, db_session, staff, enrolled):
    member, _ = staff
    nic, secret = enrolled

    def lockout_ends() -> None:
        db_session.execute(
            text("UPDATE identity.mfa_factor SET locked_until = now() - interval '1 second' WHERE member_id = :id"),
            {"id": member.id},
        )

    def five_wrong() -> str:
        session = sign_in(client, nic, ANDROID)
        return [wrong_code(client, session) for _ in range(5)][-1].headers["Retry-After"]

    first = five_wrong()
    lockout_ends()
    second = five_wrong()
    lockout_ends()
    session = sign_in(client, nic, ANDROID)
    right = client.post("/v1/auth/mfa/verify", json={"code": code_now(secret, 1)}, headers=session)
    after_success = five_wrong()

    assert (first, second, after_success) == ("900", "3600", "900")
    assert right.status_code == 204


def test_express_tokens_cannot_act_as_staff(client, database_settings, staff):
    member, _ = staff
    token = sign_session_token(member.id, member.session_version, database_settings.jwt_secret.get_secret_value())
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/v1/identity/reviews", headers=headers).json() == {"detail": "mfa_enrolment_required"}
    verify = client.post("/v1/auth/mfa/verify", json={"code": "123456"}, headers=headers)
    assert (verify.status_code, verify.json()) == (409, {"detail": "session_not_registered"})
