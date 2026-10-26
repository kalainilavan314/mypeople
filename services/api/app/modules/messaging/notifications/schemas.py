import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import Field, model_validator

from app.core.schemas import CamelModel
from app.modules.messaging.notifications.repository import StoredNotification
from app.modules.messaging.notifications.service import Choices, Inbox

Topic = Literal["account", "review", "events", "announcements", "emergency"]


class NotificationOut(CamelModel):
    """An inbox item. targetKind and targetId say what it opens (BR-027); actionNeeded stays true
    until the task is done, whether or not it was read."""

    id: uuid.UUID
    topic: Topic
    template: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    target_kind: str
    target_id: uuid.UUID | None
    action_needed: bool
    created_at: datetime
    read: bool

    @classmethod
    def build(cls, item: StoredNotification) -> "NotificationOut":
        return cls(
            id=item.id,
            topic=item.topic,  # type: ignore[arg-type]
            template=item.template,
            title_en=item.title_en,
            title_ta=item.title_ta,
            body_en=item.body_en,
            body_ta=item.body_ta,
            target_kind=item.target_kind,
            target_id=item.target_id,
            action_needed=item.action_required and item.action_done_at is None,
            created_at=item.created_at,
            read=item.read_at is not None,
        )


class InboxOut(CamelModel):
    items: list[NotificationOut]
    unread: int
    action_needed: int

    @classmethod
    def build(cls, inbox: Inbox) -> "InboxOut":
        return cls(
            items=[NotificationOut.build(item) for item in inbox.items],
            unread=inbox.unread,
            action_needed=inbox.action_needed,
        )


class TopicChoiceOut(CamelModel):
    topic: Topic
    push: bool
    sms: bool
    locked: bool = Field(description="Account and review notices cannot be turned off (FR-PROF-012)")


class ChoicesOut(CamelModel):
    topics: list[TopicChoiceOut]
    quiet_start: time | None = Field(description="Local time; non-urgent pushes wait until quietEnd")
    quiet_end: time | None

    @classmethod
    def build(cls, choices: Choices) -> "ChoicesOut":
        return cls(
            topics=[TopicChoiceOut(topic=c.topic, push=c.push, sms=c.sms, locked=c.locked) for c in choices.topics],  # type: ignore[arg-type]
            quiet_start=choices.quiet_start,
            quiet_end=choices.quiet_end,
        )


class TopicChoiceIn(CamelModel):
    topic: Topic
    push: bool
    sms: bool


class ChoicesIn(CamelModel):
    topics: list[TopicChoiceIn] = Field(default=[], max_length=10)
    quiet_start: time | None = None
    quiet_end: time | None = None
    clear_quiet_hours: bool = False

    @model_validator(mode="after")
    def quiet_hours_in_pairs(self) -> "ChoicesIn":
        if (self.quiet_start is None) != (self.quiet_end is None):
            raise ValueError("give both quietStart and quietEnd, or neither")
        return self


class DeviceIn(CamelModel):
    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["android", "ios", "web"]


class DeviceTokenIn(CamelModel):
    token: str = Field(min_length=10, max_length=4096)
