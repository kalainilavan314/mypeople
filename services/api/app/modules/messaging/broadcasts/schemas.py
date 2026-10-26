import uuid
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AreaRef
from app.modules.messaging.broadcasts.repository import StoredBroadcast
from app.modules.messaging.broadcasts.service import Preview


class BroadcastOut(CamelModel):
    id: uuid.UUID
    broadcast_ref: str
    topic: Literal["announcements", "emergency"]
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    area_level: str
    area_key: str
    state: Literal["draft", "pending_approval", "scheduled", "sent", "cancelled"]
    send_at: datetime | None
    sent_at: datetime | None
    recipients: int | None
    held_at: datetime | None = Field(description="When a silence period first held it back (NFR-ELC-03)")

    @classmethod
    def build(cls, broadcast: StoredBroadcast) -> "BroadcastOut":
        return cls(
            id=broadcast.id,
            broadcast_ref=broadcast.broadcast_ref,
            topic=broadcast.topic,  # type: ignore[arg-type]
            title_en=broadcast.title_en,
            title_ta=broadcast.title_ta,
            body_en=broadcast.body_en,
            body_ta=broadcast.body_ta,
            area_level=broadcast.area_level,
            area_key=broadcast.area_key,
            state=broadcast.state,  # type: ignore[arg-type]
            send_at=broadcast.send_at,
            sent_at=broadcast.sent_at,
            recipients=broadcast.recipients,
            held_at=broadcast.held_at,
        )


class BroadcastPreviewOut(BroadcastOut):
    """What members will see, how many it reaches, and anything that would stop it."""

    reaches: int
    problems: list[str] = Field(description="e.g. contains_id_number (FR-MSG-007)")
    needs_approval: bool = Field(description="Wider than a district (FR-ADM-007)")

    @classmethod
    def from_preview(cls, preview: Preview) -> "BroadcastPreviewOut":
        return cls(
            **BroadcastOut.build(preview.broadcast).model_dump(),
            reaches=preview.recipients,
            problems=preview.problems,
            needs_approval=preview.needs_approval,
        )


class BroadcastIn(CamelModel):
    topic: Literal["announcements", "emergency"]
    title_en: str = Field(min_length=1, max_length=80)
    title_ta: str = Field(min_length=1, max_length=80)
    body_en: str = Field(min_length=1, max_length=1000)
    body_ta: str = Field(min_length=1, max_length=1000)


class BroadcastCreateIn(BroadcastIn):
    area: AreaRef


class BroadcastUpdateIn(CamelModel):
    topic: Literal["announcements", "emergency"] | None = None
    title_en: str | None = Field(default=None, min_length=1, max_length=80)
    title_ta: str | None = Field(default=None, min_length=1, max_length=80)
    body_en: str | None = Field(default=None, min_length=1, max_length=1000)
    body_ta: str | None = Field(default=None, min_length=1, max_length=1000)


class BroadcastSubmitIn(CamelModel):
    send_at: AwareDatetime | None = Field(default=None, description="Later, or now when left out")
