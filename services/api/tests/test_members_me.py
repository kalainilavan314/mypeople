"""GET /v1/members/me against a real database. Skipped when DATABASE_URL is not set."""

import pytest
from sqlalchemy import Row, text

from app.core.config import Settings
from app.core.security import sign_session_token


@pytest.fixture
def member(create_member) -> Row:
    return create_member()


@pytest.fixture
def jwt_secret(database_settings: Settings) -> str:
    return database_settings.jwt_secret.get_secret_value()


def test_me_requires_a_session(db_client):
    response = db_client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "unauthorized"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_returns_the_profile_for_a_session_cookie(db_client, member, jwt_secret):
    db_client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))

    response = db_client.get("/v1/members/me")

    assert response.status_code == 200
    profile = response.json()
    assert profile["id"] == str(member.id)
    assert profile["fullName"] == "Test Member"
    assert profile["language"] == "ta"
    assert profile["verificationStatus"] == "unverified"
    assert profile["joinedAt"].endswith("Z")  # UTC, like the Express API


def test_me_never_returns_secrets(db_client, member, jwt_secret):
    db_client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))

    keys = set(db_client.get("/v1/members/me").json())

    assert not keys & {"nicHash", "passwordHash", "sessionVersion", "reviewNotes", "verifiedBy", "isAdmin"}


def test_me_accepts_a_bearer_token(db_client, member, jwt_secret):
    token = sign_session_token(member.id, member.session_version, jwt_secret)

    response = db_client.get("/v1/members/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


def test_me_accepts_a_session_signed_by_the_express_api(db_client, member, jwt_secret, express_auth):
    request = {"command": "sign", "memberId": str(member.id), "sessionVersion": member.session_version}
    db_client.cookies.set("mp_session", express_auth(request, jwt_secret)["token"])

    assert db_client.get("/v1/members/me").status_code == 200


def test_me_refuses_a_session_revoked_by_signing_out(db_client, db_session, member, jwt_secret):
    db_client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))
    # What POST /api/auth/logout does in the Express API.
    db_session.execute(
        text("UPDATE npm.member SET session_version = session_version + 1 WHERE id = :id"), {"id": member.id}
    )

    response = db_client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "session_expired"}


def test_me_refuses_a_deleted_member(db_client, db_session, member, jwt_secret):
    db_client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))
    db_session.execute(text("UPDATE npm.member SET deleted_at = now() WHERE id = :id"), {"id": member.id})

    response = db_client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "unauthorized"}


def test_me_refuses_a_token_signed_with_another_secret(db_client, member):
    other_secret = "a-different-secret-the-api-never-uses"
    db_client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, other_secret))

    assert db_client.get("/v1/members/me").status_code == 401
