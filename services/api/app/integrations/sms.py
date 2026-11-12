"""Sending SMS (BRD INT-01: a Sri Lankan aggregator reaching every major network).

Modules send through SmsSender and never call a vendor directly. There are three senders:

- NoSms refuses, so flows that must send a code answer 503 instead of
  pretending a message went out.
- DevelopmentSms keeps messages in memory for local development and tests.
  The settings refuse it outside APP_ENV=development.
- NotifyLkSms sends through Notify.lk, the aggregator the owner chose on
  12 November 2026. Its user ID, API key and sender ID come only from the
  server's settings file.

None of them writes a message, a phone number or a key to any log: one-time
codes and numbers are personal and secret.
"""

import json
import logging
import re
import urllib.parse
import urllib.request
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from app.core.config import Settings

logger = logging.getLogger(__name__)

NOTIFY_LK_SEND_URL = "https://app.notify.lk/api/v1/send"
NOTIFY_LK_TIMEOUT_SECONDS = 10.0


class SmsUnavailable(Exception):
    """No SMS provider is configured."""


class SmsDeliveryFailed(SmsUnavailable):
    """A provider is configured but did not accept the message (network, account or number).

    A subclass, so a best-effort notice that only catches SmsUnavailable still carries on.
    """


class SmsSender(Protocol):
    def send(self, phone: str, text: str) -> None: ...


class NoSms:
    def send(self, phone: str, text: str) -> None:
        raise SmsUnavailable()


@dataclass(frozen=True)
class SentMessage:
    phone: str
    text: str


class DevelopmentSms:
    """An in-memory outbox for local development and tests; it never leaves the process."""

    def __init__(self) -> None:
        self.sent: deque[SentMessage] = deque(maxlen=50)

    def send(self, phone: str, text: str) -> None:
        self.sent.append(SentMessage(phone=phone, text=text))


def notify_lk_number(phone: str) -> str:
    """Notify.lk wants 94XXXXXXXXX: the country code, no plus sign and no leading zero."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10 and digits.startswith("0"):
        digits = "94" + digits[1:]
    if not re.fullmatch(r"94\d{9}", digits):
        raise SmsDeliveryFailed()
    return digits


def _post_form(url: str, fields: dict[str, str], timeout: float) -> bytes:
    # A form body, not a query string: the API key never appears in a URL or a proxy log.
    body = urllib.parse.urlencode(fields).encode()
    request = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 (fixed https URL)
        return response.read()


class NotifyLkSms:
    """Notify.lk's send endpoint (https://developer.notify.lk/api-endpoints/)."""

    def __init__(
        self,
        user_id: str,
        api_key: str,
        sender_id: str,
        post: Callable[[str, dict[str, str], float], bytes] = _post_form,
    ) -> None:
        self._user_id = user_id
        self._api_key = api_key
        self._sender_id = sender_id
        self._post = post

    def send(self, phone: str, text: str) -> None:
        fields = {
            "user_id": self._user_id,
            "api_key": self._api_key,
            "sender_id": self._sender_id,
            "to": notify_lk_number(phone),
            "message": text,
        }
        if not text.isascii():
            fields["type"] = "unicode"  # Tamil text; without this the provider garbles it
        try:
            reply = json.loads(self._post(NOTIFY_LK_SEND_URL, fields, NOTIFY_LK_TIMEOUT_SECONDS))
        except (OSError, ValueError):  # no connection, a timeout, an HTTP error, or not JSON
            logger.warning("Notify.lk did not answer a send request")
            raise SmsDeliveryFailed() from None
        if not isinstance(reply, dict) or reply.get("status") != "success":
            # Only the provider's status word is logged, never the number, the text or the key.
            status = reply.get("status") if isinstance(reply, dict) else None
            logger.warning("Notify.lk refused a message (status %s)", str(status)[:40])
            raise SmsDeliveryFailed()


def build_sms(settings: Settings) -> SmsSender:
    if settings.sms_provider == "development":
        return DevelopmentSms()
    if settings.sms_provider == "notify_lk":
        # The settings check that all three are present before the app starts.
        assert settings.notify_lk_user_id and settings.notify_lk_api_key and settings.notify_lk_sender_id
        return NotifyLkSms(
            user_id=settings.notify_lk_user_id,
            api_key=settings.notify_lk_api_key.get_secret_value(),
            sender_id=settings.notify_lk_sender_id,
        )
    return NoSms()
