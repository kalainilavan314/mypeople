"""Request and response bodies for moderation appeals (D12)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.moderation_appeals.repository import StoredAppeal
from app.modules.community.moderation_appeals.service import ManagedAppeal

AppealItemKind = Literal["idea", "addition"]
AppealState = Literal["open", "upheld", "changed"]


class ModerationAppealIn(CamelModel):
    item_kind: AppealItemKind
    item_id: uuid.UUID
    body: str = Field(min_length=10, max_length=1000, description="Why the author thinks the decision was wrong")


class ModerationAppealOut(CamelModel):
    """The author's own appeal; it never names a moderator."""

    id: uuid.UUID
    item_kind: AppealItemKind
    item_id: uuid.UUID
    state: AppealState
    body: str
    reason: str | None = Field(description="The deciding moderator's reason, once decided")
    decided_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, appeal: StoredAppeal) -> "ModerationAppealOut":
        return cls(
            id=appeal.id,
            item_kind=appeal.item_kind,  # type: ignore[arg-type]
            item_id=appeal.item_id,
            state=appeal.state,  # type: ignore[arg-type]
            body=appeal.body,
            reason=appeal.reason,
            decided_at=appeal.decided_at,
            created_at=appeal.created_at,
        )


class MyModerationAppealOut(CamelModel):
    appeal: ModerationAppealOut | None = Field(description="None when the member has not appealed this item")


class StaffModerationAppealOut(ModerationAppealOut):
    """What the deciding moderator reads: the item's words, the first decision and the appeal."""

    area_path: list[str]
    item_title: str | None = Field(description="An idea's title; None for added information")
    item_text: str | None = Field(description="An idea's benefit, or the added information as the member wrote it")
    item_state: str | None
    original_reason: str | None = Field(description="The first moderator's reason for rejecting it")
    original_decided_at: datetime | None
    issue_id: uuid.UUID | None = Field(description="The case added information belongs to")
    case_number: str | None
    can_decide: bool = Field(
        description="False for the first moderator, the author, a decided appeal or another area; the API checks again"
    )

    @classmethod
    def from_managed(cls, managed: ManagedAppeal) -> "StaffModerationAppealOut":
        row = managed.listed
        return cls(
            **ModerationAppealOut.build(row.appeal).model_dump(),
            area_path=row.appeal.area_path,
            item_title=row.item_title,
            item_text=row.item_text,
            item_state=row.item_state,
            original_reason=row.original_reason,
            original_decided_at=row.original_decided_at,
            issue_id=row.issue_id,
            case_number=row.case_number,
            can_decide=managed.can_decide,
        )


class ModerationAppealDecisionIn(CamelModel):
    change: bool = Field(description="True publishes the idea or approves the added information; False upholds the rejection")
    reason: str = Field(min_length=3, max_length=500, description="Told to the author")
