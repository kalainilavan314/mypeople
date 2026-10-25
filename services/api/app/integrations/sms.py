"""Sending SMS (BRD INT-01: a Sri Lankan aggregator reaching every major network; vendor not chosen).

Modules send through SmsSender and never call a vendor directly. Until a
vendor is chosen there are two senders:

- NoSms refuses, so flows that must send a code answer 503 instead of
  pretending a message went out.
- DevelopmentSms keeps messages in memory for local development and tests.
  The settings refuse it outside APP_ENV=development.

Neither writes a message or a phone number to any log: one-time codes and
numbers are personal and secret.
"""

from collections import deque
from dataclasses import dataclass
from typing import Protocol

from app.core.config import Settings


class SmsUnavailable(Exception):
    """No SMS provider is configured."""


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


def build_sms(settings: Settings) -> SmsSender:
    return DevelopmentSms() if settings.sms_provider == "development" else NoSms()
