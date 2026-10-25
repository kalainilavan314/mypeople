"""Shared test fixtures.

Unit tests point the API at an unreachable database, so they never touch
PostgreSQL. Tests that need a real database take `database_settings` (or a
fixture built on it): it reads DATABASE_URL, JWT_SECRET and NIC_PEPPER
(environment first, then services/api/.env) and skips the test when no
database is configured. CI always provides one. Those tests run inside one
transaction that is rolled back afterwards, so nothing they write remains.

Tests that compare behaviour with the Express API take `express_auth`, which
runs server/src code through tests/express/auth_helpers.mjs. They are skipped
when Node or the server's packages are missing.
"""

import json
import os
import random
import shutil
import subprocess
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import Row, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password, nic_hash
from app.db.session import create_database_engine, get_db
from app.main import create_app

# Nothing listens on port 1, so "database down" tests fail fast.
UNREACHABLE_DATABASE_URL = "postgresql://nobody@127.0.0.1:1/unreachable"
TEST_JWT_SECRET = "test-only-jwt-secret-for-unit-tests"
TEST_NIC_PEPPER = "test-only-nic-pepper-for-unit-tests"

EXPRESS_HELPER = Path(__file__).parent / "express" / "auth_helpers.mjs"
SERVER_NODE_MODULES = Path(__file__).resolve().parents[3] / "server" / "node_modules"


@pytest.fixture
def make_client() -> Callable[..., TestClient]:
    def build(app_env: str = "development", allowed_origins: str = "") -> TestClient:
        settings = Settings(
            _env_file=None,
            app_env=app_env,
            database_url=UNREACHABLE_DATABASE_URL,
            jwt_secret=TEST_JWT_SECRET,
            nic_pepper=TEST_NIC_PEPPER,
            allowed_origins=allowed_origins,
        )
        return TestClient(create_app(settings))

    return build


@pytest.fixture
def database_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as error:
        if any(e["loc"] == ("database_url",) and e["type"] == "missing" for e in error.errors()):
            pytest.skip("DATABASE_URL is not configured")
        raise


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
def db_client(database_settings: Settings, db_session: Session) -> TestClient:
    """A client for the real API whose database work is rolled back afterwards."""
    app = create_app(database_settings)
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def create_member(db_session: Session, database_settings: Settings) -> Callable[..., Row]:
    pepper = database_settings.nic_pepper.get_secret_value()

    def create(nic: str | None = None, password: str = "correct horse battery", verified: bool = False) -> Row:
        # A random 12-digit NIC cannot collide with a real member's.
        nic = nic or str(random.randrange(10**11, 10**12))
        return db_session.execute(
            text(
                """
                INSERT INTO npm.member (member_code, full_name, password_hash, referral_code, nic_hash, language,
                                        verification_status)
                VALUES ('TEST-' || left(gen_random_uuid()::text, 8), 'Test Member', :password_hash,
                        'TEST-' || left(gen_random_uuid()::text, 8), :nic_hash, 'ta', :verification_status)
                RETURNING id, session_version, nic_hash
                """
            ),
            {
                "password_hash": hash_password(password),
                "nic_hash": nic_hash(nic, pepper),
                "verification_status": "identity_confirmed" if verified else "unverified",
            },
        ).one()

    return create


@pytest.fixture
def express_auth() -> Callable[..., dict]:
    if shutil.which("node") is None or not (SERVER_NODE_MODULES / "bcryptjs").is_dir():
        pytest.skip("needs Node and `npm ci --prefix server`")

    def run(
        request: dict,
        jwt_secret: str,
        nic_pepper: str = "not-used-by-this-check",
        database_url: str | None = None,
    ) -> dict:
        env = {**os.environ, "JWT_SECRET": jwt_secret, "NIC_PEPPER": nic_pepper}
        if database_url:
            env["DATABASE_URL"] = database_url
        result = subprocess.run(
            ["node", str(EXPRESS_HELPER)],
            input=json.dumps(request),
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            timeout=30,
            check=True,
        )
        return json.loads(result.stdout)

    return run
