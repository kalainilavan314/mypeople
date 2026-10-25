"""Live checks against the Express API's own code (server/src/lib.js,
throttle.js and bcryptjs).

The fixed vectors in test_security.py cover values signed in the past. These
tests sign and verify in both directions now, so expiry is checked for real.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import hash_password, read_session_token, sign_session_token, verify_password
from app.db.session import create_database_engine
from app.modules.auth.repository import count_recent_failures
from app.modules.auth import service as auth_service
from app.modules.auth.throttle import HARD_FAILURES, WINDOW, sign_in_gate

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


def test_express_refuses_sessions_ended_in_this_api(express_auth, database_settings):
    """The review finding: ending a session here left the same cookie working against /api.

    Express reads through its own connection, so the member and sessions here
    are committed and deleted afterwards.
    """
    database_url = database_settings.database_url.get_secret_value()
    engine = create_database_engine(database_url)
    with engine.begin() as connection:
        member_id = connection.scalar(
            text(
                """
                INSERT INTO npm.member (member_code, full_name, password_hash, referral_code, nic_hash, language)
                VALUES ('TEST-' || left(gen_random_uuid()::text, 8), 'Test Member', 'not-a-hash',
                        'TEST-' || left(gen_random_uuid()::text, 8), 'test-' || gen_random_uuid(), 'ta')
                RETURNING id
                """
            )
        )

        def session(**columns: str) -> uuid.UUID:
            names = "".join(f", {name}" for name in columns)
            values = "".join(f", {value}" for value in columns.values())
            return connection.scalar(
                text(
                    f"""
                    INSERT INTO identity.session (member_id, device_label, device_key{names})
                    VALUES (:member, 'Test device', 'test-key'{values}) RETURNING id
                    """
                ),
                {"member": member_id},
            )

        live = session(last_seen_at="now() - interval '10 minutes'")
        ended = session(revoked_at="now()", revoked_reason="'member'")
        idle = session(last_seen_at="now() - interval '31 days'")

    def express_accepts(session_id: uuid.UUID | None, owner: uuid.UUID = member_id) -> bool:
        token = sign_session_token(owner, 0, JWT_SECRET, session_id=session_id)
        return express_auth({"command": "session-live", "token": token}, JWT_SECRET, database_url=database_url)["live"]

    try:
        assert None not in (live, ended, idle)
        assert express_accepts(live) is True
        assert express_accepts(ended) is False
        assert express_accepts(idle) is False
        assert express_accepts(live, owner=uuid.uuid4()) is False  # another member's session
        assert express_accepts(None) is True  # an Express-style token names no session
        with engine.connect() as connection:
            touched = connection.scalar(
                text("SELECT last_seen_at > now() - interval '1 minute' FROM identity.session WHERE id = :id"), {"id": live}
            )
        assert touched is True
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM identity.session WHERE member_id = :id"), {"id": member_id})
            connection.execute(text("DELETE FROM npm.member WHERE id = :id"), {"id": member_id})
        engine.dispose()


def test_concurrent_sign_in_attempts_never_pass_the_lockout(express_auth, database_settings):
    """The review finding: attempts checked at the same moment all read the same count and
    slipped past the lockout together. Each API now counts an attempt before checking its
    password, under a lock both share. Committed under unique identifiers, deleted afterwards."""
    database_url = database_settings.database_url.get_secret_value()
    engine = create_database_engine(database_url)
    ip = "203.0.113.8"
    python_identifier, express_identifier = f"test-race-{uuid.uuid4()}", f"test-race-{uuid.uuid4()}"

    def python_attempt(_: int) -> bool:
        with Session(engine) as db:
            return auth_service._check_throttle(db, python_identifier, ip).allowed

    try:
        with ThreadPoolExecutor(max_workers=8) as pool:
            python_allowed = sum(pool.map(python_attempt, range(20)))
        express_allowed = express_auth(
            {"command": "reserve-login-burst", "identifier": express_identifier, "ip": ip, "attempts": 20},
            JWT_SECRET,
            database_url=database_url,
        )["allowed"]

        assert python_allowed == HARD_FAILURES
        assert express_allowed == HARD_FAILURES
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM npm.auth_attempt WHERE identifier IN (:a, :b)"),
                {"a": python_identifier, "b": express_identifier},
            )
        engine.dispose()


def test_express_counts_code_limits_per_purpose(express_auth, database_settings):
    """Recovery codes sent by this API never use up a phone's sign-up allowance in Express, nor
    the other way round. Committed under a test number, deleted afterwards."""
    database_url = database_settings.database_url.get_secret_value()
    engine = create_database_engine(database_url)
    phone = f"+9470{uuid.uuid4().int % 10**7:07d}"
    ip = "198.51.100.21"

    def express_check(purpose: str) -> dict:
        request = {"command": "check-otp", "phone": phone, "ip": ip, "purpose": purpose}
        return express_auth(request, JWT_SECRET, database_url=database_url)

    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO npm.otp (phone, code, purpose, ip, expires_at)
                    VALUES (:phone, 'not-a-code', 'recovery', '198.51.100.22', now() + interval '10 minutes')
                    """
                ),
                {"phone": phone},
            )
        assert express_check("signup") == {"ok": True}
        assert express_check("recovery")["reason"] == "cooldown"
    finally:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM npm.otp WHERE phone = :phone"), {"phone": phone})
        engine.dispose()
