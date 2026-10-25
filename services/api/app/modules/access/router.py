import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access import repository, service
from app.modules.access.dependencies import require_permission
from app.core.permissions import MATRIX, TIER_AREA_LEVEL, TIERS, default_permissions
from app.modules.access.schemas import (
    AssignmentInput,
    AssignmentOut,
    Catalogue,
    PreviewOut,
    RevokeInput,
    TierInfo,
)
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember

router = APIRouter(prefix="/v1/access", tags=["access"])

Db = Annotated[Session, Depends(get_db)]
CanAssign = Annotated[Staff, Depends(require_permission("roles.assign"))]

REFUSED = {403: {"description": 'forbidden, or {"code": "assignment_refused", "problems": [...]}'}}


def _refused(error: service.AssignmentRefused) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "assignment_refused", "problems": error.problems},
    )


@router.get("/me")
def read_my_access(member: CurrentMember, db: Db) -> list[AssignmentOut]:
    """The signed-in person's assignments that count right now. Apps use this to show
    or hide staff controls; the API still checks every request (RB-01)."""
    return [AssignmentOut.from_stored(a) for a in repository.effective_assignments(db, member.id)]


@router.get("/catalogue")
def read_catalogue(staff: CanAssign) -> Catalogue:
    """Tiers, their area levels and the permission matrix, for the W09 form."""
    return Catalogue(
        tiers=[
            TierInfo(tier=tier, area_level=TIER_AREA_LEVEL[tier], default_permissions=default_permissions(tier))
            for tier in TIERS
        ],
        permissions={permission: dict(tiers) for permission, tiers in MATRIX.items()},
    )


@router.post("/assignments/preview")
def preview_assignment(body: AssignmentInput, staff: CanAssign, db: Db) -> PreviewOut:
    """Check an assignment without saving it (RB-06, FR-WEB-031)."""
    request = service.to_request(body.member_id, body.tier, body.area.to_area(), body.permissions)
    problems, review_due_at = service.evaluate(db, staff, request)
    return PreviewOut(allowed=not problems, problems=problems, review_due_at=review_due_at)


@router.post("/assignments", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def create_assignment(body: AssignmentInput, request: Request, staff: CanAssign, db: Db) -> AssignmentOut:
    """Assign a tier, an area and explicit permissions to a verified member (W09, RB-02, RB-03)."""
    proposal = service.to_request(body.member_id, body.tier, body.area.to_area(), body.permissions)
    try:
        assignment = service.create(db, staff, proposal, body.note, client_ip(request))
    except service.AssignmentRefused as error:
        raise _refused(error) from None
    return AssignmentOut.from_stored(assignment)


@router.post("/assignments/{assignment_id}/revoke", responses={**REFUSED, 404: {"description": "not_found"}})
def revoke_assignment(
    assignment_id: uuid.UUID, body: RevokeInput, request: Request, staff: CanAssign, db: Db
) -> AssignmentOut:
    """End an assignment. The person loses its permissions on their next request."""
    try:
        assignment = service.revoke(db, staff, assignment_id, body.reason, client_ip(request))
    except service.AssignmentNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.AssignmentRefused as error:
        raise _refused(error) from None
    return AssignmentOut.from_stored(assignment)
