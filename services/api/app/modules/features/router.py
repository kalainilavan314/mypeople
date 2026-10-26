from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.features import service
from app.modules.features.rules import CONFIGURE
from app.modules.features.schemas import FeaturesOut, FlagOut, GateIn, SwitchIn

router = APIRouter(prefix="/v1/features", tags=["features"])

Db = Annotated[Session, Depends(get_db)]
CanConfigure = Annotated[Staff, Depends(require_permission(CONFIGURE))]

REFUSED = {404: {"description": "not_found"}, 409: {"description": "gate_must_be:<gate> or gate_not_recorded"}}


@router.get("")
def read_enabled_features(request: Request, db: Db) -> FeaturesOut:
    """The v1.1 modules that are on, so the apps show only those (FR-ARCH-011). Public."""
    return FeaturesOut(enabled=service.enabled_keys(db, request.app.state.settings.feature_flags_enforced))


@router.get("/registry")
def read_registry(staff: CanConfigure, db: Db) -> list[FlagOut]:
    """Every v1.1 module, the gate it needs, and what is recorded (D34). Needs system.configure."""
    return [FlagOut.build(view) for view in service.registry(db)]


def _handled(call):  # type: ignore[no-untyped-def]
    try:
        return FlagOut.build(call())
    except service.UnknownFeature:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.FlagRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None


@router.post("/{key}/gate", responses=REFUSED)
def record_gate(key: str, body: GateIn, staff: CanConfigure, request: Request, db: Db) -> FlagOut:
    """Record the phase gate the module belongs to and the approval behind it."""
    return _handled(
        lambda: service.record_gate(db, staff, key, body.gate, body.approval_ref, body.reason, client_ip(request))
    )


@router.post("/{key}/enable", responses=REFUSED)
def enable(key: str, body: SwitchIn, staff: CanConfigure, request: Request, db: Db) -> FlagOut:
    """Only after the gate is recorded."""
    return _handled(lambda: service.set_enabled(db, staff, key, True, body.reason, client_ip(request)))


@router.post("/{key}/disable", responses=REFUSED)
def disable(key: str, body: SwitchIn, staff: CanConfigure, request: Request, db: Db) -> FlagOut:
    """At any time; members lose the module on their next request."""
    return _handled(lambda: service.set_enabled(db, staff, key, False, body.reason, client_ip(request)))
