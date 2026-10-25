"""FastAPI dependency for endpoints that need a staff permission (RB-01, FR-ARCH-002).

Usage in a router:

    CanAssign = Annotated[Staff, Depends(require_permission("roles.assign"))]

    @router.post("/something")
    def do_something(staff: CanAssign) -> ...:

This checks that the person holds the permission somewhere and, unless
STAFF_MFA_REQUIRED is off in development, that they gave the second factor in
this session (403 mfa_required, or mfa_enrolment_required before they have an
authenticator). Endpoints that act on a particular area must also check that
area, through the service.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access import rules
from app.modules.access.service import Staff, load_staff, record_denial
from app.modules.auth import service as auth_service
from app.modules.auth.dependencies import CurrentMember


def require_permission(permission: str) -> Callable[..., Staff]:
    def check(request: Request, member: CurrentMember, db: Annotated[Session, Depends(get_db)]) -> Staff:
        staff = load_staff(db, member.id)
        settings = request.app.state.settings
        reason = None
        if not rules.holds(staff.rule_assignments(), permission):
            reason = "forbidden"
        elif settings.staff_mfa_required and not member.mfa_verified:
            # NFR-SEC-04: staff give a second factor in each session before acting as staff.
            reason = "mfa_required" if auth_service.has_enabled_factor(db, member.id) else "mfa_enrolment_required"
        if reason is not None:
            # Refused attempts are logged, so probing for access is visible (FR-ARCH-002); repeats are counted.
            record_denial(
                db,
                actor_id=member.id,
                permission=permission,
                reason=reason,
                ip=client_ip(request),
                details={"method": request.method, "path": request.url.path},
            )
            db.commit()
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)
        return staff

    return check
