import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access import repository, service
from app.modules.access.dependencies import require_permission
from app.core.permissions import MATRIX, TIER_AREA_LEVEL, TIERS, default_permissions
from app.modules.access.schemas import (
    AreaRef,
    AssignmentInput,
    AssignmentListItemOut,
    AssignmentOut,
    AssignmentPreviewCreateInput,
    AssignmentPreviewCreatedOut,
    AssignmentPreviewOut,
    Catalogue,
    PreviewOut,
    RevokeInput,
    TierInfo,
    WorkQueuesOut,
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


@router.get("/work-queues")
def read_work_queues(member: CurrentMember, request: Request, db: Db) -> WorkQueuesOut:
    """Audit-safe aggregate-only work queue counts for the signed-in staff member's visible areas and permissions (D01)."""
    staff = service.load_staff(db, member.id)
    if not staff.assignments:
        return WorkQueuesOut()
    settings = request.app.state.settings
    if settings.staff_mfa_required and not member.mfa_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="mfa_required")
    return service.work_queues(db, staff)


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


@router.get("/assignments")
def list_assignments(
    staff: CanAssign,
    db: Db,
    state: Literal["active", "revoked"] = "active",
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[AssignmentListItemOut]:
    """W09: assignments in the caller's own areas, newest first. Needs roles.assign."""
    return [
        AssignmentListItemOut(
            **AssignmentOut.from_stored(listed.assignment).model_dump(),
            member_code=listed.member_code,
            full_name=listed.full_name,
        )
        for listed in service.visible_assignments(db, staff, state, limit)
    ]


@router.post("/assignments/preview")
def preview_assignment(body: AssignmentInput, staff: CanAssign, db: Db) -> PreviewOut:
    """Check an assignment without saving it (RB-06, FR-WEB-031)."""
    request = service.to_request(body.member_id, body.tier, body.area.to_area(), body.permissions)
    problems, review_due_at = service.evaluate(db, staff, request)
    return PreviewOut(allowed=not problems, problems=problems, review_due_at=review_due_at)


@router.post("/assignment-previews", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def create_assignment_preview(
    body: AssignmentPreviewCreateInput, staff: CanAssign, db: Db
) -> AssignmentPreviewCreatedOut:
    """Create a durable, single-use, 10-minute preview record after rule validation."""
    member_id = body.member_id
    if member_id is None:
        if not body.member_code:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="code_required")
        resolved = repository.resolve_member_by_code(db, body.member_code)
        if resolved is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "assignment_refused", "problems": ["member_not_found"]},
            )
        member_id = resolved[0]

    proposal = service.to_request(member_id, body.tier, body.area.to_area(), body.permissions)
    try:
        preview = service.create_preview(db, staff, proposal, body.note, member_id)
    except service.AssignmentRefused as error:
        raise _refused(error) from None
    return AssignmentPreviewCreatedOut(id=preview.id, expires_at=preview.expires_at)


@router.get("/assignment-previews/{preview_id}")
def get_assignment_preview(preview_id: uuid.UUID, staff: CanAssign, db: Db) -> AssignmentPreviewOut:
    """Retrieve an active preview for display. Returns 404 for missing, expired, consumed, or other-user previews."""
    try:
        preview, member_code, full_name = service.get_preview(db, staff, preview_id)
    except service.AccessRefused:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preview_expired_or_invalid") from None
    return AssignmentPreviewOut(
        id=preview.id,
        member_id=preview.member_id,
        member_code=member_code,
        full_name=full_name,
        tier=preview.tier,
        area=AreaRef(level=preview.area.level, code=preview.area.code),
        permissions=sorted(preview.permissions),
        note=preview.note,
        review_due_at=preview.review_due_at,
        created_at=preview.created_at,
        expires_at=preview.expires_at,
        status=preview.status,  # type: ignore[arg-type]
    )


@router.post("/assignment-previews/{preview_id}/confirm", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def confirm_assignment_preview(
    preview_id: uuid.UUID, request: Request, staff: CanAssign, db: Db
) -> AssignmentOut:
    """Atomic confirmation with row lock, revalidation, assignment creation, and audit logging."""
    try:
        assignment = service.confirm_preview(db, staff, preview_id, client_ip(request))
    except service.AccessRefused:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preview_expired_or_invalid") from None
    except service.AssignmentRefused as error:
        raise _refused(error) from None
    return AssignmentOut.from_stored(assignment)


@router.post("/assignment-previews/{preview_id}/cancel")
def cancel_assignment_preview(preview_id: uuid.UUID, staff: CanAssign, db: Db) -> dict[str, str]:
    """Cancel an active preview belonging to the caller."""
    try:
        service.cancel_preview(db, staff, preview_id)
    except service.AccessRefused:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preview_expired_or_invalid") from None
    return {"status": "cancelled"}


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
