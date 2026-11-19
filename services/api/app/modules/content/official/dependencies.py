"""FastAPI dependencies for official content: the signer (INT-24) and the public check limit (INT-22)."""

from typing import Annotated

from fastapi import Depends, Request

from app.modules.content.official import rules
from app.modules.content.official.check_limiter import CheckLimiter
from app.modules.content.official.signing import Signer


def build_check_limiter() -> CheckLimiter:
    return CheckLimiter(rules.CHECKS_PER_WINDOW, rules.CHECK_WINDOW_SECONDS)


def get_signer(request: Request) -> Signer | None:
    """None while no signing key is configured; publishing then answers 503 signing_unavailable."""
    signer: Signer | None = request.app.state.content_signer
    return signer


def get_check_limiter(request: Request) -> CheckLimiter:
    limiter: CheckLimiter = request.app.state.official_check_limiter
    return limiter


CurrentSigner = Annotated[Signer | None, Depends(get_signer)]
Limiter = Annotated[CheckLimiter, Depends(get_check_limiter)]
