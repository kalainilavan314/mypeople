"""Authenticator codes, device descriptions, sealing and session-token ids. No database needed."""

import base64
import uuid

import pytest
from pydantic import ValidationError

from app.core import sealing
from app.core.config import Settings
from app.core.security import read_session_token, sign_session_token
from app.modules.auth import totp
from app.modules.auth.device import describe

RFC_SECRET = b"12345678901234567890"  # RFC 6238 appendix B, SHA-1
SECRET = "test-only-jwt-secret-for-unit-tests"


@pytest.mark.parametrize(
    ("unix_time", "code"),
    [(59, "287082"), (1111111109, "081804"), (1111111111, "050471"), (1234567890, "005924"), (2000000000, "279037")],
)
def test_codes_match_the_rfc_6238_vectors(unix_time, code):
    assert totp.code_for_step(RFC_SECRET, totp.step_at(unix_time)) == code


def test_one_step_of_drift_is_accepted_and_a_used_step_is_refused():
    now = 1234567890
    step = totp.step_at(now)
    previous = totp.code_for_step(RFC_SECRET, step - 1)

    assert totp.matching_step(RFC_SECRET, previous, now, None) == step - 1
    assert totp.matching_step(RFC_SECRET, previous, now, last_used_step=step - 1) is None  # no replay
    assert totp.matching_step(RFC_SECRET, totp.code_for_step(RFC_SECRET, step - 2), now, None) is None
    assert totp.matching_step(RFC_SECRET, "12345", now, None) is None


def test_secrets_are_shown_as_base32_and_a_scannable_uri():
    secret = totp.new_secret()
    text = totp.secret_text(secret)
    assert base64.b32decode(text + "=" * (-len(text) % 8)) == secret
    uri = totp.provisioning_uri(secret, "WTL-26-1234567")
    assert uri.startswith("otpauth://totp/My%20People%3AWTL-26-1234567?secret=")
    assert "issuer=My%20People" in uri and "digits=6" in uri and "period=30" in uri


def test_devices_get_a_coarse_label_and_a_stable_key():
    phone = describe("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131", None)
    app = describe("okhttp/4.12", "install-123")

    assert phone.label == "Android browser" and app.label == "Other device app"
    assert describe("okhttp/4.12", "install-123").key == app.key  # the app's install id decides
    assert describe("okhttp/4.12", "install-456").key != app.key
    assert describe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", None).label == "iPhone browser"


def test_sealed_values_open_only_for_their_record_and_key():
    key = sealing.derived_key(SECRET, b"purpose one")
    sealed = sealing.seal(key, b"record-a", b"secret value")

    assert sealing.unseal(key, b"record-a", sealed) == b"secret value"
    with pytest.raises(sealing.UnsealError):
        sealing.unseal(key, b"record-b", sealed)
    with pytest.raises(sealing.UnsealError):
        sealing.unseal(sealing.derived_key(SECRET, b"purpose two"), b"record-a", sealed)


def test_session_tokens_name_their_session_and_express_tokens_do_not():
    member_id, session_id = uuid.uuid4(), uuid.uuid4()
    with_session = read_session_token(sign_session_token(member_id, 2, SECRET, session_id=session_id), SECRET)
    without = read_session_token(sign_session_token(member_id, 2, SECRET), SECRET)

    assert (with_session.member_id, with_session.session_version, with_session.session_id) == (member_id, 2, session_id)
    assert without.session_id is None


def test_staff_mfa_can_be_switched_off_only_in_development():
    base = dict(_env_file=None, database_url="postgresql://x@127.0.0.1:1/x", jwt_secret="a" * 40, nic_pepper="b" * 40)
    assert Settings(**base, staff_mfa_required=False).staff_mfa_required is False
    with pytest.raises(ValidationError):
        Settings(**base, app_env="production", staff_mfa_required=False)
