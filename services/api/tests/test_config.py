import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_misspelt_environment_is_rejected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/test")

    with pytest.raises(ValidationError, match="app_env"):
        Settings(_env_file=None)


def test_database_url_is_required(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError, match="database_url"):
        Settings(_env_file=None)


def test_database_password_stays_out_of_repr():
    settings = Settings(_env_file=None, database_url="postgresql://member:not-a-real-secret@localhost/db")

    assert "not-a-real-secret" not in repr(settings)
