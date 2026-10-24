"""Live checks against the Express API's own code (server/src/lib.js,
throttle.js and bcryptjs).

The fixed vectors in test_security.py cover values signed in the past. These
tests sign and verify in both directions now, so expiry is checked for real.
"""

import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_password, read_session_token, sign_session_token, verify_password
from app.db.session import create_database_engine
from app.modules.auth.repository import count_recent_failures
from app.modules.auth.throttle import WINDOW, sign_in_gate

JWT_SECRET = "test-only-compat-secret-for-pytest-runs"
OTHER_SECRET = "a-different-secret-the-api-never-uses"
MEMBER_ID = uuid.uuid4()


def wrong_password(password: str) -> str:
    # Change the first character: bcrypt ignores everything after byte 72, so
    # changing the end of a long password would still match.
    return "!" + password[1:]


def test_python_accepts_a_token_express_just_signed(express_auth):
    token = express_auth({"command": "sign", "memberId": str(MEMBER_ID), "sessionVersion": 2}, JWT_SECRET)["token"]

    claims = read_session_token(token, JWT_SECRET)

    assert claims.member_id == MEMBER_ID
    assert claims.session_version == 2


def test_express_accepts_a_token_python_just_signed(express_auth):
    token = sign_session_token(MEMBER_ID, 5, JWT_SECRET)

    claims = express_auth({"command": "verify", "token": token}, JWT_SECRET)["claims"]

    assert claims["sub"] == str(MEMBER_ID)
    assert claims["sv"] == 5
    assert claims["exp"] - claims["iat"] == 30 * 24 * 60 * 60


def test_express_rejects_a_python_token_signed_with_another_secret(express_auth):
    token = sign_session_token(MEMBER_ID, 0, OTHER_SECRET)

    assert express_auth({"command": "verify", "token": token}, JWT_SECRET) == {"error": "JsonWebTokenError"}


@pytest.mark.parametrize("password", ["correct horse battery", "தமிழ்" * 12], ids=["ascii", "tamil-180-bytes"])
def test_express_accepts_python_password_hashes(express_auth, password):
    stored = hash_password(password)

    def express_matches(candidate: str) -> bool:
        request = {"command": "bcrypt-compare", "password": candidate, "hash": stored}
        return express_auth(request, JWT_SECRET)["matches"]

    assert express_matches(password)
    assert not express_matches(wrong_password(password))


@pytest.mark.parametrize("password", ["kalai-2026", "தமிழ்" * 12], ids=["ascii", "tamil-180-bytes"])
def test_python_accepts_a_hash_express_just_made(express_auth, password):
    # The fixed vectors cover this too; doing it live catches a bcryptjs
    # upgrade that changes its output.
    stored = express_auth({"command": "bcrypt-hash", "password": password}, JWT_SECRET)["hash"]

    assert verify_password(password, stored)
    assert not verify_password(wrong_password(password), stored)


def test_throttle_decisions_match_express(express_auth, database_settings):
    """Both APIs count the same npm.auth_attempt rows and must decide alike.

    Express reads through its own connection, so the attempts here are
    committed (under a unique test identifier) and deleted afterwards.
    """
    database_url = database_settings.database_url.get_secret_value()
    engine = create_database_engine(database_url)
    identifier = f"test-throttle-{uuid.uuid4()}"
    ip = "203.0.113.7"
    try:
        for _ in range(12):
            express = express_auth(
                {"command": "check-login", "identifier": identifier, "ip": ip}, JWT_SECRET, database_url=database_url
            )
            with Session(engine) as db:
                failures = count_recent_failures(db, identifier, ip, WINDOW)
            gate = sign_in_gate(failures)
            python = {"ok": gate.allowed, "failures": failures}
            python |= {"delayMs": round(gate.delay_seconds * 1000)} if gate.allowed else {"retryAfter": gate.retry_after}

            assert python == express

            with engine.begin() as connection:
                connection.execute(
                    text("INSERT INTO npm.auth_attempt (identifier, ip, succeeded) VALUES (:identifier, :ip, false)"),
                    {"identifier": identifier, "ip": ip},
                )
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM npm.auth_attempt WHERE identifier = :identifier"), {"identifier": identifier})
        engine.dispose()
