"""The gate in front of a v1.1 module's routes (FR-ARCH-011).

Usage in a router:

    router = APIRouter(..., dependencies=[Depends(require_feature("identity_appeals"))])

While the module is off, every route answers 404 feature_unavailable, as if
it did not exist. Outside production the flags are not enforced.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.features import repository
from app.modules.features.rules import FEATURES


def require_feature(key: str) -> Callable[..., None]:
    if key not in FEATURES:
        raise ValueError(f"unknown feature {key}")  # a typo must fail at start-up, not open a route

    def check(request: Request, db: Annotated[Session, Depends(get_db)]) -> None:
        if request.app.state.settings.feature_flags_enforced and not repository.is_enabled(db, key):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="feature_unavailable")

    return check
