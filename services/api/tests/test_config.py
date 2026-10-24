import pytest
from pydantic import ValidationError

from app.core.config import Settings

REQUIRED = {
    "database_url": "postgresql://localhost/test",
    "jwt_secret": "test-only-jwt-secret",
    "nic_pepper": "test-only-nic-pepper",
}
SETTING_VARIABLES = ("APP_ENV", "DATABASE_URL", "JWT_SECRET", "NIC_PEPPER", "ALLOWED_ORIGINS")


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for variable in SETTING_VARIABLES:
        monkeypatch.delenv(variable, raising=False)


def test_misspelt_environment_is_rejected(monkeypatch):
    monkeypatch.setenv("APP_ENV", "prod")

    with pytest.raises(ValidationError, match="app_env"):
        Settings(_env_file=None, **REQUIRED)


@pytest.mark.parametrize("name", ["database_url", "jwt_secret", "nic_pepper"])
def test_required_settings_have_no_default(name):
    values = {key: value for key, value in REQUIRED.items() if key != name}

    with pytest.raises(ValidationError, match=name):
        Settings(_env_file=None, **values)


def test_secrets_stay_out_of_repr():
    settings = Settings(
        _env_file=None,
        database_url="postgresql://member:not-a-real-password@localhost/db",
        jwt_secret="not-a-real-jwt-secret",
        nic_pepper="not-a-real-pepper",
    )

    text = repr(settings)
    assert "not-a-real-password" not in text
    assert "not-a-real-jwt-secret" not in text
    assert "not-a-real-pepper" not in text


@pytest.mark.parametrize(("name", "dev_value"), [("jwt_secret", "dev-secret"), ("nic_pepper", "dev-pepper")])
def test_production_refuses_the_express_dev_fallbacks(name, dev_value):
    with pytest.raises(ValidationError, match="development fallback"):
        Settings(_env_file=None, **(REQUIRED | {"app_env": "production", name: dev_value}))


def test_development_may_use_the_express_dev_fallbacks():
    Settings(_env_file=None, **(REQUIRED | {"jwt_secret": "dev-secret", "nic_pepper": "dev-pepper"}))


def test_allowed_origins_are_read_comma_separated(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://a.example, https://b.example,")

    assert Settings(_env_file=None, **REQUIRED).allowed_origins == ["https://a.example", "https://b.example"]


@pytest.mark.parametrize(("app_env", "secure"), [("development", False), ("staging", True), ("production", True)])
def test_cookies_need_https_outside_development(app_env, secure):
    assert Settings(_env_file=None, app_env=app_env, **REQUIRED).secure_cookies is secure
