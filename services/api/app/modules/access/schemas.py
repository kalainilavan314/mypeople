import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import Field, model_validator

from app.core.schemas import CamelModel
from app.core.permissions import AreaLevel, Tier
from app.modules.access.repository import StoredAssignment
from app.modules.access.rules import Area


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
