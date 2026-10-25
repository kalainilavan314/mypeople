from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.auth import service as auth_service
from app.modules.auth.device import describe
from app.modules.auth.repository import find_session_member
from app.modules.auth.session_cookie import set_session_cookie
from app.modules.identity.registration import service
from app.modules.identity.registration.schemas import (
    ConsentInput,
    NoticesOut,
    ProgressOut,
    RegistrationInput,
    RegistrationOut,
)
from app.modules.membership.repository import find_member_profile
from app.modules.membership.rules import NOTICE_VERSIONS
from app.modules.membership.schemas import MemberProfile

router = APIRouter(prefix="/v1/identity", tags=["registration"])

Db = Annotated[Session, Depends(get_db)]


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "already_registered: sign in or recover the account instead (FR-AUTH-012)"},
        429: {"description": "too_many_requests: too many new accounts from this address in the last hour"},
        422: {"description": '{"code": "registration_refused", "problems": [...]}, or an invalid body'},
    },
)
def register(body: RegistrationInput, request: Request, response: Response, db: Db) -> RegistrationOut:
    """Create an account with the NIC or passport route (A03, FR-AUTH-010 to 013).

    Returns a session like sign-in. The identity is "Draft" and the
    membership pending; nothing about the person is verified yet.
    """
    settings: Settings = request.app.state.settings
    form = service.Registration(
        route=body.route,
        id_number=body.id_number,
        passport_country=body.passport_country,
        full_name=body.full_name,
        password=body.password,
        language=body.language,
        dob=body.dob,
        gender=body.gender,
        district_code=body.district_code,
        ds_code=body.ds_code,
        gs_code=body.gs_code,
        referral_code=body.referral_code,
        survey_answers=dict(body.survey_answers),
    )
    try:
        registered = service.register(
            db,
            form,
            pepper=settings.nic_pepper.get_secret_value(),
            passport_pattern=settings.passport_number_pattern,
            ip=client_ip(request),
        )
    except service.RegistrationRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "registration_refused", "problems": error.problems},
        ) from None
    except service.AlreadyRegistered:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="already_registered") from None
    except service.TooManyRegistrations:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_requests", headers={"Retry-After": "3600"}
        ) from None

    member = find_session_member(db, registered.member_id)
    assert member is not None
    device = describe(request.headers.get("user-agent"), request.headers.get("x-device-id"))
    token = auth_service.start_session(
        db, member.id, member.session_version, device, settings.jwt_secret.get_secret_value()
    ).token
    set_session_cookie(response, token, settings)
    profile = find_member_profile(db, registered.member_id)
    assert profile is not None
    return RegistrationOut(
        token=token, member=MemberProfile.model_validate(dict(profile)), referral_accepted=registered.referral_accepted
    )


@router.get("/notices")
def read_notices() -> NoticesOut:
    """The current notice versions. Apps show these notices and send their version back with consent."""
    return NoticesOut(
        terms_and_privacy=NOTICE_VERSIONS["terms_and_privacy"], identity_review=NOTICE_VERSIONS["identity_review"]
    )


@router.post(
    "/me/consent",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={409: {"description": "notice_outdated: show the current notice and ask again"}},
)
def give_identity_consent(body: ConsentInput, member: CurrentMember, request: Request, db: Db) -> None:
    """A04: consent to identity review, given before any image is uploaded (BR-008, FR-REG-003)."""
    try:
        service.give_consent(db, member.id, "identity_review", body.notice_version, client_ip(request))
    except service.NoticeOutdated:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="notice_outdated") from None


@router.get("/me/progress")
def read_my_progress(member: CurrentMember, db: Db) -> ProgressOut:
    """Each registration step and whether it is done, and the next one (FR-AUTH-009, FR-REG-017)."""
    return ProgressOut.from_progress(service.progress(db, member.id))
