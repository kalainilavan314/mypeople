import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import Field, model_validator

from app.core.schemas import CamelModel
from app.core.permissions import AreaLevel, Tier
from app.modules.access.repository import StoredAssignment
from app.modules.access.rules import Area
from app.modules.community.reports.schemas import CommunityReportsQueueCount


class AreaRef(CamelModel):
    """An area: the whole platform, or a province, district, DS division or GN division by code."""

    level: AreaLevel
    code: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def code_matches_level(self) -> Self:
        if (self.level == "platform") != (self.code is None):
            raise ValueError("platform has no code; every other level needs one")
        return self

    def to_area(self) -> Area:
        return Area(self.level, self.code)


class AssignmentInput(CamelModel):
    member_id: uuid.UUID
    tier: Tier
    area: AreaRef
    permissions: list[str] = Field(max_length=60)
    note: str | None = Field(default=None, max_length=500)


class AssignmentOut(CamelModel):
    id: uuid.UUID
    member_id: uuid.UUID
    tier: Tier
    area: AreaRef
    permissions: list[str]
    state: Literal["active", "revoked"]
    granted_by: uuid.UUID | None
    granted_at: datetime
    review_due_at: datetime | None
    ended_at: datetime | None

    @classmethod
    def from_stored(cls, assignment: StoredAssignment) -> Self:
        return cls(
            id=assignment.id,
            member_id=assignment.member_id,
            tier=assignment.tier,
            area=AreaRef(level=assignment.area.level, code=assignment.area.code),
            permissions=sorted(assignment.permissions),
            state=assignment.state,  # type: ignore[arg-type]
            granted_by=assignment.granted_by,
            granted_at=assignment.granted_at,
            review_due_at=assignment.review_due_at,
            ended_at=assignment.ended_at,
        )


class PreviewOut(CamelModel):
    """What W09 shows before saving (RB-06). Each problem is a code the dashboard explains."""

    allowed: bool
    problems: list[str]
    review_due_at: datetime | None


class AssignmentPreviewCreateInput(CamelModel):
    """Input for creating a durable shared assignment preview."""

    member_code: str | None = None
    member_id: uuid.UUID | None = None
    tier: Tier
    area: AreaRef
    permissions: list[str] = Field(max_length=60)
    note: str | None = Field(default=None, max_length=500)


class AssignmentPreviewCreatedOut(CamelModel):
    """Opaque preview token returned to the caller."""

    id: uuid.UUID
    expires_at: datetime


class AssignmentPreviewOut(CamelModel):
    """Details of a durable preview retrieved for confirmation display."""

    id: uuid.UUID
    member_id: uuid.UUID
    member_code: str
    full_name: str
    tier: Tier
    area: AreaRef
    permissions: list[str]
    note: str | None
    review_due_at: datetime | None
    created_at: datetime
    expires_at: datetime
    status: Literal["active", "consumed", "cancelled"]


class RevokeInput(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class TierInfo(CamelModel):
    tier: Tier
    area_level: AreaLevel
    default_permissions: list[str]


class Catalogue(CamelModel):
    """The tiers and the permission matrix, for building the W09 form."""

    tiers: list[TierInfo]
    permissions: dict[str, dict[str, Literal["default", "explicit"]]]


class AssignmentListItemOut(AssignmentOut):
    """W09: an assignment with whose it is."""

    member_code: str
    full_name: str


class VerificationQueueCount(CamelModel):
    awaiting_review: int
    needs_update: int
    assigned_to_me: int


class SimpleQueueCount(CamelModel):
    waiting: int


class DuplicateQueueCount(CamelModel):
    open: int


class MembershipQueueCount(CamelModel):
    awaiting_activation: int


class EventsQueueCount(CamelModel):
    drafts: int
    published: int
    total: int


class GalleryRemovalsQueueCount(CamelModel):
    open: int
    escalated_18h: int


class GalleryAlbumsQueueCount(CamelModel):
    drafts: int
    submitted: int


class BroadcastsQueueCount(CamelModel):
    drafts: int
    pending_approval: int


class ConfigurationQueueCount(CamelModel):
    total: int
    enabled: int


class WorkQueuesOut(CamelModel):
    """Aggregate work queue counts for the caller's permitted areas (D01). Null for unheld permissions."""

    verification: VerificationQueueCount | None = None
    appeals: SimpleQueueCount | None = None
    duplicates: DuplicateQueueCount | None = None
    membership: MembershipQueueCount | None = None
    events: EventsQueueCount | None = None
    gallery_removals: GalleryRemovalsQueueCount | None = None
    gallery_albums: GalleryAlbumsQueueCount | None = None
    messaging: BroadcastsQueueCount | None = None
    configuration: ConfigurationQueueCount | None = None
    reports: CommunityReportsQueueCount | None = None
    unavailable: list[str] = Field(default_factory=list)
