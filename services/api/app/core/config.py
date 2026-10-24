"""Runtime settings for the API.

Each setting is read from an environment variable of the same name in upper
case (app_env -> APP_ENV), falling back to services/api/.env when the API is
started from that folder. The real .env is never committed; .env.example lists
the names.
"""

from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # A misspelt value such as "prod" fails at startup instead of silently
    # running production with development behaviour.
    app_env: Literal["development", "staging", "production"] = "development"

    # The same DATABASE_URL the Express API reads. Required, with no default, so
    # the API refuses to start without one. SecretStr keeps the password out of
    # logs and error reports that print the settings.
    database_url: SecretStr

    # Signs and verifies session tokens. It must be the same value as the
    # Express API's JWT_SECRET, so a member signed in through either API is
    # signed in to both. Changing it signs every member out.
    jwt_secret: SecretStr

    @model_validator(mode="after")
    def refuse_dev_secret_in_production(self) -> Self:
        # lib.js falls back to "dev-secret" when JWT_SECRET is unset, and the
        # Express API refuses to run in production with it. Do the same here,
        # in case that value is ever copied across.
        if self.app_env == "production" and self.jwt_secret.get_secret_value() == "dev-secret":
            raise ValueError("JWT_SECRET must not be the development fallback in production")
        return self
