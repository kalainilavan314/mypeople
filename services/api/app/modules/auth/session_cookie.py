"""The mp_session and mp_refresh cookies, set at sign-in, registration and refresh, cleared at sign-out."""

from fastapi import Response

from app.core.config import Settings
from app.core.security import SESSION_COOKIE, SESSION_LIFETIME
from app.modules.auth.refresh import REFRESH_COOKIE, REFRESH_COOKIE_PATH


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    # HttpOnly keeps the token away from page scripts; SameSite=Lax stops other
    # sites' forms and fetches from carrying it. Same attributes as Express.
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.secure_cookies,
    )


def set_refresh_cookie(response: Response, refresh_token: str, settings: Settings) -> None:
    # Strict and limited to the auth endpoints: browsers send it only to renew the session.
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        samesite="strict",
        secure=settings.secure_cookies,
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=settings.secure_cookies)
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, httponly=True, samesite="strict", secure=settings.secure_cookies
    )
