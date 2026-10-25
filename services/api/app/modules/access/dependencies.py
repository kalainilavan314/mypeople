"""FastAPI dependency for endpoints that need a staff permission (RB-01, FR-ARCH-002).

Usage in a router:

    CanAssign = Annotated[Staff, Depends(require_permission("roles.assign"))]

    @router.post("/something")
    def do_something(staff: CanAssign) -> ...:

This checks that the person holds the permission somewhere. Endpoints that
act on a particular area must also check that area, through the service.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access import rules
from app.modules.access.service import Staff, load_staff
from app.modules.audit import service as audit
from app.modules.auth.dependencies import CurrentMember


def require_permission(permission: str) -> Callable[..., Staff]:
    def check(request: Request, member: CurrentMember, db: Annotated[Session, Depends(get_db)]) -> Staff:
        staff = load_staff(db, member.id)
        if not rules.holds(staff.rule_assignments(), permission):
            # Refused attempts are logged, so probing for access is visible (FR-ARCH-002).
            audit.record(
                db,
                actor_id=member.id,
                action="access.denied",
                details={"permission": permission, "method": request.method, "path": request.url.path},
                ip=client_ip(request),
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return staff

    return check
