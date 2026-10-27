"""Refresh-token rotation (FR-AUTH-025) and suspicious sign-in alerts (FR-AUTH-018, NFR-SEC-12, M50)
against a real database. Skipped without DATABASE_URL. Rolled back; SMS go to an in-memory outbox."""

import random
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.core.security import ACCESS_LIFETIME, sign_session_token
from app.integrations.sms import DevelopmentSms
from app.modules.auth.refresh import REFRESH_COOKIE

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


def sign_in(client, nic: str, device: dict[str, str] = ANDROID) -> dict:
    response = client.post("/v1/auth/sign-in", json={"nic": nic, "password": PASSWORD}, headers=device)
    assert response.status_code == 200, response.text
    client.cookies.clear()  # each "device" keeps its own tokens
    return response.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def refresh(client, refresh_token: str):
    return client.post("/v1/auth/refresh", json={"refreshToken": refresh_token})


# --- Refresh rotation (FR-AUTH-025) ------------------------------------------------------------------------


def test_tokens_last_15_minutes_and_each_refresh_token_works_once(client, account, database_settings):
    _, nic = account
    signed_in = sign_in(client, nic)
    claims = jwt.decode(signed_in["token"], options={"verify_signature": False})

    renewed = refresh(client, signed_in["refreshToken"])
    again = refresh(client, renewed.json()["refreshToken"])

    assert claims["exp"] - claims["iat"] == int(ACCESS_LIFETIME.total_seconds())
    assert renewed.status_code == 200 and renewed.json()["refreshToken"] != signed_in["refreshToken"]
    assert again.status_code == 200
    assert client.get("/v1/members/me", headers=bearer(again.json()["token"])).status_code == 200


def test_an_expired_token_says_so_and_the_refresh_token_renews_it(client, account, database_settings, db_session):
    member, nic = account
    signed_in = sign_in(client, nic)
    session_id = db_session.scalar(text("SELECT id FROM identity.session WHERE member_id = :id"), {"id": member.id})
    expired = sign_session_token(
        member.id,
        member.session_version,
        database_settings.jwt_secret.get_secret_value(),
        issued_at=datetime.now(UTC) - timedelta(minutes=20),
        session_id=session_id,
        lifetime=ACCESS_LIFETIME,
    )

    assert client.get("/v1/members/me", headers=bearer(expired)).json() == {"detail": "token_expired"}
    renewed = refresh(client, signed_in["refreshToken"]).json()
    assert client.get("/v1/members/me", headers=bearer(renewed["token"])).status_code == 200


def test_a_reused_refresh_token_ends_the_session_for_every_copy(client, db_session, account):
    member, nic = account
    signed_in = sign_in(client, nic)
    stolen = signed_in["refreshToken"]
    legitimate = refresh(client, stolen).json()  # the owner renews first

    reused = refresh(client, stolen)  # then the copy is used

    assert (reused.status_code, reused.json()) == (401, {"detail": "refresh_reused"})
    assert client.get("/v1/members/me", headers=bearer(legitimate["token"])).json() == {"detail": "session_expired"}
    assert refresh(client, legitimate["refreshToken"]).json() == {"detail": "session_expired"}
    reason = db_session.scalar(text("SELECT revoked_reason FROM identity.session WHERE member_id = :id"), {"id": member.id})
    assert reason == "refresh_reuse"
    alert = db_session.execute(
        text("SELECT kind, signals FROM identity.security_alert WHERE member_id = :id"), {"id": member.id}
    ).one()
    assert (alert.kind, alert.signals) == ("refresh_reuse", ["refresh_token_reused"])


def test_browsers_renew_with_the_refresh_cookie(client, account):
    _, nic = account
    signed_in = client.post("/v1/auth/sign-in", json={"nic": nic, "password": PASSWORD}, headers=ANDROID)
    cookie = signed_in.cookies.get(REFRESH_COOKIE)
    set_cookie = [h for h in signed_in.headers.get_list("set-cookie") if h.startswith(f"{REFRESH_COOKIE}=")][0]

    renewed = client.post("/v1/auth/refresh", json={})

    assert cookie == signed_in.json()["refreshToken"]
    assert "Path=/v1/auth" in set_cookie and "HttpOnly" in set_cookie and "SameSite=strict" in set_cookie
    assert renewed.status_code == 200 and renewed.cookies.get(REFRESH_COOKIE) == renewed.json()["refreshToken"]


def test_refresh_refuses_ended_idle_and_made_up_tokens(client, db_session, account):
    member, nic = account
    signed_in = sign_in(client, nic)
    db_session.execute(
        text("UPDATE identity.session SET last_seen_at = now() - interval '31 days' WHERE member_id = :id"),
        {"id": member.id},
    )

    assert refresh(client, signed_in["refreshToken"]).json() == {"detail": "session_expired"}  # 30 days idle
    assert refresh(client, "not-a-token").json() == {"detail": "invalid_refresh_token"}
    made_up = signed_in["refreshToken"].split(".")[0] + ".guessed-secret"
    assert refresh(client, made_up).json() == {"detail": "invalid_refresh_token"}
    signed_out = sign_in(client, nic)
    client.post("/v1/auth/sign-out", headers=bearer(signed_out["token"]))
    assert refresh(client, signed_out["refreshToken"]).json() == {"detail": "session_expired"}


# --- Suspicious sign-ins (FR-AUTH-018, NFR-SEC-12) ---------------------------------------------------------


def confirm_phone(db_session, member: Row) -> None:
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": f"+9477{random.randrange(10**6, 10**7)}"},
    )


def failures_elsewhere(db_session, nic: str, database_settings, count: int) -> None:
    from app.core.security import nic_hash

    identifier = nic_hash(nic, database_settings.nic_pepper.get_secret_value())
    for _ in range(count):
        db_session.execute(
            text("INSERT INTO npm.auth_attempt (identifier, ip, succeeded) VALUES (:identifier, '198.51.100.7', false)"),
            {"identifier": identifier},
        )


def test_a_new_device_after_failed_guesses_raises_an_alert(client, db_session, account, database_settings, auth):
    member, nic = account
    confirm_phone(db_session, member)
    sign_in(client, nic, ANDROID)  # the member's usual phone
    failures_elsewhere(db_session, nic, database_settings, 4)
    outbox: DevelopmentSms = client.app.state.sms

    flagged = sign_in(client, nic, IPHONE)

    alerts = client.get("/v1/auth/security-alerts", headers=bearer(flagged["token"])).json()
    assert [(a["kind"], a["signals"], a["deviceLabel"], a["answer"]) for a in alerts] == [
        ("suspicious_sign_in", ["new_device", "recent_failures"], "iPhone browser", None)
    ]
    assert len(outbox.sent) == 1 and "unusual sign-in" in outbox.sent[0].text
    inbox = client.get("/v1/notifications", params={"view": "action_needed"}, headers=bearer(flagged["token"])).json()
    assert [item["template"] for item in inbox["items"]] == ["suspicious_sign_in"]


def test_a_new_device_alone_or_an_ordinary_sign_in_is_not_suspicious(client, db_session, account):
    member, nic = account
    sign_in(client, nic, ANDROID)
    sign_in(client, nic, IPHONE)
    count = db_session.scalar(text("SELECT count(*) FROM identity.security_alert WHERE member_id = :id"), {"id": member.id})
    assert count == 0


def test_many_sign_ins_in_an_hour_are_flagged(client, db_session, account):
    member, nic = account
    for _ in range(5):
        sign_in(client, nic, ANDROID)
    sixth = sign_in(client, nic, ANDROID)
    alerts = client.get("/v1/auth/security-alerts", headers=bearer(sixth["token"])).json()
    assert [a["signals"] for a in alerts] == [["unusual_velocity"]]


def test_not_me_ends_the_flagged_session_and_every_other_but_this_one(client, db_session, account, database_settings):
    member, nic = account
    mine = sign_in(client, nic, ANDROID)
    other = sign_in(client, nic, ANDROID)
    failures_elsewhere(db_session, nic, database_settings, 3)
    intruder = sign_in(client, nic, IPHONE)
    alert = client.get("/v1/auth/security-alerts", headers=bearer(mine["token"])).json()[0]

    answered = client.post(f"/v1/auth/security-alerts/{alert['id']}/answer", json={"answer": "not_me"}, headers=bearer(mine["token"]))
    again = client.post(f"/v1/auth/security-alerts/{alert['id']}/answer", json={"answer": "it_was_me"}, headers=bearer(mine["token"]))

    assert answered.json()["answer"] == "not_me" and answered.json()["sessionActive"] is False
    assert (again.status_code, again.json()) == (409, {"detail": "already_answered"})
    assert client.get("/v1/members/me", headers=bearer(intruder["token"])).json() == {"detail": "session_expired"}
    assert client.get("/v1/members/me", headers=bearer(other["token"])).json() == {"detail": "session_expired"}
    assert client.get("/v1/members/me", headers=bearer(mine["token"])).status_code == 200
    action = client.get("/v1/notifications", params={"view": "action_needed"}, headers=bearer(mine["token"])).json()
    assert action["items"] == []  # answering is the task the notice asked for


def test_it_was_me_closes_the_alert_and_others_cannot_answer_it(client, db_session, account, database_settings, create_member, auth):
    member, nic = account
    failures_elsewhere(db_session, nic, database_settings, 3)
    flagged = sign_in(client, nic, ANDROID)
    alert = client.get("/v1/auth/security-alerts", headers=bearer(flagged["token"])).json()[0]
    stranger = create_member()

    refused = client.post(f"/v1/auth/security-alerts/{alert['id']}/answer", json={"answer": "it_was_me"}, headers=auth(stranger))
    answered = client.post(f"/v1/auth/security-alerts/{alert['id']}/answer", json={"answer": "it_was_me"}, headers=bearer(flagged["token"]))

    assert (refused.status_code, refused.json()) == (404, {"detail": "not_found"})
    assert answered.json()["answer"] == "it_was_me" and answered.json()["sessionActive"] is True
