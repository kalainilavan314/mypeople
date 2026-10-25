"""Recovery rules, one-time code hashing and reset tokens (FR-REG-028, FR-AUTH-014 to 016). No database needed."""

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import InvalidSessionToken, one_time_code_hash, read_session_token
from app.modules.identity.recovery import reset_tokens, rules
from app.modules.identity.recovery.rules import CodeRequests

SECRET = "test-only-jwt-secret-for-unit-tests"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("0771234567", "+94771234567"),
        ("077 123 4567", "+94771234567"),
        ("94771234567", "+94771234567"),
        ("+94 77 123-4567", "+94771234567"),
        ("+447911123456", "+447911123456"),
        ("12345", None),
        ("+0771234567", None),
        ("07712345678", None),
    ],
)
def test_phone_numbers_are_normalised_to_e164(raw, expected):
    assert rules.normalise_phone(raw) == expected


@pytest.mark.parametrize(
    ("sent", "wait"),
    [
        (CodeRequests(0, 0, 0, 0), None),
        (CodeRequests(1, 1, 1, 1), 60),
        (CodeRequests(0, 5, 5, 0), 3600),
        (CodeRequests(0, 4, 10, 0), 86400),
        (CodeRequests(0, 0, 0, 10), 600),
    ],
)
def test_code_limits_match_the_express_api(sent, wait):
    assert rules.code_request_wait(sent) == wait


def test_codes_are_six_digits_and_stored_as_express_stores_them():
    code = rules.new_code()
    assert len(code) == 6 and code.isdigit()
    expected = hmac.new(SECRET.encode(), f"otp:{code}".encode(), hashlib.sha256).hexdigest()  # lib.js hashOtp
    assert one_time_code_hash(code, SECRET) == expected


def test_code_messages_are_bilingual_and_say_how_long():
    text = rules.code_message("123456", timedelta(minutes=10))
    assert "123456" in text and "10" in text and "My People" in text and "என் மக்கள்" in text


def test_a_reset_token_names_one_account_and_session_version():
    member_id = uuid.uuid4()
    claims = reset_tokens.read(reset_tokens.sign(member_id, 3, SECRET), SECRET)
    assert (claims.member_id, claims.session_version) == (member_id, 3)


def test_reset_tokens_expire_and_are_not_sessions():
    old = reset_tokens.sign(uuid.uuid4(), 0, SECRET, issued_at=datetime.now(UTC) - timedelta(minutes=11))
    with pytest.raises(reset_tokens.InvalidResetToken):
        reset_tokens.read(old, SECRET)
    with pytest.raises(InvalidSessionToken):
        read_session_token(reset_tokens.sign(uuid.uuid4(), 0, SECRET), SECRET)
    with pytest.raises(reset_tokens.InvalidResetToken):
        reset_tokens.read(reset_tokens.sign(uuid.uuid4(), 0, SECRET), "another-secret")


def test_the_development_sms_outbox_is_refused_outside_development():
    base = dict(_env_file=None, database_url="postgresql://x@127.0.0.1:1/x", jwt_secret="a" * 40, nic_pepper="b" * 40)
    assert Settings(**base, sms_provider="development").sms_provider == "development"
    with pytest.raises(ValidationError):
        Settings(**base, app_env="production", sms_provider="development")
