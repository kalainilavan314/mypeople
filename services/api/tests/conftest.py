"""Shared test fixtures.

Unit tests point the API at an unreachable database, so they never touch
PostgreSQL. Tests that need a real database take `database_settings` (or a
fixture built on it): it reads DATABASE_URL, JWT_SECRET and NIC_PEPPER
(environment first, then services/api/.env) and skips the test when no
database is configured. CI always provides one. Those tests run inside one
transaction that is rolled back afterwards, so nothing they write remains.
Staff tests build on `area` (a real GN division and the areas above it),
`assign` (inserts an assignment), `auth` (a Bearer header) and `super_admin`.

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
from app.core.security import hash_password, nic_hash, sign_session_token
from app.db.session import create_database_engine, get_db
from app.main import create_app
from app.modules.access.permissions import default_permissions

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
def area(db_session) -> Row:
    """A real GN division and the DS division, district and province above it."""
    return db_session.execute(
        text(
            """
            SELECT d.province_code AS province, ds.district_code AS district, ds.ds_code AS ds, g.gn_code AS gn
            FROM geo.gn_division g
            JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
            JOIN geo.district d ON d.district_code = ds.district_code
            ORDER BY g.gn_code LIMIT 1
            """
        )
    ).one()


@pytest.fixture
def assign(db_session) -> Callable[..., str]:
    """Insert an assignment directly, as a test set-up step."""

    def insert(member, tier, level, code, permissions, granted_by=None, review_due_at=None) -> str:
        return str(
            db_session.scalar(
                text(
                    """
                    INSERT INTO access.staff_assignment (member_id, tier, area_level, area_code, permissions,
                                                         granted_by, review_due_at)
                    VALUES (:member_id, :tier, :level, :code, :permissions, :granted_by, :review_due_at)
                    RETURNING id
                    """
                ),
                {
                    "member_id": member.id,
                    "tier": tier,
                    "level": level,
                    "code": code,
                    "permissions": sorted(permissions),
                    "granted_by": granted_by.id if granted_by else None,
                    "review_due_at": review_due_at,
                },
            )
        )

    return insert


@pytest.fixture
def auth(database_settings: Settings) -> Callable[[Row], dict[str, str]]:
    secret = database_settings.jwt_secret.get_secret_value()
    return lambda member: {"Authorization": f"Bearer {sign_session_token(member.id, member.session_version, secret)}"}


@pytest.fixture
def super_admin(create_member, assign) -> Row:
    member = create_member(verified=True)
    assign(member, "5", "platform", None, [*default_permissions("5"), "members.verify"])
    return member


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
