"""GET /v1/members/me against a real database. Skipped when DATABASE_URL is not set.

Every test runs inside one transaction that is rolled back afterwards, so the
test members never remain in the database.
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import sign_session_token
from app.db.session import create_database_engine, get_db
from app.main import create_app


@pytest.fixture
def db_session(database_settings: Settings) -> Iterator[Session]:
    engine = create_database_engine(database_settings.database_url.get_secret_value())
    connection = engine.connect()
    transaction = connection.begin()
    # The API's commits become savepoints inside this outer transaction.
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
        engine.dispose()


@pytest.fixture
def client(database_settings: Settings, db_session: Session) -> TestClient:
    app = create_app(database_settings)
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def member(db_session: Session) -> Row:
    return db_session.execute(
        text(
            """
            INSERT INTO npm.member (member_code, full_name, password_hash, referral_code, nic_hash, language)
            VALUES ('TEST-' || left(gen_random_uuid()::text, 8), 'Test Member', 'not-a-bcrypt-hash',
                    'TEST-' || left(gen_random_uuid()::text, 8), 'test-' || gen_random_uuid(), 'ta')
            RETURNING id, session_version
            """
        )
    ).one()


@pytest.fixture
def jwt_secret(database_settings: Settings) -> str:
    return database_settings.jwt_secret.get_secret_value()


def test_me_requires_a_session(client):
    response = client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "unauthorized"}
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_returns_the_profile_for_a_session_cookie(client, member, jwt_secret):
    client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))

    response = client.get("/v1/members/me")

    assert response.status_code == 200
    profile = response.json()
    assert profile["id"] == str(member.id)
    assert profile["fullName"] == "Test Member"
    assert profile["language"] == "ta"
    assert profile["verificationStatus"] == "unverified"
    assert profile["joinedAt"].endswith("Z")  # UTC, like the Express API


def test_me_never_returns_secrets(client, member, jwt_secret):
    client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))

    keys = set(client.get("/v1/members/me").json())

    assert not keys & {"nicHash", "passwordHash", "sessionVersion", "reviewNotes", "verifiedBy", "isAdmin"}


def test_me_accepts_a_bearer_token(client, member, jwt_secret):
    token = sign_session_token(member.id, member.session_version, jwt_secret)

    response = client.get("/v1/members/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200


def test_me_accepts_a_session_signed_by_the_express_api(client, member, jwt_secret, express_auth):
    request = {"command": "sign", "memberId": str(member.id), "sessionVersion": member.session_version}
    client.cookies.set("mp_session", express_auth(request, jwt_secret)["token"])

    assert client.get("/v1/members/me").status_code == 200


def test_me_refuses_a_session_revoked_by_signing_out(client, db_session, member, jwt_secret):
    client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))
    # What POST /api/auth/logout does in the Express API.
    db_session.execute(
        text("UPDATE npm.member SET session_version = session_version + 1 WHERE id = :id"), {"id": member.id}
    )

    response = client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "session_expired"}


def test_me_refuses_a_deleted_member(client, db_session, member, jwt_secret):
    client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, jwt_secret))
    db_session.execute(text("UPDATE npm.member SET deleted_at = now() WHERE id = :id"), {"id": member.id})

    response = client.get("/v1/members/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "unauthorized"}


def test_me_refuses_a_token_signed_with_another_secret(client, member):
    other_secret = "a-different-secret-the-api-never-uses"
    client.cookies.set("mp_session", sign_session_token(member.id, member.session_version, other_secret))

    assert client.get("/v1/members/me").status_code == 401
