import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff, load_staff
from app.modules.auth.dependencies import CurrentMember

from . import repository, service
from .schemas import (
    AggregateCellOut,
    AssignmentEventOut,
    AssignmentTransitionIn,
    ControlIn,
    ControlOut,
    DeviceRegisterIn,
    DeviceRegisteredOut,
    EffectivePolicyOut,
    ConsentActionIn,
    ConsentActionOut,
    OfflineScanOut,
    OfflineSyncIn,
    OfflineSyncOut,
    OperationalReadinessOut,
    PolicyPublishIn,
    PolicyVersionOut,
    ReadinessItem,
    RegisteredDeviceOut,
    Tier5AssignmentOut,
    Tier5CertificationIn,
    Tier5CertificationOut,
    VolunteerAggregateOut,
    VolunteerAssignmentIn,
    VolunteerAssignmentOut,
)

router = APIRouter(prefix="/v1/operations", tags=["operations-governance"])
Db = Annotated[Session, Depends(get_db)]
CanConfigure = Annotated[Staff, Depends(require_permission("system.configure"))]
CanVolunteer = Annotated[Staff, Depends(require_permission("volunteers.manage"))]
CanScan = Annotated[Staff, Depends(require_permission("events.checkin_scan"))]
CanAnalyse = Annotated[Staff, Depends(require_permission("analytics.view"))]


def _out(model, item):  # type: ignore[no-untyped-def]
    return model.model_validate(item.__dict__ if hasattr(item, "__dict__") else item)


def _call(call):  # type: ignore[no-untyped-def]
    try:
        return call()
    except service.OperationalRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None


@router.get("/readiness")
def operational_readiness(staff: CanConfigure, db: Db) -> OperationalReadinessOut:
    items, tier5_assignments, tier5_certified = service.readiness(db)
    return OperationalReadinessOut(
        items=[ReadinessItem.model_validate(item) for item in items],
        tier5_assignments=tier5_assignments,
        tier5_certified=tier5_certified,
    )


@router.post("/controls", status_code=status.HTTP_201_CREATED)
def record_control(body: ControlIn, staff: CanConfigure, request: Request, db: Db) -> ControlOut:
    item = _call(lambda: service.record_control(
        db, staff, control_key=body.control_key, integer_value=body.integer_value,
        decision_revision_id=body.decision_revision_id, reason=body.reason,
        confirmed=body.confirm_approved_basis, ip=client_ip(request),
    ))
    return _out(ControlOut, item)


@router.get("/volunteer-assignments")
def list_volunteer_assignments(
    staff: CanVolunteer, request: Request, db: Db, event_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[VolunteerAssignmentOut]:
    return [_out(VolunteerAssignmentOut, item) for item in service.list_assignments(db, staff, event_id, client_ip(request))]


@router.get("/volunteer-assignment-events")
def list_volunteer_assignment_events(staff: CanVolunteer, db: Db) -> list[AssignmentEventOut]:
    return [AssignmentEventOut(
        id=item.id, event_ref=item.event_ref, title_en=item.title_en, title_ta=item.title_ta,
        starts_at=item.starts_at, ends_at=item.ends_at, area_key=item.area_key, state=item.state,
    ) for item in service.assignment_events(db, staff)]


@router.post("/volunteer-assignments", status_code=status.HTTP_201_CREATED)
def create_volunteer_assignment(
    body: VolunteerAssignmentIn, staff: CanVolunteer, request: Request, db: Db,
) -> VolunteerAssignmentOut:
    item = _call(lambda: service.create_assignment(db, staff, body.model_dump(), client_ip(request)))
    return _out(VolunteerAssignmentOut, item)


@router.get("/me/volunteer-assignments")
def my_volunteer_assignments(member: CurrentMember, db: Db) -> list[VolunteerAssignmentOut]:
    return [_out(VolunteerAssignmentOut, item) for item in service.my_assignments(db, member.id)]


@router.post("/me/volunteer-assignments/{assignment_id}/response")
def respond_to_assignment(
    assignment_id: uuid.UUID, body: AssignmentTransitionIn, member: CurrentMember, request: Request, db: Db,
) -> VolunteerAssignmentOut:
    if body.state not in ("accepted", "declined"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="member_response_required")
    item = _call(lambda: service.transition_assignment(
        db, None, member.id, assignment_id, body.state, body.reason, client_ip(request),
    ))
    return _out(VolunteerAssignmentOut, item)


@router.post("/volunteer-assignments/{assignment_id}/transition")
def transition_volunteer_assignment(
    assignment_id: uuid.UUID, body: AssignmentTransitionIn, staff: CanVolunteer, request: Request, db: Db,
) -> VolunteerAssignmentOut:
    if body.state not in ("cancelled", "completed"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="staff_transition_required")
    item = _call(lambda: service.transition_assignment(
        db, staff, staff.member_id, assignment_id, body.state, body.reason, client_ip(request),
    ))
    return _out(VolunteerAssignmentOut, item)


@router.get("/devices")
def list_registered_devices(staff: CanScan, db: Db) -> list[RegisteredDeviceOut]:
    return [_out(RegisteredDeviceOut, item) for item in service.list_devices(db, staff)]


@router.post("/devices", status_code=status.HTTP_201_CREATED)
def register_device(body: DeviceRegisterIn, staff: CanScan, request: Request, db: Db) -> DeviceRegisteredOut:
    device, token = service.register_device(db, staff, body.label, client_ip(request))
    return DeviceRegisteredOut(id=device.id, label=device.label, device_token=token, registered_at=device.registered_at)


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_device(device_id: uuid.UUID, staff: CanScan, request: Request, db: Db) -> None:
    _call(lambda: service.revoke_device(db, staff, device_id, client_ip(request)))


@router.post("/offline-scans/sync")
def sync_offline_scans(body: OfflineSyncIn, staff: CanScan, request: Request, db: Db) -> OfflineSyncOut:
    items = _call(lambda: service.sync_offline(
        db, staff, device_id=body.device_id, device_token=body.device_token,
        scans=[item.model_dump() for item in body.scans],
        jwt_secret=request.app.state.settings.jwt_secret.get_secret_value(), ip=client_ip(request),
    ))
    return OfflineSyncOut(results=[OfflineScanOut.model_validate(item) for item in items])


@router.get("/policies")
def list_policy_versions(staff: CanConfigure, db: Db) -> list[PolicyVersionOut]:
    return [_out(PolicyVersionOut, item) for item in repository.policy_versions(db)]


@router.post("/policies", status_code=status.HTTP_201_CREATED)
def publish_policy(body: PolicyPublishIn, staff: CanConfigure, request: Request, db: Db) -> PolicyVersionOut:
    item = _call(lambda: service.publish_policy(db, staff, body.model_dump(), client_ip(request)))
    return _out(PolicyVersionOut, item)


@router.get("/me/policies")
def current_member_policies(member: CurrentMember, db: Db) -> list[EffectivePolicyOut]:
    locale = repository.member_locale(db, member.id)
    return [_out(EffectivePolicyOut, item) for item in repository.effective_policies(db, member.id, locale)]


@router.post("/me/policies/{policy_version_id}/actions", status_code=status.HTTP_201_CREATED)
def record_member_policy_action(
    policy_version_id: uuid.UUID, body: ConsentActionIn, member: CurrentMember, request: Request, db: Db,
) -> ConsentActionOut:
    result = _call(lambda: service.record_consent(
        db, member.id, policy_version_id, body.action, body.legal_basis, client_ip(request),
    ))
    return ConsentActionOut(policy_version_id=result[0], action=result[1], occurred_at=result[2])


@router.get("/tier5-assignments")
def list_tier5_assignments(staff: CanConfigure, db: Db) -> list[Tier5AssignmentOut]:
    return [Tier5AssignmentOut.model_validate(item) for item in repository.tier5_assignments(db)]


@router.get("/tier5-certifications")
def list_tier5_certifications(staff: CanConfigure, db: Db) -> list[Tier5CertificationOut]:
    return [_out(Tier5CertificationOut, item) for item in repository.certifications(db)]


@router.post("/tier5-certifications", status_code=status.HTTP_201_CREATED)
def record_tier5_certification(
    body: Tier5CertificationIn, staff: CanConfigure, request: Request, db: Db,
) -> Tier5CertificationOut:
    item = _call(lambda: service.record_certification(db, staff, body.model_dump(), client_ip(request)))
    return _out(Tier5CertificationOut, item)


@router.get("/aggregates/volunteers/{event_id}")
def volunteer_aggregate(
    event_id: uuid.UUID, staff: CanAnalyse, request: Request, db: Db,
) -> VolunteerAggregateOut:
    minimum, counts, hidden = _call(lambda: service.volunteer_aggregate(db, staff, event_id, client_ip(request)))
    cells = [AggregateCellOut(key=key, count=None if key in hidden else count, suppressed=key in hidden)
             for key, count in sorted(counts.items())]
    total = sum(counts.values())
    return VolunteerAggregateOut(
        event_id=event_id, minimum_group_size=minimum,
        total=None if hidden else total, cells=cells,
    )
