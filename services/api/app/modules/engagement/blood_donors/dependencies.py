"""The gate in front of the partner's blood request desk (D27, PRM-55, FR-BLD-003).

A partner requester is not a staff tier: Tier 5 authorises a named account of a hospital or the blood
transfusion service. Like staff, they give the second factor in each session (NFR-SEC-04). A member
account without that authorisation never reaches the request function (403 not_partner_requester),
and the refusal is logged like any refused staff action.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.service import record_denial
from app.modules.auth import service as auth_service
from app.modules.auth.dependencies import CurrentMember
from app.modules.engagement.blood_donors import service
from app.modules.engagement.blood_donors.service import PartnerAccess


def require_partner_requester(request: Request, member: CurrentMember, db: Annotated[Session, Depends(get_db)]) -> PartnerAccess:
    access = service.partner_access(db, member.id)
    reason = None
    if access is None:
        reason = "not_partner_requester"
    elif request.app.state.settings.staff_mfa_required and not member.mfa_verified:
        reason = "mfa_required" if auth_service.has_enabled_factor(db, member.id) else "mfa_enrolment_required"
    if reason is not None:
        record_denial(db, actor_id=member.id, permission="donor.request", reason=reason, ip=client_ip(request),
                      details={"method": request.method, "path": request.url.path})
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)
    assert access is not None
    return access


PartnerRequester = Annotated[PartnerAccess, Depends(require_partner_requester)]
