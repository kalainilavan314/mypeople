"""Runtime settings for the API.

Each setting is read from an environment variable of the same name in upper
case (app_env -> APP_ENV), falling back to services/api/.env when the API is
started from that folder. The real .env is never committed; .env.example lists
the names.
"""

from typing import Literal

from pydantic import SecretStr
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
