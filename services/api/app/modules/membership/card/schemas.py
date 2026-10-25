from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel


class PublicCardOut(CamelModel):
    """What a shared public card may show (FR-CARD-012, BR-067): no QR, no identity numbers."""

    display_name: str
    member_code: str
    district_name: str | None
    gn_name: str | None


class CardOut(CamelModel):
    available: bool
    identity_verified: bool
    membership_state: str
    reason_code: str | None
    display_name: str | None
    member_code: str | None
    designation: str | None = Field(description="The highest staff tier, or null for a member")
    district_name: str | None
    gn_name: str | None
    member_since: datetime | None
    last_scanned_at: datetime | None = Field(description="The last successful scan, for C02's confirmation")
    public_card: PublicCardOut | None


class CardCodeOut(CamelModel):
    code: str
    expires_at: datetime
    refresh_after_seconds: int


class ScanInput(CamelModel):
    code: str = Field(max_length=200)


class ScanOut(CamelModel):
    result: Literal["valid", "expired", "not_valid"]
    display_name: str | None = None
    member_code: str | None = None
