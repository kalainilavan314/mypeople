"""Sending push notifications (BRD INT-02: Firebase Cloud Messaging and Apple Push; credentials not issued).

Modules never call a push service directly: the notification dispatcher
sends through PushSender. Until credentials exist there are two senders:

- NoPush refuses, so notifications stay in the in-app inbox and are marked
  as not pushed, never pretended to be delivered.
- DevelopmentPush keeps messages in memory for local development and tests.
  The settings refuse it outside APP_ENV=development.

A push carries only a short bilingual title and the notification's id for
the deep link, never personal data (INT-02); the app fetches the rest
after it opens.
"""

from collections import deque
from dataclasses import dataclass
from typing import Protocol

from app.core.config import Settings


class PushUnavailable(Exception):
    """No push provider is configured."""


@dataclass(frozen=True)
class PushMessage:
    token: str
    platform: str
    title: str  # "Tamil / English", short
    notification_id: str


class PushSender(Protocol):
    def send(self, message: PushMessage) -> bool:
        """True when the service accepted it; False when the token is no longer valid."""
        ...


class NoPush:
    def send(self, message: PushMessage) -> bool:
        raise PushUnavailable()


class DevelopmentPush:
    """An in-memory outbox for local development and tests; it never leaves the process."""

    def __init__(self) -> None:
        self.sent: deque[PushMessage] = deque(maxlen=200)
        self.invalid_tokens: set[str] = set()

    def send(self, message: PushMessage) -> bool:
        if message.token in self.invalid_tokens:
            return False
        self.sent.append(message)
        return True


def build_push(settings: Settings) -> PushSender:
    return DevelopmentPush() if settings.push_provider == "development" else NoPush()
