from pydantic import BaseModel, Field

from app.modules.membership.schemas import MemberProfile


class SignInRequest(BaseModel):
    nic: str = Field(min_length=1, max_length=32)
    # Generous upper bound: bcrypt only uses the first 72 bytes, but the limit
    # stops a client from sending megabytes to hash.
    password: str = Field(min_length=1, max_length=256)


class SignInResponse(BaseModel):
    """The token is returned for mobile apps; browsers use the HttpOnly cookie."""

    token: str
    member: MemberProfile
