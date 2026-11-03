from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.profile import rules, service
from app.modules.profile.schemas import (
    ActivityItemOut,
    IdentityDataItemOut,
    ProfileOut,
    ProfileUpdateIn,
    SurveyAnswersIn,
)

router = APIRouter(prefix="/v1/profile", tags=["profile"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def read_profile(member: CurrentMember, db: Db) -> ProfileOut:
    """P01 and P02: what is recorded, what is locked, and any area change waiting for review."""
    return ProfileOut.build(service.profile(db, member.id))


@router.patch("")
def update_profile(body: ProfileUpdateIn, member: CurrentMember, request: Request, db: Db) -> ProfileOut:
    """Display name, gender and language preference (FR-PROF-003, FR-PROF-011). The legal name,
    date of birth and ID number are not fields here at all."""
    return ProfileOut.build(service.update(db, member.id, body.model_dump(exclude_unset=True), client_ip(request)))


@router.get("/activity")
def list_activity(
    member: CurrentMember,
    db: Db,
    kind: Annotated[rules.ActivityKind | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ActivityItemOut]:
    """P04: every receipt the member holds, newest first, with a filter (FR-PROF-010)."""
    return [ActivityItemOut.build(item) for item in service.activity(db, member.id, kind, limit)]


@router.get("/survey-answers")
def read_survey_answers(member: CurrentMember, db: Db) -> dict[str, str]:
    """The optional joining-survey answers (FR-PROF-017); never on cards or public views (BR-019)."""
    return service.survey_answers(db, member.id)


@router.put("/survey-answers")
def replace_survey_answers(body: SurveyAnswersIn, member: CurrentMember, request: Request, db: Db) -> dict[str, str]:
    return service.replace_survey_answers(db, member.id, dict(body.answers), client_ip(request))


@router.delete("/survey-answers", status_code=status.HTTP_204_NO_CONTENT)
def delete_survey_answers(member: CurrentMember, request: Request, db: Db) -> None:
    """"Delete my optional answers": deleted at once, and the deletion is logged (FR-PROF-017)."""
    service.replace_survey_answers(db, member.id, {}, client_ip(request))


@router.get("/identity-data")
def read_identity_data_notice(member: CurrentMember) -> list[IdentityDataItemOut]:
    """What identity data is kept, why, and for how long (FR-PROF-017). The periods are proposals (OD-03)."""
    return [IdentityDataItemOut(**item) for item in rules.IDENTITY_DATA_NOTICE]
