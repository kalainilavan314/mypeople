"""HTTP middleware shared by every /v1 endpoint, mirroring the Express API."""

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.core.security import SESSION_COOKIE

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

CallNext = Callable[[Request], Awaitable[Response]]


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
    if origin in request.app.state.settings.allowed_origins:
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
