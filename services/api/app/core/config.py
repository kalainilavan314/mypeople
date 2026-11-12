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

    # How one-time codes are sent (INT-01). "none" answers 503 sms_not_configured
    # wherever a code must be sent. "development" keeps messages in memory and
    # returns the code in the response; it is refused outside APP_ENV=development,
    # so a live system can never leak codes. "notify_lk" sends through Notify.lk
    # (the owner's choice, 12 November 2026) with the three values below.
    sms_provider: Literal["none", "development", "notify_lk"] = "none"
    # Notify.lk account (Settings page of app.notify.lk). The sender ID is the
    # approved name messages come from; "NotifyDEMO" is for tests only.
    notify_lk_user_id: str | None = None
    notify_lk_api_key: SecretStr | None = None
    notify_lk_sender_id: str | None = None

    # Push notifications (INT-02; no credentials yet). "none" keeps notifications in the
    # in-app inbox only; "development" keeps pushes in memory and is refused outside development.
    push_provider: Literal["none", "development"] = "none"

    # FR-ARCH-011: v1.1 modules stay off until their phase gate is recorded. Always enforced in
    # production; elsewhere off by default so development and tests see every module.
    enforce_feature_flags: bool = False

    # NFR-SEC-04: staff give a second factor (an authenticator code) in each
    # session before any staff endpoint. Only development may switch it off.
    staff_mfa_required: bool = True

    # FR-AUTH-011: passport numbers are checked against a configurable pattern.
    # [ASSUMPTION] 6 to 9 letters or digits until the sponsor sets the rule.
    passport_number_pattern: str = r"^[A-Z0-9]{6,9}$"

    # Identity evidence (NIC images, selfies) is kept as encrypted files in this
    # private directory, outside any web root; in production on the encrypted
    # /srv/secure volume. Set both values or neither: without them the
    # identity document endpoints answer 503.
    evidence_storage_dir: Path | None = None
    # 32 random bytes, base64-encoded. Encrypts every evidence file. Losing it
    # makes every stored image unreadable, so it is backed up apart from the files.
    evidence_encryption_key: SecretStr | None = None

    # Gallery photos (FR-GAL-006): WebP files re-encoded without metadata, served
    # only through the API. Without it the gallery's photo endpoints answer 503.
    media_storage_dir: Path | None = None

    # M1.4 Community Finance (FR-FUND, FR-PAY)
    finance_intake_enabled: bool = False
    finance_bank_name: str | None = None
    finance_account_name: str | None = None
    finance_account_number: SecretStr | None = None
    finance_branch_name: str | None = None
    finance_transfer_instructions_en: str | None = None
    finance_transfer_instructions_ta: str | None = None
    finance_encryption_key: SecretStr | None = None
    finance_malware_scanner: Literal["none", "development", "clamav", "stub"] = "none"
    finance_clamav_host: str = "127.0.0.1"
    finance_clamav_port: int = 3310
    finance_clamav_timeout_seconds: float = 10.0
    # Development fallback only. Enforced environments read the current value
    # from the immutable FIN-01 production control recorded through P3.
    finance_internal_review_threshold_minor: int = 10_000_000

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

    @field_validator("finance_encryption_key")
    @classmethod
    def finance_key_is_32_bytes(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            try:
                key = base64.b64decode(value.get_secret_value(), validate=True)
            except binascii.Error:
                key = b""
            if len(key) != 32:
                raise ValueError("FINANCE_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
        return value

    @model_validator(mode="after")
    def staff_mfa_off_only_in_development(self) -> Self:
        if not self.staff_mfa_required and self.app_env != "development":
            raise ValueError("STAFF_MFA_REQUIRED=false is allowed only with APP_ENV=development")
        return self

    @model_validator(mode="after")
    def development_push_only_in_development(self) -> Self:
        if self.push_provider == "development" and self.app_env != "development":
            raise ValueError("PUSH_PROVIDER=development is allowed only with APP_ENV=development")
        return self

    @model_validator(mode="after")
    def development_sms_only_in_development(self) -> Self:
        if self.sms_provider == "development" and self.app_env != "development":
            raise ValueError("SMS_PROVIDER=development is allowed only with APP_ENV=development")
        return self

    @model_validator(mode="after")
    def notify_lk_needs_its_account(self) -> Self:
        if self.sms_provider != "notify_lk":
            return self
        if not (self.notify_lk_user_id and self.notify_lk_api_key and self.notify_lk_sender_id):
            raise ValueError("SMS_PROVIDER=notify_lk needs NOTIFY_LK_USER_ID, NOTIFY_LK_API_KEY and NOTIFY_LK_SENDER_ID")
        # Notify.lk suspends accounts that send one-time codes from its demo sender ID.
        if self.app_env == "production" and self.notify_lk_sender_id == "NotifyDEMO":
            raise ValueError("NOTIFY_LK_SENDER_ID=NotifyDEMO is for tests only; use the approved sender ID in production")
        return self

    @model_validator(mode="after")
    def development_scanner_only_in_development(self) -> Self:
        if self.finance_malware_scanner in ("development", "stub") and self.app_env != "development":
            raise ValueError("FINANCE_MALWARE_SCANNER=development/stub is allowed only with APP_ENV=development")
        return self

    @model_validator(mode="after")
    def production_finance_requires_clamav(self) -> Self:
        if self.finance_intake_enabled and self.app_env != "development" and self.finance_malware_scanner != "clamav":
            raise ValueError("enabled finance intake requires FINANCE_MALWARE_SCANNER=clamav outside development")
        if not 1 <= self.finance_clamav_port <= 65535:
            raise ValueError("FINANCE_CLAMAV_PORT must be between 1 and 65535")
        if not 0.1 <= self.finance_clamav_timeout_seconds <= 60:
            raise ValueError("FINANCE_CLAMAV_TIMEOUT_SECONDS must be between 0.1 and 60")
        return self

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
    def feature_flags_enforced(self) -> bool:
        return self.app_env == "production" or self.enforce_feature_flags

    @property
    def secure_cookies(self) -> bool:
        """Cookies need HTTPS everywhere except local development."""
        return self.app_env != "development"

    @property
    def evidence_key(self) -> bytes | None:
        if self.evidence_encryption_key is None:
            return None
        return base64.b64decode(self.evidence_encryption_key.get_secret_value())

    @property
    def finance_key(self) -> bytes | None:
        if self.finance_encryption_key is None:
            return None
        val = (
            self.finance_encryption_key.get_secret_value()
            if isinstance(self.finance_encryption_key, SecretStr)
            else self.finance_encryption_key
        )
        return base64.b64decode(val)

    @property
    def is_finance_configured(self) -> bool:
        """True if all mandatory banking details and encryption keys are present."""
        acc_num = (
            self.finance_account_number.get_secret_value()
            if isinstance(self.finance_account_number, SecretStr)
            else (self.finance_account_number or "")
        )
        return bool(
            self.finance_bank_name
            and self.finance_account_name
            and acc_num.strip()
            and self.finance_branch_name
            and self.finance_transfer_instructions_en
            and self.finance_transfer_instructions_ta
            and self.finance_encryption_key
            and self.finance_malware_scanner != "none"
        )
