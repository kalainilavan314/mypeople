import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class MemberProfile(BaseModel):
    """The signed-in member's own profile.

    JSON keys are camelCase, matching the Express /api/me response. The NIC
    hash, password hash and staff-only review fields are never part of it.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: uuid.UUID
    member_code: str
    full_name: str
    phone: str | None
    dob: date | None
    gender: str | None
    language: str
    tier: str
    referral_code: str
    verification_status: str
    verified_at: datetime | None
    district_code: str | None
    district_name: str | None
    ds_code: str | None
    ds_name: str | None
    gs_code: str | None
    gs_name: str | None
    joined_at: datetime
