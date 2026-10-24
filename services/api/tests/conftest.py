"""Shared test fixtures.

Unit tests point the API at an unreachable database, so they never touch
PostgreSQL. Tests that need a real database take the `database_settings`
fixture: it reads DATABASE_URL and JWT_SECRET (environment first, then
services/api/.env) and skips the test when no database is configured. CI
always provides one.

Tests that compare behaviour with the Express API take `express_auth`, which
runs server/src/lib.js through tests/express/auth_helpers.mjs. They are skipped
when Node or the server's packages are missing.
"""

import json
import os
import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app

# Nothing listens on port 1, so "database down" tests fail fast.
UNREACHABLE_DATABASE_URL = "postgresql://nobody@127.0.0.1:1/unreachable"
TEST_JWT_SECRET = "test-only-jwt-secret-for-unit-tests"

EXPRESS_HELPER = Path(__file__).parent / "express" / "auth_helpers.mjs"
SERVER_NODE_MODULES = Path(__file__).resolve().parents[3] / "server" / "node_modules"


@pytest.fixture
def make_client() -> Callable[..., TestClient]:
    def build(app_env: str = "development") -> TestClient:
        settings = Settings(
            _env_file=None,
            app_env=app_env,
            database_url=UNREACHABLE_DATABASE_URL,
            jwt_secret=TEST_JWT_SECRET,
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
def express_auth() -> Callable[..., dict]:
    if shutil.which("node") is None or not (SERVER_NODE_MODULES / "bcryptjs").is_dir():
        pytest.skip("needs Node and `npm ci --prefix server`")

    def run(request: dict, jwt_secret: str, nic_pepper: str = "not-used-by-this-check") -> dict:
        env = {**os.environ, "JWT_SECRET": jwt_secret, "NIC_PEPPER": nic_pepper}
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
