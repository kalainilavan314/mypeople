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
    referral_code: str | None = Field(description="The member's own referral code, shown on the card")
    photo_version: str | None = Field(description="Changes whenever the card photo changes; null without a photo")
    signature: list[list[list[float]]] | None = Field(
        description="The member's drawn signature: strokes of [x, y] points in 0..1 of a 3:1 pad; null when not signed"
    )


class CardSignatureIn(CamelModel):
    strokes: list[list[list[float]]] = Field(
        min_length=1, max_length=40, description="Strokes of [x, y] points in 0..1 of a 3:1 signature pad"
    )


class CardPhotoOut(CamelModel):
    photo_version: str


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
