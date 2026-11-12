from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.home import service
from app.modules.home.schemas import HomeOut

router = APIRouter(prefix="/v1/home", tags=["home"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def read_home(member: CurrentMember, db: Db, request: Request) -> HomeOut:
    """Everything the Home tab shows, decided by the server: H01 or H02, one next step, the next
    event nearby, and which quick actions, tabs and hub services are open or locked with why."""
    flags_enforced = request.app.state.settings.feature_flags_enforced
    return HomeOut.build(service.home(db, member.id, flags_enforced=flags_enforced))
