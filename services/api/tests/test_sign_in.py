"""POST /v1/auth/sign-in and /v1/auth/sign-out against a real database.

Skipped when DATABASE_URL is not set. Everything is rolled back afterwards.
"""

import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.core.security import nic_hash, read_session_token, sign_session_token
from app.modules.auth import throttle

NIC = "199012345678"
PASSWORD = "correct horse battery"
CLIENT_IP = "testclient"  # the address TestClient connects from


@pytest.fixture
def member(create_member):
    return create_member(nic=NIC, password=PASSWORD)


@pytest.fixture
def delays(monkeypatch) -> list[float]:
    """Records the throttle's delays instead of waiting them out."""
    recorded: list[float] = []

    async def record(seconds: float) -> None:
        recorded.append(seconds)

    monkeypatch.setattr(throttle, "wait", record)
    return recorded


@pytest.fixture
def identifier(database_settings: Settings) -> str:
    return nic_hash(NIC, database_settings.nic_pepper.get_secret_value())


def add_failures(db_session, identifier: str, count: int, ip: str = CLIENT_IP) -> None:
    for _ in range(count):
        db_session.execute(
            text("INSERT INTO npm.auth_attempt (identifier, ip, succeeded) VALUES (:identifier, :ip, false)"),
            {"identifier": identifier, "ip": ip},
        )


def attempts(db_session, identifier: str, succeeded: bool) -> int:
    return db_session.execute(
        text("SELECT count(*) FROM npm.auth_attempt WHERE identifier = :identifier AND succeeded = :succeeded"),
        {"identifier": identifier, "succeeded": succeeded},
    ).scalar_one()


def sign_in(client, nic: str = NIC, password: str = PASSWORD, **kwargs):
    return client.post("/v1/auth/sign-in", json={"nic": nic, "password": password}, **kwargs)


# --- Signing in ------------------------------------------------------------


def test_sign_in_sets_the_session_cookie_and_returns_the_profile(db_client, member, database_settings, delays):
    response = sign_in(db_client)

    assert response.status_code == 200
    body = response.json()
    claims = read_session_token(body["token"], database_settings.jwt_secret.get_secret_value())
    assert claims.member_id == member.id
    assert claims.session_version == member.session_version
    assert body["member"]["id"] == str(member.id)
    assert body["member"]["fullName"] == "Test Member"

    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"mp_session={body['token']};")
    for attribute in ("HttpOnly", "Max-Age=2592000", "Path=/", "SameSite=lax"):
        assert attribute in cookie
    assert "Secure" not in cookie  # development; staging and production add it
    assert response.headers["cache-control"] == "no-store"
    assert delays == [0.0]


def test_the_new_session_works_for_other_endpoints(db_client, member, delays):
    sign_in(db_client)

    assert db_client.get("/v1/members/me").json()["id"] == str(member.id)


def test_nic_is_matched_after_trimming_and_upper_casing(db_client, create_member, delays):
    create_member(nic="123456789V", password=PASSWORD)

    assert sign_in(db_client, nic="  123456789v ").status_code == 200


def test_wrong_password_is_refused_and_counted(db_client, db_session, member, identifier, delays):
    response = sign_in(db_client, password="wrong password")

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_credentials"}
    assert attempts(db_session, identifier, succeeded=False) == 1


def test_unknown_nic_gets_the_same_answer_and_is_counted(db_client, db_session, database_settings, delays):
    unknown_nic = "100000000001"
    identifier = nic_hash(unknown_nic, database_settings.nic_pepper.get_secret_value())

    response = sign_in(db_client, nic=unknown_nic)

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_credentials"}
    assert attempts(db_session, identifier, succeeded=False) == 1


def test_deleted_member_cannot_sign_in(db_client, db_session, member, delays):
    db_session.execute(text("UPDATE npm.member SET deleted_at = now() WHERE id = :id"), {"id": member.id})

    assert sign_in(db_client).status_code == 401


def test_missing_fields_are_rejected(db_client):
    assert db_client.post("/v1/auth/sign-in", json={"nic": NIC}).status_code == 422


# --- Throttling --------------------------------------------------------------


@pytest.mark.parametrize(("failures", "expected_delay"), [(4, 0.0), (5, 0.4), (7, 1.2), (9, 2.0)])
def test_repeated_failures_slow_sign_in_down(db_client, db_session, member, identifier, delays, failures, expected_delay):
    add_failures(db_session, identifier, failures)

    sign_in(db_client, password="wrong password")

    assert delays == [expected_delay]


def test_ten_failures_lock_sign_in_even_with_the_right_password(db_client, db_session, member, identifier, delays):
    add_failures(db_session, identifier, 10)

    response = sign_in(db_client)

    assert response.status_code == 429
    assert response.json() == {"detail": "too_many_attempts"}
    assert response.headers["retry-after"] == "900"
    # A locked attempt is not checked or recorded.
    assert attempts(db_session, identifier, succeeded=False) == 10
    assert attempts(db_session, identifier, succeeded=True) == 0


def test_signing_in_clears_earlier_failures(db_client, db_session, member, identifier, delays):
    add_failures(db_session, identifier, 7)

    assert sign_in(db_client).status_code == 200
    assert attempts(db_session, identifier, succeeded=False) == 0
    assert attempts(db_session, identifier, succeeded=True) == 1


def test_failures_from_another_address_do_not_lock_this_one(db_client, db_session, member, identifier, delays):
    # Throttling is per NIC and address together, so one person's typos in a
    # shared office do not lock their colleagues out.
    add_failures(db_session, identifier, 10, ip="198.51.100.99")

    assert sign_in(db_client).status_code == 200


def test_a_forged_forwarded_for_header_does_not_reset_the_count(db_client, db_session, member, identifier, delays):
    add_failures(db_session, identifier, 10)

    response = sign_in(db_client, headers={"X-Forwarded-For": "198.51.100.23"})

    assert response.status_code == 429


# --- Signing out -------------------------------------------------------------


def test_sign_out_ends_every_session_of_the_member(db_client, member, database_settings, delays):
    first_device = sign_in(db_client).json()["token"]
    other_device = sign_session_token(
        member.id, member.session_version, database_settings.jwt_secret.get_secret_value()
    )

    response = db_client.post("/v1/auth/sign-out")

    assert response.status_code == 204
    assert "Max-Age=0" in response.headers["set-cookie"]
    for token in (first_device, other_device):
        me = db_client.get("/v1/members/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 401
        assert me.json() == {"detail": "session_expired"}


def test_sign_out_with_a_bearer_token(db_client, member, database_settings):
    token = sign_session_token(member.id, member.session_version, database_settings.jwt_secret.get_secret_value())
    headers = {"Authorization": f"Bearer {token}"}

    assert db_client.post("/v1/auth/sign-out", headers=headers).status_code == 204
    assert db_client.get("/v1/members/me", headers=headers).status_code == 401


def test_an_old_or_ended_token_cannot_sign_the_member_out(db_client, db_session, member, database_settings, delays):
    """The review finding: sign-out read any well-signed token, so a copy left on a shared phone,
    long since signed out, could keep signing the member out everywhere."""
    secret = database_settings.jwt_secret.get_secret_value()
    old = {"Authorization": f"Bearer {sign_session_token(member.id, member.session_version, secret)}"}
    db_client.post("/v1/auth/sign-out", headers=old)  # the member signs out: this token is now stale
    current = {"Authorization": f"Bearer {sign_in(db_client).json()['token']}"}
    db_client.cookies.clear()
    ended = {"Authorization": f"Bearer {sign_in(db_client).json()['token']}"}
    db_client.cookies.clear()
    db_session.execute(
        text("UPDATE identity.session SET revoked_at = now(), revoked_reason = 'member' WHERE id = :id"),
        {"id": read_session_token(ended["Authorization"][7:], secret).session_id},
    )

    for stale in (old, ended):
        assert db_client.post("/v1/auth/sign-out", headers=stale).status_code == 204  # the cookie is still cleared

    assert db_client.get("/v1/members/me", headers=current).status_code == 200
