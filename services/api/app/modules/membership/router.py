from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.membership.repository import find_member_profile
from app.modules.membership.schemas import MemberProfile

router = APIRouter(prefix="/v1/members", tags=["members"])


@router.get("/me")
def read_my_profile(member: CurrentMember, db: Annotated[Session, Depends(get_db)]) -> MemberProfile:
    """The signed-in member's profile."""
    profile = find_member_profile(db, member.id)
    if profile is None:
        # The member was deleted between the session check and this read.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")
    return MemberProfile.model_validate(dict(profile))
