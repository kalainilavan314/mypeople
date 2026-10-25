from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.request_info import client_ip
from app.core.security import SESSION_COOKIE, SESSION_LIFETIME
from app.db.session import get_db
from app.modules.auth import service
from app.modules.auth.dependencies import SessionToken
from app.modules.auth.schemas import SignInRequest, SignInResponse
from app.modules.membership.repository import find_member_profile
from app.modules.membership.schemas import MemberProfile

router = APIRouter(prefix="/v1/auth", tags=["auth"])

Db = Annotated[Session, Depends(get_db)]


@router.post(
    "/sign-in",
    responses={401: {"description": "invalid_credentials"}, 429: {"description": "too_many_attempts"}},
)
async def sign_in(body: SignInRequest, request: Request, response: Response, db: Db) -> SignInResponse:
    """Sign in with a NIC and password. Sets the session cookie and returns the token."""
    settings: Settings = request.app.state.settings
    try:
        signed_in = await service.sign_in(
            db,
            nic=body.nic,
            password=body.password,
            ip=client_ip(request),
            nic_pepper=settings.nic_pepper.get_secret_value(),
            jwt_secret=settings.jwt_secret.get_secret_value(),
        )
    except service.TooManyAttempts as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too_many_attempts",
            headers={"Retry-After": str(error.retry_after)},
        ) from None
    except service.InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials") from None

    # HttpOnly keeps the token away from page scripts; SameSite=Lax stops other
    # sites' forms and fetches from carrying it. Same attributes as Express.
    response.set_cookie(
        SESSION_COOKIE,
        signed_in.token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
    )
    profile = await run_in_threadpool(find_member_profile, db, signed_in.member_id)
    if profile is None:
        # The member was deleted in the moment between the password check and here.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    return SignInResponse(token=signed_in.token, member=MemberProfile.model_validate(dict(profile)))


@router.post("/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response, db: Db, token: SessionToken) -> None:
    """Sign out everywhere: every session token this member holds stops working."""
    settings: Settings = request.app.state.settings
    service.sign_out(db, token, settings.jwt_secret.get_secret_value())
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=settings.secure_cookies)
