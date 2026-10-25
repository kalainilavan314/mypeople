"""The mp_session cookie, set at sign-in and registration and cleared at sign-out."""

from fastapi import Response

from app.core.config import Settings
from app.core.security import SESSION_COOKIE, SESSION_LIFETIME


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


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax", secure=settings.secure_cookies)
