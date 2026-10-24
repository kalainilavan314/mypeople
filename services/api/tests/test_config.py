import pytest
from pydantic import ValidationError

from app.core.config import Settings

REQUIRED = {"database_url": "postgresql://localhost/test", "jwt_secret": "test-only-jwt-secret"}


def test_misspelt_environment_is_rejected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")

    with pytest.raises(ValidationError, match="app_env"):
        Settings(_env_file=None, **REQUIRED)


@pytest.mark.parametrize("name", ["DATABASE_URL", "JWT_SECRET"])
def test_required_settings_have_no_default(monkeypatch, name):
    for variable in ("APP_ENV", "DATABASE_URL", "JWT_SECRET"):
        monkeypatch.delenv(variable, raising=False)
    values = {key: value for key, value in REQUIRED.items() if key != name.lower()}

    with pytest.raises(ValidationError, match=name.lower()):
        Settings(_env_file=None, **values)


def test_secrets_stay_out_of_repr():
    settings = Settings(
        _env_file=None,
        database_url="postgresql://member:not-a-real-password@localhost/db",
        jwt_secret="not-a-real-jwt-secret",
    )

    assert "not-a-real-password" not in repr(settings)
    assert "not-a-real-jwt-secret" not in repr(settings)


def test_production_refuses_the_express_dev_secret():
    with pytest.raises(ValidationError, match="development fallback"):
        Settings(_env_file=None, app_env="production", database_url=REQUIRED["database_url"], jwt_secret="dev-secret")


def test_development_may_use_the_express_dev_secret():
    Settings(_env_file=None, app_env="development", database_url=REQUIRED["database_url"], jwt_secret="dev-secret")
