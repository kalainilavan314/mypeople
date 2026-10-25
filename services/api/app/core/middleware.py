"""HTTP middleware shared by every /v1 endpoint, mirroring the Express API."""

import re
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlsplit

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.core.config import Settings
from app.core.security import SESSION_COOKIE

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# In development the apps run on their own local ports (Expo web 8081,
# Next.js 3000) and call the API on 8000. Only plain-HTTP localhost origins
# qualify, and only when APP_ENV is development.
LOCAL_DEVELOPMENT_ORIGIN = re.compile(r"http://(localhost|127\.0\.0\.1)(:\d+)?")

CallNext = Callable[[Request], Awaitable[Response]]


def cors_options(settings: Settings) -> dict[str, Any] | None:
    """Settings for Starlette's CORSMiddleware, or None for no cross-origin access.

    Like the Express API: origins in ALLOWED_ORIGINS may call with cookies.
    Development also allows local apps. Production allows nothing else.
    """
    origin_regex = LOCAL_DEVELOPMENT_ORIGIN.pattern if settings.app_env == "development" else None
    if not settings.allowed_origins and origin_regex is None:
        return None
    return {
        "allow_origins": settings.allowed_origins,
        "allow_origin_regex": origin_regex,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE"],
        "allow_headers": ["Authorization", "Content-Type", "X-Device-Id"],
    }


async def refuse_cross_origin_writes(request: Request, call_next: CallNext) -> Response:
    """Refuse a cookie-authenticated write sent from another website (CSRF).

    SameSite=Lax already stops browsers attaching the session cookie to most
    cross-site requests; this is the second line of defence, with the same rule
    as the Express API. It only applies when the session cookie is present and
    the browser sent an Origin header, so mobile apps (Bearer tokens) and
    non-browser clients are unaffected.
    """
    if (
        request.method in WRITE_METHODS
        and request.url.path.startswith("/v1/")
        and SESSION_COOKIE in request.cookies
    ):
        origin = request.headers.get("origin")
        if origin and not _origin_is_trusted(origin, request):
            return JSONResponse({"detail": "csrf_origin_mismatch"}, status_code=403)
    return await call_next(request)


def _origin_is_trusted(origin: str, request: Request) -> bool:
    settings: Settings = request.app.state.settings
    if origin in settings.allowed_origins:
        return True
    if settings.app_env == "development" and LOCAL_DEVELOPMENT_ORIGIN.fullmatch(origin):
        return True
    # Same origin: the page that sent the request was served from this host.
    return urlsplit(origin).netloc == request.headers.get("host")


async def add_security_headers(request: Request, call_next: CallNext) -> Response:
    """The same response headers the Express API sets on /api responses."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    if request.url.path.startswith("/v1/"):
        # Responses carry personal data and session tokens; nothing may cache them.
        response.headers["Cache-Control"] = "no-store"
    return response
