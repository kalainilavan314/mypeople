import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel

CommunityReportStatus = Literal["submitted", "under_review", "in_progress", "resolved"]
CommunityReportPriority = Literal["low", "medium", "high"]
CommunityReportCategory = Literal[
    "road",
    "water",
    "waste",
    "electricity",
    "agriculture",
    "environment",
    "public_facility",
    "other",
]

ACTIONABLE_STATUSES: tuple[CommunityReportStatus, ...] = ("submitted", "under_review", "in_progress")
TERMINAL_STATUSES: tuple[CommunityReportStatus, ...] = ("resolved",)


class CommunityReportsQueueCount(CamelModel):
    """Aggregate actionable report counts for D01 operational work queues."""

    submitted: int = 0
    under_review: int = 0
    in_progress: int = 0
    total_actionable: int = 0


class CommunityReportSummaryOut(CamelModel):
    """Operational report summary without reporter contact data or identity disclosure."""

    id: uuid.UUID
    category: str
    title: str
    description: str
    district_code: str | None = None
    ds_code: str | None = None
    gs_code: str | None = None
    area_path: list[str] = Field(default_factory=list)
    priority: str
    status: CommunityReportStatus
    created_at: datetime
    updated_at: datetime


class CommunityReportListOut(CamelModel):
    """Bounded, paginated list of area-scoped community reports."""

    items: list[CommunityReportSummaryOut]
    total: int
    limit: int
    offset: int
