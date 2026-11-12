"""Notify.lk, the SMS aggregator for one-time codes and notices (INT-01). No real request leaves the test."""

import json
import logging

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.integrations.sms import (
    NOTIFY_LK_SEND_URL,
    NotifyLkSms,
    SmsDeliveryFailed,
    SmsUnavailable,
    build_sms,
    notify_lk_number,
)

REQUIRED = {
    "database_url": "postgresql://localhost/test",
    "jwt_secret": "test-only-jwt-secret",
    "nic_pepper": "test-only-nic-pepper",
}
NOTIFY = {"notify_lk_user_id": "12345", "notify_lk_api_key": "test-only-api-key", "notify_lk_sender_id": "MyPeople"}


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for variable in ("APP_ENV", "DATABASE_URL", "JWT_SECRET", "NIC_PEPPER", "SMS_PROVIDER",
                     "NOTIFY_LK_USER_ID", "NOTIFY_LK_API_KEY", "NOTIFY_LK_SENDER_ID"):
        monkeypatch.delenv(variable, raising=False)


class FakeNotify:
    """Records what would be posted and answers with a canned reply."""

    def __init__(self, reply: object = None, error: Exception | None = None) -> None:
        self.calls: list[tuple[str, dict[str, str], float]] = []
        self.reply = {"status": "success", "data": "Sent"} if reply is None else reply
        self.error = error

    def __call__(self, url: str, fields: dict[str, str], timeout: float) -> bytes:
        self.calls.append((url, fields, timeout))
        if self.error:
            raise self.error
        return self.reply if isinstance(self.reply, bytes) else json.dumps(self.reply).encode()


def sender(post: FakeNotify) -> NotifyLkSms:
    return NotifyLkSms(user_id="12345", api_key="test-only-api-key", sender_id="MyPeople", post=post)


@pytest.mark.parametrize("phone", ["+94762006562", "0762006562", "94762006562", "+94 76 200 6562"])
def test_numbers_become_the_94_form_notify_lk_wants(phone):
    assert notify_lk_number(phone) == "94762006562"


@pytest.mark.parametrize("phone", ["", "12345", "+447700900123", "07620065621"])
def test_a_number_that_is_not_sri_lankan_mobile_is_not_sent(phone):
    with pytest.raises(SmsDeliveryFailed):
        notify_lk_number(phone)


def test_a_message_goes_to_the_send_endpoint_with_the_account_and_sender():
    post = FakeNotify()
    sender(post).send("+94762006562", "My People code: 123456.")

    [(url, fields, timeout)] = post.calls
    assert url == NOTIFY_LK_SEND_URL == "https://app.notify.lk/api/v1/send"
    assert fields == {
        "user_id": "12345",
        "api_key": "test-only-api-key",
        "sender_id": "MyPeople",
        "to": "94762006562",
        "message": "My People code: 123456.",
    }
    assert 0 < timeout <= 10


def test_tamil_text_is_sent_as_unicode():
    post = FakeNotify()
    sender(post).send("0762006562", "என் மக்கள் குறியீடு: 123456.\nMy People code: 123456.")

    assert post.calls[0][1]["type"] == "unicode"


@pytest.mark.parametrize(
    "fake",
    [
        FakeNotify(reply={"status": "error", "errors": ["Insufficient balance"]}),
        FakeNotify(reply=b"<html>Bad gateway</html>"),
        FakeNotify(error=OSError("connection reset")),
        FakeNotify(error=TimeoutError()),
    ],
)
def test_a_refused_or_unanswered_send_is_a_delivery_failure(fake, caplog):
    with caplog.at_level(logging.WARNING), pytest.raises(SmsDeliveryFailed):
        sender(fake).send("+94762006562", "My People code: 654321.")

    # A failure is still "unavailable" to best-effort notices, which carry on without the text.
    assert issubclass(SmsDeliveryFailed, SmsUnavailable)
    logged = caplog.text
    for secret in ("654321", "94762006562", "762006562", "test-only-api-key"):
        assert secret not in logged


def test_the_settings_need_the_whole_notify_lk_account():
    with pytest.raises(ValidationError, match="NOTIFY_LK_USER_ID"):
        Settings(_env_file=None, **REQUIRED, sms_provider="notify_lk", notify_lk_user_id="12345")


def test_production_refuses_the_demo_sender_id():
    with pytest.raises(ValidationError, match="NotifyDEMO"):
        Settings(_env_file=None, **REQUIRED, app_env="production", sms_provider="notify_lk",
                 **{**NOTIFY, "notify_lk_sender_id": "NotifyDEMO"})


def test_staging_may_try_the_demo_sender_id_and_build_sms_returns_notify_lk():
    settings = Settings(_env_file=None, **REQUIRED, app_env="staging", sms_provider="notify_lk",
                        **{**NOTIFY, "notify_lk_sender_id": "NotifyDEMO"})

    assert isinstance(build_sms(settings), NotifyLkSms)
    assert "test-only-api-key" not in repr(settings)
