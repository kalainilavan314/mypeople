"""Shared test fixtures.

Unit tests point the API at an unreachable database, so they never touch
PostgreSQL. Tests that need a real database take the `database_settings`
fixture: it reads DATABASE_URL (environment first, then services/api/.env) and
skips the test when none is configured. CI always provides one.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app

# Nothing listens on port 1, so "database down" tests fail fast.
UNREACHABLE_DATABASE_URL = "postgresql://nobody@127.0.0.1:1/unreachable"


@pytest.fixture
def make_client() -> Callable[..., TestClient]:
    def build(app_env: str = "development") -> TestClient:
        settings = Settings(_env_file=None, app_env=app_env, database_url=UNREACHABLE_DATABASE_URL)
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
