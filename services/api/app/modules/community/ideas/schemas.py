"""Request and response bodies for community ideas (H13)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.ideas.repository import Idea


class IdeaOut(CamelModel):
    id: uuid.UUID
    idea_ref: str
    title: str
    benefit: str
    state: Literal["pending", "published", "rejected", "withdrawn"]
    moderation_reason: str | None = Field(description="Shown to the author when the idea was not published")
    supports: int
    supported: bool
    mine: bool
    created_at: datetime

    @classmethod
    def build(cls, idea: Idea, viewer: uuid.UUID) -> "IdeaOut":
        mine = idea.author_id == viewer
        return cls(
            id=idea.id, idea_ref=idea.idea_ref, title=idea.title, benefit=idea.benefit, state=idea.state,  # type: ignore[arg-type]
            moderation_reason=idea.moderation_reason if mine else None, supports=idea.supports,
            supported=idea.supported, mine=mine, created_at=idea.created_at,
        )


class IdeaBoardOut(CamelModel):
    local: list[IdeaOut]
    mine: list[IdeaOut]


class IdeaIn(CamelModel):
    title: str = Field(min_length=5, max_length=80)
    benefit: str = Field(min_length=10, max_length=1000, description="The local benefit")


class SupportIn(CamelModel):
    support: bool


class PendingIdeaOut(CamelModel):
    id: uuid.UUID
    idea_ref: str
    title: str
    benefit: str
    area_key: str
    created_at: datetime

    @classmethod
    def build(cls, idea: Idea) -> "PendingIdeaOut":
        return cls(id=idea.id, idea_ref=idea.idea_ref, title=idea.title, benefit=idea.benefit, area_key=idea.area_key,
                   created_at=idea.created_at)


class IdeaModerationIn(CamelModel):
    publish: bool
    reason: str | None = Field(default=None, max_length=500)
