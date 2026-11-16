"""P2 staff and governance workflows with fail-closed policy gates."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.rotating_codes import CodeExpired, CodeInvalid
from app.modules.audit import service as audit
from app.modules.access import rules as access_rules
from app.modules.access import service as access
from app.modules.access.rules import AreaPath, PLATFORM
from app.modules.access.service import Staff
from app.modules.events import repository as events_repository
from app.modules.events import rules as event_rules
from app.modules.events.repository import StoredEvent
from app.modules.policy_decisions import repository as decision_repository
from app.modules.privacy.governance_rules import check_policy_action

from . import repository, rules


class OperationalRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _event_path(event: StoredEvent) -> AreaPath:
    return tuple(access_rules.area_from_key(key) for key in event.area_path)


def _event(db: Session, event_id: uuid.UUID) -> StoredEvent:
    event = events_repository.find_event(db, event_id)
    if event is None:
        raise OperationalRefused("event_not_found")
    return event


def _require_over(db: Session, staff: Staff, permission: str, event: StoredEvent, ip: str) -> None:
    path = _event_path(event)
    if not access.has_permission_over(staff, permission, path):
        access.refuse(db, staff, permission, "outside_your_area", ip, target=("event", str(event.id)), area_path=path)


def record_control(
    db: Session, staff: Staff, *, control_key: str, integer_value: int,
    decision_revision_id: uuid.UUID, reason: str, confirmed: bool, ip: str,
) -> repository.Control:
    problem = rules.control_problem(control_key, integer_value)
    if problem:
        raise OperationalRefused(problem)
    if not confirmed:
        raise OperationalRefused("confirmation_required")
    decision_key = rules.CONTROL_DECISIONS[control_key]
    if repository.approved_revision(db, decision_revision_id, decision_key) is None:
        raise OperationalRefused("approved_decision_required")
    try:
        control = repository.insert_control(
            db, control_key=control_key, integer_value=integer_value,
            decision_revision_id=decision_revision_id, reason=reason, recorded_by=staff.member_id,
        )
    except IntegrityError as error:
        db.rollback()
        raise OperationalRefused("control_already_recorded_for_revision") from error
    audit.record(
        db, actor_id=staff.member_id, action="governance.operational_control.recorded",
        target_type="operational_control", target_id=str(control.id), area_path=(PLATFORM,),
        details={"controlKey": control_key, "decisionKey": decision_key, "value": integer_value}, ip=ip,
    )
    db.commit()
    return control


def readiness(db: Session) -> tuple[list[dict[str, object]], int, int]:
    items: list[dict[str, object]] = []
    for key, decision_key in rules.CONTROL_DECISIONS.items():
        control = repository.current_control(db, key)
        items.append({
            "key": key,
            "ready": control is not None,
            "decision_key": decision_key,
            "value": control.integer_value if control else None,
            "reason": "Approved control recorded" if control else f"Record a machine value from approved {decision_key}",
        })
    policies = repository.policy_versions(db)
    locales_by_version: dict[tuple[str, str], set[str]] = {}
    for policy in policies:
        locales_by_version.setdefault((policy.policy_key, policy.version), set()).add(policy.locale)
    bilingual_versions = [key for key, locales in locales_by_version.items() if {"en", "ta"} <= locales]
    items.append({
        "key": "versioned_policy_publication",
        "ready": bool(bilingual_versions),
        "decision_key": None,
        "value": None,
        "reason": "An immutable policy version is published in English and Tamil" if bilingual_versions
        else "Publish the same approved policy version in English and Tamil",
    })
    assignments = repository.tier5_assignments(db)
    active_ids = {item["assignment_id"] for item in assignments if item["state"] == "active"}
    today = datetime.now(ZoneInfo("Asia/Colombo")).date()
    certified_ids = {
        item.assignment_id for item in repository.certifications(db)
        if item.decision == "certified" and item.period_start <= today <= item.period_end
    }
    return items, len(active_ids), len(active_ids & certified_ids)


def create_assignment(db: Session, staff: Staff, fields: dict[str, object], ip: str) -> repository.VolunteerAssignment:
    event = _event(db, fields["event_id"])  # type: ignore[arg-type]
    _require_over(db, staff, "volunteers.manage", event, ip)
    if event.state == "cancelled":
        raise OperationalRefused("event_cancelled")
    shift_start = fields["shift_start"]
    shift_end = fields["shift_end"]
    if not isinstance(shift_start, datetime) or not isinstance(shift_end, datetime):
        raise OperationalRefused("invalid_shift")
    if shift_end <= shift_start or shift_start < event.starts_at or shift_end > event.ends_at:
        raise OperationalRefused("shift_outside_event")
    member_code = fields.pop("member_code")
    if not isinstance(member_code, str):
        raise OperationalRefused("invalid_assignment")
    member_id = repository.member_id_by_code(db, member_code)
    consent_version = fields["consent_version"]
    if member_id is None or not isinstance(consent_version, str):
        raise OperationalRefused("invalid_assignment")
    if not repository.member_can_volunteer(db, member_id, consent_version):
        raise OperationalRefused("active_membership_and_consent_required")
    try:
        item = repository.insert_assignment(
            db, **fields, member_id=member_id, area_key=event.area_key, assigned_by=staff.member_id,
        )
        repository.insert_assignment_event(db, item.id, staff.member_id)
    except IntegrityError as error:
        db.rollback()
        raise OperationalRefused("assignment_already_exists") from error
    audit.record(
        db, actor_id=staff.member_id, action="staff_ops.volunteer_assignment.offered",
        target_type="volunteer_assignment", target_id=str(item.id), area_path=_event_path(event),
        details={"memberId": str(member_id), "eventId": str(event.id), "dutyType": item.duty_type}, ip=ip,
    )
    db.commit()
    return item


def assignment_events(db: Session, staff: Staff) -> list[StoredEvent]:
    visible = access.visible_areas(staff, "volunteers.manage")
    return events_repository.managed_events(
        db, visible_areas=visible, states=["draft", "published"], limit=200,
    )


def list_assignments(db: Session, staff: Staff, event_id: uuid.UUID | None, ip: str) -> list[repository.VolunteerAssignment]:
    items = repository.assignments(db, event_id=event_id)
    visible: list[repository.VolunteerAssignment] = []
    for item in items:
        event = _event(db, item.event_id)
        if access.has_permission_over(staff, "volunteers.manage", _event_path(event)):
            visible.append(item)
    return visible


def my_assignments(db: Session, member_id: uuid.UUID) -> list[repository.VolunteerAssignment]:
    return repository.assignments(db, member_id=member_id)


def transition_assignment(
    db: Session, staff: Staff | None, member_id: uuid.UUID, assignment_id: uuid.UUID,
    target: str, reason: str, ip: str,
) -> repository.VolunteerAssignment:
    item = repository.assignment_by_id(db, assignment_id, lock=True)
    if item is None:
        raise OperationalRefused("assignment_not_found")
    if target in ("accepted", "declined"):
        if item.member_id != member_id:
            raise OperationalRefused("not_assignee")
        if target == "accepted" and not repository.member_can_volunteer(db, member_id, item.consent_version):
            raise OperationalRefused("active_membership_and_consent_required")
    else:
        if staff is None:
            raise OperationalRefused("forbidden")
        event = _event(db, item.event_id)
        _require_over(db, staff, "volunteers.manage", event, ip)
    problem = rules.transition_problem(item.state, target)
    if problem:
        raise OperationalRefused(problem)
    updated = repository.transition_assignment(db, assignment_id, target, member_id, reason)
    event = _event(db, item.event_id)
    audit.record(
        db, actor_id=member_id, action=f"staff_ops.volunteer_assignment.{target}",
        target_type="volunteer_assignment", target_id=str(item.id), area_path=_event_path(event),
        details={"memberId": str(item.member_id), "eventId": str(item.event_id)}, ip=ip,
    )
    db.commit()
    return updated


def register_device(db: Session, staff: Staff, label: str, ip: str) -> tuple[repository.Device, str]:
    if repository.active_device_count(db, staff.member_id) >= 5:
        raise OperationalRefused("active_device_limit_reached")
    token = secrets.token_urlsafe(48)
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    device = repository.insert_device(db, staff.member_id, key_hash, label)
    audit.record(
        db, actor_id=staff.member_id, action="staff_ops.device.registered", target_type="staff_device",
        target_id=str(device.id), area_path=None, details={"label": label}, ip=ip,
    )
    db.commit()
    return device, token


def list_devices(db: Session, staff: Staff) -> list[repository.Device]:
    return repository.devices_for_staff(db, staff.member_id)


def revoke_device(db: Session, staff: Staff, device_id: uuid.UUID, ip: str) -> None:
    device = repository.device_by_id(db, device_id, lock=True)
    if device is None or device.staff_member_id != staff.member_id:
        raise OperationalRefused("device_not_found")
    if device.revoked_at is None:
        repository.revoke_device(db, device_id, staff.member_id)
        audit.record(
            db, actor_id=staff.member_id, action="staff_ops.device.revoked", target_type="staff_device",
            target_id=str(device_id), area_path=None, details={}, ip=ip,
        )
        db.commit()


def _validate_offline_pass(
    db: Session, staff: Staff, event: StoredEvent, code: str, client_at: datetime, jwt_secret: str,
) -> tuple[str, uuid.UUID | None, str | None]:
    try:
        ref = event_rules.PASS.read(code, jwt_secret, int(client_at.timestamp()))
    except CodeExpired:
        return "REJECTED", None, "pass_expired_at_scan"
    except CodeInvalid:
        return "REJECTED", None, "pass_not_valid"
    found = events_repository.rsvp_by_pass_ref(db, ref)
    if found is None:
        return "REJECTED", None, "pass_not_current"
    pass_event_id, member_id = found
    if pass_event_id != event.id:
        return "REJECTED", None, "wrong_event"
    if member_id == staff.member_id:
        return "REJECTED", None, "own_pass"
    if event.state != "published" or not event.checkin_opens_at <= client_at <= event.checkin_closes_at:
        return "REJECTED", None, "outside_checkin_window"
    if events_repository.attended_at(db, event.id, member_id) is not None:
        return "DUPLICATE", member_id, "already_checked_in"
    if events_repository.record_attendance(db, event.id, member_id, staff.member_id):
        return "ACCEPTED", member_id, None
    return "DUPLICATE", member_id, "already_checked_in"


def sync_offline(
    db: Session, staff: Staff, *, device_id: uuid.UUID, device_token: str,
    scans: list[dict[str, object]], jwt_secret: str, ip: str,
) -> list[dict[str, object]]:
    control = repository.current_control(db, "offline_attendance_replay_hours")
    if control is None:
        raise OperationalRefused("offline_attendance_not_approved")
    device = repository.device_by_id(db, device_id, lock=True)
    supplied_hash = hashlib.sha256(device_token.encode()).hexdigest()
    if (
        device is None or device.staff_member_id != staff.member_id or device.revoked_at is not None
        or not secrets.compare_digest(device.device_key_hash, supplied_hash)
    ):
        raise OperationalRefused("device_not_registered")
    received_at = datetime.now(UTC)
    scan_ids = [scan["id"] for scan in scans]
    idempotency_keys = [scan["idempotency_key"] for scan in scans]
    if len(set(scan_ids)) != len(scan_ids) or len(set(idempotency_keys)) != len(idempotency_keys):
        raise OperationalRefused("duplicate_scan_identifier")
    results: list[dict[str, object]] = []
    for scan in scans:
        idempotency_key = scan["idempotency_key"]
        assert isinstance(idempotency_key, uuid.UUID)
        existing = repository.scan_by_idempotency(db, idempotency_key)
        if existing:
            if existing["device_id"] != device_id or existing["scanner_staff_id"] != staff.member_id:
                raise OperationalRefused("idempotency_key_conflict")
            results.append(existing)
            continue
        event = _event(db, scan["event_id"])  # type: ignore[arg-type]
        _require_over(db, staff, "events.checkin_scan", event, ip)
        client_at = scan["client_scan_at"]
        assert isinstance(client_at, datetime)
        problem = rules.queued_scan_problem(client_at, received_at, control.integer_value)
        if problem == "replay_window_expired":
            status, member_id, reason = "EXPIRED_QUEUE", None, problem
        elif problem:
            status, member_id, reason = "NEEDS_REVIEW", None, problem
        else:
            status, member_id, reason = _validate_offline_pass(
                db, staff, event, str(scan["pass_code"]), client_at, jwt_secret,
            )
        stored = repository.insert_scan(
            db, id=scan["id"], idempotency_key=idempotency_key, event_id=event.id,
            device_id=device_id, scanner_staff_id=staff.member_id, pass_code=scan["pass_code"],
            client_scan_at=client_at, local_outcome=scan["local_outcome"], status=status,
            attendance_member_id=member_id, reason=reason,
        )
        results.append(stored)
    repository.touch_device(db, device_id)
    audit.record(
        db, actor_id=staff.member_id, action="staff_ops.offline_scan.synced", target_type="staff_device",
        target_id=str(device_id), area_path=None,
        details={"received": len(scans), "accepted": sum(1 for item in results if item["status"] == "ACCEPTED")}, ip=ip,
    )
    db.commit()
    return results


def publish_policy(db: Session, staff: Staff, fields: dict[str, object], ip: str) -> repository.PolicyVersion:
    now = datetime.now(UTC)
    approved_at = fields["approved_at"]
    effective_from = fields["effective_from"]
    if not isinstance(approved_at, datetime) or not isinstance(effective_from, datetime):
        raise OperationalRefused("invalid_policy_dates")
    if approved_at > now or effective_from < approved_at:
        raise OperationalRefused("invalid_policy_dates")
    if not fields.pop("confirm_immutable_publication", False):
        raise OperationalRefused("confirmation_required")
    if fields["policy_type"] == "election_rule" and "GOV-02" not in decision_repository.approved_keys(db, ("GOV-02",)):
        raise OperationalRefused("approved_governance_decision_required")
    content = str(fields["content_text"])
    fields["content_sha256"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
    try:
        item = repository.insert_policy_version(db, **fields, approved_by=staff.member_id)
    except IntegrityError as error:
        db.rollback()
        raise OperationalRefused("policy_version_already_exists") from error
    audit.record(
        db, actor_id=staff.member_id, action="governance.policy_version.published",
        target_type="policy_version", target_id=str(item.id), area_path=(PLATFORM,),
        details={"policyKey": item.policy_key, "version": item.version, "locale": item.locale}, ip=ip,
    )
    db.commit()
    return item


def record_consent(
    db: Session, member_id: uuid.UUID, policy_version_id: uuid.UUID, action: str, legal_basis: str, ip: str,
) -> tuple[uuid.UUID, str, datetime]:
    policy = repository.effective_policy(db, policy_version_id)
    if policy is None:
        raise OperationalRefused("current_effective_policy_required")
    problem = check_policy_action(policy[0], action)  # type: ignore[arg-type]
    if problem:
        raise OperationalRefused(problem)
    result = repository.insert_consent_event(
        db, member_id=member_id, policy_version_id=policy_version_id, action=action, legal_basis=legal_basis,
    )
    audit.record(
        db, actor_id=member_id, action=f"governance.consent.{action}", target_type="policy_version",
        target_id=str(policy_version_id), area_path=None, details={"action": action}, ip=ip,
    )
    db.commit()
    return result


def record_certification(db: Session, staff: Staff, fields: dict[str, object], ip: str) -> repository.Tier5Certification:
    if not fields.pop("confirm_external_review", False):
        raise OperationalRefused("confirmation_required")
    assignments = {item["assignment_id"]: item for item in repository.tier5_assignments(db)}
    assignment = assignments.get(fields["assignment_id"])
    if assignment is None:
        raise OperationalRefused("tier5_assignment_required")
    today = datetime.now(ZoneInfo("Asia/Colombo")).date()
    if fields["certified_at"] > today or fields["period_end"] < fields["period_start"]:
        raise OperationalRefused("invalid_certification_dates")
    try:
        item = repository.insert_certification(db, **fields, recorded_by=staff.member_id)
    except IntegrityError as error:
        db.rollback()
        raise OperationalRefused("certification_period_already_recorded") from error
    audit.record(
        db, actor_id=staff.member_id, action="governance.tier5_access.certified",
        target_type="staff_assignment", target_id=str(item.assignment_id), area_path=(PLATFORM,),
        details={"decision": item.decision, "periodEnd": item.period_end.isoformat()}, ip=ip,
    )
    db.commit()
    return item


def volunteer_aggregate(db: Session, staff: Staff, event_id: uuid.UUID, ip: str) -> tuple[int, dict[str, int], set[str]]:
    control = repository.current_control(db, "aggregate_minimum_group_size")
    if control is None:
        raise OperationalRefused("aggregate_publication_not_approved")
    event = _event(db, event_id)
    _require_over(db, staff, "analytics.view", event, ip)
    counts = repository.volunteer_counts(db, event_id)
    hidden = rules.suppressed_cells(counts, control.integer_value)
    return control.integer_value, counts, hidden
