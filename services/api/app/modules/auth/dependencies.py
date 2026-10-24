"""FastAPI dependency for endpoints that need a signed-in member.

Usage in a router:

    @router.get("/something")
    def read_something(member: CurrentMember) -> ...:
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.repository import SessionMember
from app.modules.auth.service import NotAuthenticated, authenticate

# The Express API sets this HttpOnly cookie at sign-in. Browsers send it to
# /v1 too, because both APIs are served from the same origin.
SESSION_COOKIE = "mp_session"

# Declared as security schemes so the OpenAPI document shows which endpoints
# need a session. auto_error=False lets authenticate() decide what a missing
# token means, so every failure gets the same 401 response.
session_cookie = APIKeyCookie(
    name=SESSION_COOKIE, auto_error=False, description="Session cookie set at sign-in (browsers)."
)
bearer_token = HTTPBearer(auto_error=False, description="The same session token, for mobile apps.")


def get_current_member(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    cookie: Annotated[str | None, Depends(session_cookie)],
    bearer: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_token)],
) -> SessionMember:
    # Cookie first, then the Authorization header, as tokenFromReq does in Express.
    token = cookie or (bearer.credentials if bearer else None)
    jwt_secret = request.app.state.settings.jwt_secret.get_secret_value()
    try:
        return authenticate(db, token, jwt_secret)
    except NotAuthenticated as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error.reason,
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


CurrentMember = Annotated[SessionMember, Depends(get_current_member)]
