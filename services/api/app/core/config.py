"""Runtime settings for the API.

Each setting is read from an environment variable of the same name in upper
case (app_env -> APP_ENV), falling back to services/api/.env when the API is
started from that folder. The real .env is never committed; .env.example lists
the names.
"""

import base64
import binascii
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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

    # Salts every stored NIC hash; must be the Express API's NIC_PEPPER. If it
    # ever changes, no existing member can sign in by NIC again.
    nic_pepper: SecretStr

    # Other origins allowed to send cookie-authenticated writes, as in the
    # Express API's ALLOWED_ORIGINS (comma-separated). Empty means same-origin only.
    allowed_origins: Annotated[list[str], NoDecode] = []

    # Identity evidence (NIC images, selfies) is kept as encrypted files in this
    # private directory, outside any web root; in production on the encrypted
    # /srv/secure volume. Set both values or neither: without them the
    # identity document endpoints answer 503.
    evidence_storage_dir: Path | None = None
    # 32 random bytes, base64-encoded. Encrypts every evidence file. Losing it
    # makes every stored image unreadable, so it is backed up apart from the files.
    evidence_encryption_key: SecretStr | None = None

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_comma_separated(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("evidence_encryption_key")
    @classmethod
    def key_is_32_bytes(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            try:
                key = base64.b64decode(value.get_secret_value(), validate=True)
            except binascii.Error:
                key = b""
            if len(key) != 32:
                raise ValueError("EVIDENCE_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
        return value

    @model_validator(mode="after")
    def evidence_settings_together(self) -> Self:
        if (self.evidence_storage_dir is None) != (self.evidence_encryption_key is None):
            raise ValueError("set EVIDENCE_STORAGE_DIR and EVIDENCE_ENCRYPTION_KEY together")
        return self

    @model_validator(mode="after")
    def refuse_dev_secrets_in_production(self) -> Self:
        # lib.js falls back to "dev-secret" and "dev-pepper" when the variables
        # are unset, and the Express API refuses to run in production with
        # them. Do the same here, in case those values are ever copied across.
        if self.app_env == "production":
            if self.jwt_secret.get_secret_value() == "dev-secret":
                raise ValueError("JWT_SECRET must not be the development fallback in production")
            if self.nic_pepper.get_secret_value() == "dev-pepper":
                raise ValueError("NIC_PEPPER must not be the development fallback in production")
        return self

    @property
    def secure_cookies(self) -> bool:
        """Cookies need HTTPS everywhere except local development."""
        return self.app_env != "development"

    @property
    def evidence_key(self) -> bytes | None:
        if self.evidence_encryption_key is None:
            return None
        return base64.b64decode(self.evidence_encryption_key.get_secret_value())
