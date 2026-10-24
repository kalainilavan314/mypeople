"""Tests against a real PostgreSQL database. Skipped when DATABASE_URL is not set."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.config import Settings
from app.db.base import Base, include_object
from app.db.express_baseline import BASELINE_MIGRATIONS, applied_express_migrations
from app.db.session import create_database_engine
from app.main import create_app

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@pytest.fixture
def engine(database_settings: Settings) -> Iterator[Engine]:
    engine = create_database_engine(database_settings.database_url.get_secret_value())
    yield engine
    engine.dispose()


def test_database_health_reports_ok(database_settings):
    response = TestClient(create_app(database_settings)).get("/v1/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_express_ledger_is_readable(engine):
    with engine.connect() as connection:
        applied = applied_express_migrations(connection)

    assert applied <= set(BASELINE_MIGRATIONS)


def test_autogenerate_leaves_express_tables_alone(engine):
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection, opts={"include_schemas": True, "include_object": include_object}
        )
        assert compare_metadata(context, Base.metadata) == []


def test_database_is_at_alembic_head(engine):
    heads = set(ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_heads())
    with engine.connect() as connection:
        current = set(MigrationContext.configure(connection).get_current_heads())

    if not current:
        pytest.skip("This database is not under Alembic yet (alembic stamp or upgrade has not run).")
    assert current == heads
