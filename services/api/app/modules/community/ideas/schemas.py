"""Request and response bodies for community ideas (H13)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.ideas.repository import Idea, IdeaAppeal


class IdeaAppealOut(CamelModel):
    """The author's one appeal of a moderation decision (D12) and, once decided, its outcome."""

    state: Literal["open", "upheld", "changed"]
    reason: str | None = Field(description="The deciding moderator's reason, once decided")
    created_at: datetime
    decided_at: datetime | None

    @classmethod
    def build(cls, appeal: IdeaAppeal) -> "IdeaAppealOut":
        return cls(state=appeal.state, reason=appeal.reason, created_at=appeal.created_at,  # type: ignore[arg-type]
                   decided_at=appeal.decided_at)


class IdeaOut(CamelModel):
    id: uuid.UUID
    idea_ref: str
    title: str = Field(description="The author sees what they wrote; everyone else the published (possibly edited) version")
    benefit: str
    state: Literal["pending", "published", "rejected", "withdrawn"]
    moderation_reason: str | None = Field(description="Shown to the author when the idea was not published")
    edited_by_moderator: bool = Field(description="Author only: a moderator published an edited version (D12)")
    published_title: str | None = Field(description="Author only: the edited title others see, when it was edited")
    published_benefit: str | None = Field(description="Author only: the edited benefit others see, when it was edited")
    appeal: IdeaAppealOut | None = Field(description="Author only: their one appeal of the moderation decision")
    supports: int
    supported: bool
    mine: bool
    created_at: datetime

    @classmethod
    def build(cls, idea: Idea, viewer: uuid.UUID, appeal: IdeaAppeal | None = None) -> "IdeaOut":
        mine = idea.author_id == viewer
        edited = idea.published_title is not None or idea.published_benefit is not None
        return cls(
            id=idea.id, idea_ref=idea.idea_ref,
            title=idea.title if mine else idea.published_title or idea.title,
            benefit=idea.benefit if mine else idea.published_benefit or idea.benefit,
            state=idea.state,  # type: ignore[arg-type]
            moderation_reason=idea.moderation_reason if mine else None,
            edited_by_moderator=mine and edited,
            published_title=idea.published_title if mine else None,
            published_benefit=idea.published_benefit if mine else None,
            appeal=IdeaAppealOut.build(appeal) if mine and appeal else None,
            supports=idea.supports, supported=idea.supported, mine=mine, created_at=idea.created_at,
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
    title: str = Field(description="As the author wrote it")
    benefit: str
    published_title: str | None = Field(description="The moderator's edited title, when one was published")
    published_benefit: str | None = Field(description="The moderator's edited benefit, when one was published")
    area_key: str
    created_at: datetime

    @classmethod
    def build(cls, idea: Idea) -> "PendingIdeaOut":
        return cls(id=idea.id, idea_ref=idea.idea_ref, title=idea.title, benefit=idea.benefit,
                   published_title=idea.published_title, published_benefit=idea.published_benefit,
                   area_key=idea.area_key, created_at=idea.created_at)


class IdeaModerationIn(CamelModel):
    publish: bool
    reason: str | None = Field(default=None, max_length=500)
    edited_title: str | None = Field(
        default=None, min_length=5, max_length=80, description="D12: publish this redacted title instead of the author's"
    )
    edited_benefit: str | None = Field(
        default=None, min_length=10, max_length=1000, description="D12: publish this redacted benefit instead of the author's"
    )
