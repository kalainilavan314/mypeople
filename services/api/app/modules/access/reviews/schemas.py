from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AssignmentOut


class DueGrantOut(AssignmentOut):
    """A grant waiting for review, with whose it is."""

    member_code: str
    full_name: str
    overdue: bool  # past its deadline: it no longer counts until someone confirms it
    last_reviewed_at: datetime | None


class DueReviewsOut(CamelModel):
    """D31: the grants this reviewer may confirm or revoke this quarter (FR-AUTH-027)."""

    quarter: str
    quarter_ends_at: datetime
    reviewed_this_quarter: int  # KPI-42: reviewed ÷ (reviewed + waiting) in the reviewer's areas
    items: list[DueGrantOut]


class ReviewInput(CamelModel):
    decision: Literal["confirmed", "revoked"]
    reason: str = Field(min_length=3, max_length=500)
