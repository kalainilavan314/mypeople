"""SQL persistence for P2 staff and governance operational closure."""

import json
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Control:
    id: uuid.UUID
    control_key: str
    integer_value: int
    decision_key: str
    decision_revision: int
    decision_revision_id: uuid.UUID
    reason: str
    recorded_by: uuid.UUID
    recorded_at: datetime


@dataclass(frozen=True)
class VolunteerAssignment:
    id: uuid.UUID
    member_id: uuid.UUID
    member_name: str
    member_code: str
    event_id: uuid.UUID
    event_ref: str
    event_title_en: str
    event_title_ta: str
    consent_version: str
    duty_type: str
    area_key: str
    shift_start: datetime
    shift_end: datetime
    state: str
    acknowledged_at: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class Device:
    id: uuid.UUID
    staff_member_id: uuid.UUID
    device_key_hash: str
    label: str
    registered_at: datetime
    last_seen_at: datetime | None
    revoked_at: datetime | None
    revoked_by: uuid.UUID | None


@dataclass(frozen=True)
class PolicyVersion:
    id: uuid.UUID
    policy_key: str
    policy_type: str
    version: str
    locale: str
    content_sha256: str
    approval_reference: str | None
    approved_at: datetime
    effective_from: datetime
    created_at: datetime


@dataclass(frozen=True)
class EffectivePolicy(PolicyVersion):
    content_text: str
    my_action: str | None
    my_action_at: datetime | None


@dataclass(frozen=True)
class Tier5Certification:
    id: uuid.UUID
    assignment_id: uuid.UUID
    member_id: uuid.UUID
    full_name: str
    member_code: str
    decision: str
    period_start: date
    period_end: date
    reviewer_name: str
    reviewer_title: str
    evidence_ref: str
    reason: str
    certified_at: date
    recorded_by: uuid.UUID
    recorded_at: datetime


def approved_revision(db: Session, revision_id: uuid.UUID, decision_key: str) -> tuple[int, str] | None:
    row = db.execute(
        text(
            "SELECT revision, decision_key FROM ops.policy_decision_revision r "
            "WHERE id = :id AND decision_key = :key AND status = 'approved' "
            "AND NOT EXISTS (SELECT 1 FROM ops.policy_decision_revision newer "
            "WHERE newer.decision_key = r.decision_key AND newer.revision > r.revision)"
        ),
        {"id": revision_id, "key": decision_key},
    ).one_or_none()
    return (row.revision, row.decision_key) if row else None


def insert_control(
    db: Session, *, control_key: str, integer_value: int, decision_revision_id: uuid.UUID,
    reason: str, recorded_by: uuid.UUID,
) -> Control:
    control_id = db.scalar(
        text(
            """
            INSERT INTO governance.operational_control_version
                (control_key, integer_value, decision_revision_id, reason, recorded_by)
            VALUES (:key, :value, :revision, :reason, :actor) RETURNING id
            """
        ),
        {"key": control_key, "value": integer_value, "revision": decision_revision_id,
         "reason": reason, "actor": recorded_by},
    )
    control = get_control_by_id(db, control_id)
    assert control is not None
    return control


def _control(row: Any) -> Control:
    return Control(**row)


_CONTROL_SELECT = """
    SELECT c.id, c.control_key, c.integer_value, r.decision_key, r.revision AS decision_revision,
           c.decision_revision_id, c.reason, c.recorded_by, c.recorded_at
      FROM governance.operational_control_version c
      JOIN ops.policy_decision_revision r ON r.id = c.decision_revision_id
"""


def get_control_by_id(db: Session, control_id: uuid.UUID) -> Control | None:
    row = db.execute(text(_CONTROL_SELECT + " WHERE c.id = :id"), {"id": control_id}).mappings().one_or_none()
    return _control(row) if row else None


def current_control(db: Session, control_key: str) -> Control | None:
    row = db.execute(
        text(
            _CONTROL_SELECT
            + " WHERE c.control_key = :key AND r.status = 'approved' "
              "AND NOT EXISTS (SELECT 1 FROM ops.policy_decision_revision newer "
              "WHERE newer.decision_key = r.decision_key AND newer.revision > r.revision) "
              "ORDER BY c.recorded_at DESC LIMIT 1"
        ),
        {"key": control_key},
    ).mappings().one_or_none()
    return _control(row) if row else None


_ASSIGNMENT_SELECT = """
    SELECT a.id, a.member_id, m.full_name AS member_name, m.member_code,
           a.event_id, e.event_ref, e.title_en AS event_title_en, e.title_ta AS event_title_ta,
           a.consent_version, a.duty_type, a.area_key, a.shift_start, a.shift_end,
           a.state, a.acknowledged_at, a.created_at, a.updated_at
      FROM staff_ops.volunteer_assignment a
      JOIN npm.member m ON m.id = a.member_id
      JOIN events.event e ON e.id = a.event_id
"""


def _assignment(row: Any) -> VolunteerAssignment:
    return VolunteerAssignment(**row)


def member_can_volunteer(db: Session, member_id: uuid.UUID, consent_version: str) -> bool:
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM membership.membership ms
                      JOIN governance.policy_version p
                        ON p.version = :version AND p.policy_type = 'optional_consent'
                       AND p.effective_from <= clock_timestamp()
                     WHERE ms.member_id = :member AND ms.state = 'active'
                       AND EXISTS (
                           SELECT 1 FROM governance.consent_event c
                            WHERE c.member_id = :member AND c.policy_version_id = p.id
                              AND c.action = 'granted'
                              AND NOT EXISTS (
                                  SELECT 1 FROM governance.consent_event later
                                   WHERE later.member_id = c.member_id
                                     AND later.policy_version_id = c.policy_version_id
                                     AND later.id > c.id AND later.action = 'withdrawn'
                              )
                       )
                       AND NOT EXISTS (
                           SELECT 1 FROM governance.policy_version newer
                            WHERE newer.policy_key = p.policy_key AND newer.locale = p.locale
                              AND newer.effective_from <= clock_timestamp()
                              AND (newer.effective_from, newer.created_at) > (p.effective_from, p.created_at)
                       )
                )
                """
            ),
            {"member": member_id, "version": consent_version},
        )
    )


def member_id_by_code(db: Session, member_code: str) -> uuid.UUID | None:
    return db.scalar(
        text(
            "SELECT id FROM npm.member WHERE upper(member_code) = upper(:code) AND deleted_at IS NULL LIMIT 1"
        ), {"code": member_code.strip()},
    )


def insert_assignment(db: Session, **fields: Any) -> VolunteerAssignment:
    assignment_id = db.scalar(
        text(
            """
            INSERT INTO staff_ops.volunteer_assignment
                (member_id, event_id, consent_version, duty_type, area_key, assigned_by, shift_start, shift_end)
            VALUES (:member_id, :event_id, :consent_version, :duty_type, :area_key,
                    :assigned_by, :shift_start, :shift_end)
            RETURNING id
            """
        ), fields,
    )
    item = assignment_by_id(db, assignment_id)
    assert item is not None
    return item


def assignment_by_id(db: Session, assignment_id: uuid.UUID, *, lock: bool = False) -> VolunteerAssignment | None:
    if lock:
        db.execute(text("SELECT 1 FROM staff_ops.volunteer_assignment WHERE id = :id FOR UPDATE"), {"id": assignment_id})
    row = db.execute(text(_ASSIGNMENT_SELECT + " WHERE a.id = :id"), {"id": assignment_id}).mappings().one_or_none()
    return _assignment(row) if row else None


def assignments(db: Session, *, member_id: uuid.UUID | None = None, event_id: uuid.UUID | None = None) -> list[VolunteerAssignment]:
    clauses: list[str] = []
    params: dict[str, Any] = {}
    if member_id:
        clauses.append("a.member_id = :member")
        params["member"] = member_id
    if event_id:
        clauses.append("a.event_id = :event")
        params["event"] = event_id
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    rows = db.execute(text(_ASSIGNMENT_SELECT + where + " ORDER BY a.shift_start, a.created_at"), params).mappings()
    return [_assignment(row) for row in rows]


def transition_assignment(db: Session, assignment_id: uuid.UUID, state: str, actor_id: uuid.UUID, reason: str) -> VolunteerAssignment:
    old = assignment_by_id(db, assignment_id, lock=True)
    assert old is not None
    acknowledged = state in ("accepted", "declined")
    db.execute(
        text(
            """
            UPDATE staff_ops.volunteer_assignment
               SET state = :state,
                   acknowledged_at = CASE WHEN :acknowledged THEN clock_timestamp() ELSE acknowledged_at END,
                   updated_at = clock_timestamp()
             WHERE id = :id
            """
        ),
        {"id": assignment_id, "state": state, "acknowledged": acknowledged},
    )
    db.execute(
        text(
            """
            INSERT INTO staff_ops.volunteer_assignment_event
                (assignment_id, from_state, to_state, actor_id, reason)
            VALUES (:id, :from_state, :to_state, :actor, :reason)
            """
        ),
        {"id": assignment_id, "from_state": old.state, "to_state": state, "actor": actor_id, "reason": reason},
    )
    updated = assignment_by_id(db, assignment_id)
    assert updated is not None
    return updated


def insert_assignment_event(db: Session, assignment_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    db.execute(
        text(
            "INSERT INTO staff_ops.volunteer_assignment_event "
            "(assignment_id, from_state, to_state, actor_id, reason) "
            "VALUES (:id, NULL, 'offered', :actor, 'Assignment offered')"
        ),
        {"id": assignment_id, "actor": actor_id},
    )


def insert_device(db: Session, staff_member_id: uuid.UUID, key_hash: str, label: str) -> Device:
    device_id = db.scalar(
        text(
            "INSERT INTO staff_ops.registered_device (staff_member_id, device_key_hash, label) "
            "VALUES (:member, :hash, :label) RETURNING id"
        ),
        {"member": staff_member_id, "hash": key_hash, "label": label},
    )
    device = device_by_id(db, device_id)
    assert device is not None
    return device


def _device(row: Any) -> Device:
    return Device(**row)


def device_by_id(db: Session, device_id: uuid.UUID, *, lock: bool = False) -> Device | None:
    suffix = " FOR UPDATE" if lock else ""
    row = db.execute(
        text(
            "SELECT id, staff_member_id, device_key_hash, label, registered_at, last_seen_at, revoked_at, revoked_by "
            "FROM staff_ops.registered_device WHERE id = :id" + suffix
        ), {"id": device_id},
    ).mappings().one_or_none()
    return _device(row) if row else None


def devices_for_staff(db: Session, staff_member_id: uuid.UUID) -> list[Device]:
    rows = db.execute(
        text(
            "SELECT id, staff_member_id, device_key_hash, label, registered_at, last_seen_at, revoked_at, revoked_by "
            "FROM staff_ops.registered_device WHERE staff_member_id = :member ORDER BY registered_at DESC"
        ), {"member": staff_member_id},
    ).mappings()
    return [_device(row) for row in rows]


def active_device_count(db: Session, staff_member_id: uuid.UUID) -> int:
    return int(db.scalar(
        text("SELECT count(*) FROM staff_ops.registered_device WHERE staff_member_id = :member AND revoked_at IS NULL"),
        {"member": staff_member_id},
    ) or 0)


def touch_device(db: Session, device_id: uuid.UUID) -> None:
    db.execute(text("UPDATE staff_ops.registered_device SET last_seen_at = clock_timestamp() WHERE id = :id"), {"id": device_id})


def revoke_device(db: Session, device_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    db.execute(
        text(
            "UPDATE staff_ops.registered_device SET revoked_at = clock_timestamp(), revoked_by = :actor "
            "WHERE id = :id AND revoked_at IS NULL"
        ), {"id": device_id, "actor": actor_id},
    )


def scan_by_idempotency(db: Session, key: uuid.UUID) -> dict[str, Any] | None:
    row = db.execute(
        text(
            "SELECT id, idempotency_key, device_id, scanner_staff_id, status, reason "
            "FROM staff_ops.scan_event WHERE idempotency_key = :key"
        ),
        {"key": key},
    ).mappings().one_or_none()
    return dict(row) if row else None


def insert_scan(db: Session, **fields: Any) -> dict[str, Any]:
    row = db.execute(
        text(
            """
            INSERT INTO staff_ops.scan_event
                (id, idempotency_key, event_id, device_id, scanner_staff_id, pass_code,
                 client_scan_at, local_outcome, status, attendance_member_id, reason)
            VALUES (:id, :idempotency_key, :event_id, :device_id, :scanner_staff_id, :pass_code,
                    :client_scan_at, :local_outcome, :status, :attendance_member_id, :reason)
            RETURNING id, idempotency_key, status, reason
            """
        ), fields,
    ).mappings().one()
    return dict(row)


def insert_policy_version(db: Session, **fields: Any) -> PolicyVersion:
    policy_id = db.scalar(
        text(
            """
            INSERT INTO governance.policy_version
                (policy_key, policy_type, version, locale, content_sha256, content_text,
                 approval_reference, approved_by, approved_at, effective_from)
            VALUES (:policy_key, :policy_type, :version, :locale, :content_sha256, :content_text,
                    :approval_reference, :approved_by, :approved_at, :effective_from)
            RETURNING id
            """
        ), fields,
    )
    item = policy_by_id(db, policy_id)
    assert item is not None
    return item


def policy_by_id(db: Session, policy_id: uuid.UUID) -> PolicyVersion | None:
    row = db.execute(
        text(
            "SELECT id, policy_key, policy_type, version, locale, content_sha256, approval_reference, "
            "approved_at, effective_from, created_at FROM governance.policy_version WHERE id = :id"
        ), {"id": policy_id},
    ).mappings().one_or_none()
    return PolicyVersion(**row) if row else None


def policy_versions(db: Session) -> list[PolicyVersion]:
    rows = db.execute(
        text(
            "SELECT id, policy_key, policy_type, version, locale, content_sha256, approval_reference, "
            "approved_at, effective_from, created_at FROM governance.policy_version "
            "ORDER BY policy_key, effective_from DESC, locale"
        )
    ).mappings()
    return [PolicyVersion(**row) for row in rows]


def effective_policies(db: Session, member_id: uuid.UUID, locale: str) -> list[EffectivePolicy]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (p.policy_key)
                   p.id, p.policy_key, p.policy_type, p.version, p.locale, p.content_sha256,
                   p.approval_reference, p.approved_at, p.effective_from, p.created_at, p.content_text,
                   latest.action AS my_action, latest.occurred_at AS my_action_at
              FROM governance.policy_version p
              LEFT JOIN LATERAL (
                  SELECT c.action, c.occurred_at FROM governance.consent_event c
                   WHERE c.member_id = :member AND c.policy_version_id = p.id
                   ORDER BY c.id DESC LIMIT 1
              ) latest ON true
             WHERE p.locale = :locale AND p.effective_from <= clock_timestamp()
             ORDER BY p.policy_key, p.effective_from DESC, p.created_at DESC
            """
        ), {"member": member_id, "locale": locale},
    ).mappings()
    return [EffectivePolicy(**row) for row in rows]


def member_locale(db: Session, member_id: uuid.UUID) -> str:
    locale = db.scalar(text("SELECT language FROM npm.member WHERE id = :id"), {"id": member_id})
    return locale if locale in ("en", "ta") else "en"


def effective_policy(db: Session, policy_id: uuid.UUID) -> tuple[str, datetime] | None:
    row = db.execute(
        text(
            """
            SELECT p.policy_type, p.effective_from
              FROM governance.policy_version p
             WHERE p.id = :id AND p.effective_from <= clock_timestamp()
               AND NOT EXISTS (
                   SELECT 1 FROM governance.policy_version newer
                    WHERE newer.policy_key = p.policy_key AND newer.locale = p.locale
                      AND newer.effective_from <= clock_timestamp()
                      AND (newer.effective_from, newer.created_at) > (p.effective_from, p.created_at)
               )
            """
        ), {"id": policy_id},
    ).one_or_none()
    return (row.policy_type, row.effective_from) if row else None


def insert_consent_event(
    db: Session, *, member_id: uuid.UUID, policy_version_id: uuid.UUID, action: str, legal_basis: str,
) -> tuple[uuid.UUID, str, datetime]:
    row = db.execute(
        text(
            """
            INSERT INTO governance.consent_event
                (member_id, policy_version_id, action, legal_basis, channel, actor_id)
            VALUES (:member, :policy, :action, :basis, 'member_mobile', :member)
            RETURNING policy_version_id, action, occurred_at
            """
        ), {"member": member_id, "policy": policy_version_id, "action": action, "basis": legal_basis},
    ).one()
    return row.policy_version_id, row.action, row.occurred_at


def tier5_assignments(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT a.id AS assignment_id, a.member_id, m.full_name, m.member_code, a.state,
                   a.granted_at, a.ended_at
              FROM access.staff_assignment a JOIN npm.member m ON m.id = a.member_id
             WHERE a.tier = '5' ORDER BY a.granted_at
            """
        )
    ).mappings()
    return [dict(row) for row in rows]


def insert_certification(db: Session, **fields: Any) -> Tier5Certification:
    certification_id = db.scalar(
        text(
            """
            INSERT INTO governance.tier5_access_certification
                (assignment_id, decision, period_start, period_end, reviewer_name, reviewer_title,
                 evidence_ref, reason, certified_at, recorded_by)
            VALUES (:assignment_id, :decision, :period_start, :period_end, :reviewer_name, :reviewer_title,
                    :evidence_ref, :reason, :certified_at, :recorded_by)
            RETURNING id
            """
        ), fields,
    )
    item = certification_by_id(db, certification_id)
    assert item is not None
    return item


_CERT_SELECT = """
    SELECT c.id, c.assignment_id, a.member_id, m.full_name, m.member_code, c.decision,
           c.period_start, c.period_end, c.reviewer_name, c.reviewer_title, c.evidence_ref,
           c.reason, c.certified_at, c.recorded_by, c.recorded_at
      FROM governance.tier5_access_certification c
      JOIN access.staff_assignment a ON a.id = c.assignment_id
      JOIN npm.member m ON m.id = a.member_id
"""


def certification_by_id(db: Session, certification_id: uuid.UUID) -> Tier5Certification | None:
    row = db.execute(text(_CERT_SELECT + " WHERE c.id = :id"), {"id": certification_id}).mappings().one_or_none()
    return Tier5Certification(**row) if row else None


def certifications(db: Session) -> list[Tier5Certification]:
    rows = db.execute(text(_CERT_SELECT + " ORDER BY c.period_end DESC, c.recorded_at DESC")).mappings()
    return [Tier5Certification(**row) for row in rows]


def volunteer_counts(db: Session, event_id: uuid.UUID) -> dict[str, int]:
    rows = db.execute(
        text(
            "SELECT duty_type, count(*)::int AS count FROM staff_ops.volunteer_assignment "
            "WHERE event_id = :event AND state IN ('accepted', 'completed') GROUP BY duty_type"
        ), {"event": event_id},
    )
    from .rules import DUTY_TYPES

    counted = {row.duty_type: row.count for row in rows}
    return {duty: counted.get(duty, 0) for duty in DUTY_TYPES}
