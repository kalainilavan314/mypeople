import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.access import service as access
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.audit import service
from app.modules.audit.schemas import AuditEntryOut, ChainCheckOut

router = APIRouter(prefix="/v1/audit", tags=["audit"])

Db = Annotated[Session, Depends(get_db)]
CanViewAudit = Annotated[Staff, Depends(require_permission("audit.view"))]


@router.get("")
def list_audit_entries(
    staff: CanViewAudit,
    db: Db,
    actor_id: uuid.UUID | None = None,
    action: str | None = Query(default=None, max_length=100),
    before_id: int | None = Query(default=None, description="For paging: entries older than this id"),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[AuditEntryOut]:
    """Audit entries, newest first (FR-ADM-011). A regional auditor sees only entries in their region."""
    entries = service.list_entries(
        db,
        visible_areas=access.visible_audit_areas(staff),
        actor_id=actor_id,
        action=action,
        before_id=before_id,
        limit=limit,
    )
    return [AuditEntryOut.from_entry(entry) for entry in entries]


@router.get("/verify", responses={403: {"description": "forbidden or platform_scope_required"}})
def verify_audit_chain(staff: CanViewAudit, db: Db) -> ChainCheckOut:
    """Recompute the hash chain over the whole log. It spans every region, so it needs platform scope."""
    if not access.has_platform_permission(staff, "audit.view"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="platform_scope_required")
    result = service.verify_chain(db)
    return ChainCheckOut(ok=result.ok, checked=result.checked, first_broken_id=result.first_broken_id)
