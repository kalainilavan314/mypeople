"""SQL for membership.certificate and membership.certificate_check (Alembic revision 0051, ENT-53),
and the attendance and volunteering records certificates are made from (read only)."""

import json
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.membership.certificates.rules import CHECK_WINDOW

# Serialises certificate requests per member, so a double tap cannot make two.
_ISSUE_LOCK_SPACE = 30_051


@dataclass(frozen=True)
class Certificate:
    id: uuid.UUID
    certificate_ref: str
    member_id: uuid.UUID
    kind: str
    source_ref: str
    holder_name: str
    details: dict[str, Any]
    issued_on: date
    issued_by: uuid.UUID | None
    token_hash: str
    status: str
    status_reason: str | None
    status_changed_at: datetime | None
    superseded_by: uuid.UUID | None
    created_at: datetime


_SELECT = """
    SELECT c.id, c.certificate_ref, c.member_id, c.kind, c.source_ref, c.holder_name, c.details, c.issued_on,
           c.issued_by, c.token_hash, c.status, c.status_reason, c.status_changed_at, c.superseded_by, c.created_at
    FROM membership.certificate c
"""


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:member_id AS text)))"),
        {"space": _ISSUE_LOCK_SPACE, "member_id": member_id},
    )


def insert(
    db: Session,
    *,
    certificate_id: uuid.UUID,
    member_id: uuid.UUID,
    kind: str,
    source_ref: str,
    holder_name: str,
    details: dict[str, Any],
    issued_on: date,
    issued_by: uuid.UUID | None,
    token_hash: str,
) -> Certificate:
    db.execute(
        text(
            """
            INSERT INTO membership.certificate (id, member_id, kind, source_ref, holder_name, details, issued_on, issued_by,
                                                token_hash)
            VALUES (:id, :member_id, :kind, :source_ref, :holder_name, CAST(:details AS jsonb), :issued_on, :issued_by,
                    :token_hash)
            """
        ),
        {
            "id": certificate_id, "member_id": member_id, "kind": kind, "source_ref": source_ref,
            "holder_name": holder_name, "details": json.dumps(details), "issued_on": issued_on, "issued_by": issued_by,
            "token_hash": token_hash,
        },
    )
    found = find(db, certificate_id)
    assert found is not None
    return found


def find(db: Session, certificate_id: uuid.UUID, *, lock: bool = False) -> Certificate | None:
    row = db.execute(
        text(f"{_SELECT} WHERE c.id = :id{' FOR UPDATE' if lock else ''}"), {"id": certificate_id}
    ).mappings().one_or_none()
    return Certificate(**row) if row else None


def find_by_token_hash(db: Session, hashed: str) -> Certificate | None:
    row = db.execute(text(f"{_SELECT} WHERE c.token_hash = :hash"), {"hash": hashed}).mappings().one_or_none()
    return Certificate(**row) if row else None


def find_valid(db: Session, member_id: uuid.UUID, kind: str, source_ref: str) -> Certificate | None:
    row = db.execute(
        text(f"{_SELECT} WHERE c.member_id = :member AND c.kind = :kind AND c.source_ref = :source AND c.status = 'valid'"),
        {"member": member_id, "kind": kind, "source": source_ref},
    ).mappings().one_or_none()
    return Certificate(**row) if row else None


def of_member(db: Session, member_id: uuid.UUID) -> list[Certificate]:
    """Newest first, every status: a member keeps seeing a revoked or replaced certificate."""
    rows = db.execute(text(f"{_SELECT} WHERE c.member_id = :member ORDER BY c.created_at DESC"), {"member": member_id})
    return [Certificate(**row) for row in rows.mappings()]


def refs(db: Session, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = db.execute(
        text("SELECT id, certificate_ref FROM membership.certificate WHERE id = ANY(:ids)"), {"ids": ids}
    ).all()
    return {row.id: row.certificate_ref for row in rows}


def set_token_hash(db: Session, certificate_id: uuid.UUID, hashed: str) -> None:
    db.execute(text("UPDATE membership.certificate SET token_hash = :hash WHERE id = :id"), {"id": certificate_id, "hash": hashed})


def change_status(
    db: Session,
    certificate_id: uuid.UUID,
    *,
    status: str,
    reason: str,
    changed_by: uuid.UUID | None,
    superseded_by: uuid.UUID | None = None,
) -> None:
    db.execute(
        text(
            """
            UPDATE membership.certificate
            SET status = :status, status_reason = :reason, status_changed_by = :by, status_changed_at = clock_timestamp(),
                superseded_by = :superseded_by
            WHERE id = :id AND status = 'valid'
            """
        ),
        {"id": certificate_id, "status": status, "reason": reason, "by": changed_by, "superseded_by": superseded_by},
    )


def release_valid(db: Session, certificate_id: uuid.UUID, reason: str, changed_by: uuid.UUID | None) -> None:
    """The first half of a replacement: the certificate stops being the valid one, with the reason."""
    change_status(db, certificate_id, status="revoked", reason=reason, changed_by=changed_by)


def supersede(db: Session, old_id: uuid.UUID, new_id: uuid.UUID) -> None:
    """The second half: the released certificate points at the one that replaced it."""
    db.execute(
        text("UPDATE membership.certificate SET status = 'superseded', superseded_by = :new WHERE id = :old"),
        {"old": old_id, "new": new_id},
    )


def valid_of_kind(db: Session, member_id: uuid.UUID, kind: str) -> list[Certificate]:
    rows = db.execute(
        text(f"{_SELECT} WHERE c.member_id = :member AND c.kind = :kind AND c.status = 'valid' FOR UPDATE"),
        {"member": member_id, "kind": kind},
    ).mappings()
    return [Certificate(**row) for row in rows]


# --- What certificates are made from ----------------------------------------------------------------------


def holder_name(db: Session, member_id: uuid.UUID) -> str | None:
    return db.scalar(text("SELECT full_name FROM npm.member WHERE id = :id AND deleted_at IS NULL"), {"id": member_id})


def member_since(db: Session, member_id: uuid.UUID) -> date | None:
    """When the membership first became Active."""
    moment = db.scalar(
        text(
            """
            SELECT COALESCE(
                (SELECT min(changed_at) FROM membership.membership_change WHERE member_id = :id AND to_state = 'active'),
                (SELECT changed_at FROM membership.membership WHERE member_id = :id AND state = 'active')
            )
            """
        ),
        {"id": member_id},
    )
    return moment.date() if moment else None


@dataclass(frozen=True)
class AttendedEvent:
    event_id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    starts_at: datetime


def attended_events(db: Session, member_id: uuid.UUID, event_id: uuid.UUID | None = None) -> list[AttendedEvent]:
    """Events where the member's attendance was recorded at check-in (FR-RNW-005); not cancelled ones."""
    rows = db.execute(
        text(
            """
            SELECT e.id AS event_id, e.event_ref, e.title_en, e.title_ta, e.starts_at
            FROM events.attendance a JOIN events.event e ON e.id = a.event_id AND e.state <> 'cancelled'
            WHERE a.member_id = :member AND (CAST(:event AS uuid) IS NULL OR e.id = :event)
            ORDER BY e.starts_at DESC
            LIMIT 200
            """
        ),
        {"member": member_id, "event": event_id},
    ).mappings()
    return [AttendedEvent(**row) for row in rows]


@dataclass(frozen=True)
class CompletedAssignment:
    opportunity_ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    ends_at: datetime


def completed_assignments(db: Session, member_id: uuid.UUID, now: datetime) -> list[CompletedAssignment]:
    """[ASSUMPTION] FR-RNW-006: an assignment is completed when the coordinator confirmed the member's
    offer and the opportunity has ended without being cancelled; volunteering records no other end."""
    rows = db.execute(
        text(
            """
            SELECT o.opportunity_ref, o.title_en, o.title_ta, COALESCE(f.role_en, o.role_en) AS role_en,
                   COALESCE(f.role_ta, o.role_ta) AS role_ta, o.ends_at
            FROM engagement.volunteer_offer f
            JOIN engagement.volunteer_opportunity o ON o.id = f.opportunity_id
            WHERE f.member_id = :member AND f.state = 'confirmed' AND o.state <> 'cancelled' AND o.ends_at < :now
            ORDER BY o.ends_at DESC
            """
        ),
        {"member": member_id, "now": now},
    ).mappings()
    return [CompletedAssignment(**row) for row in rows]


# --- D25: certificates in the staff member's areas ---------------------------------------------------------


@dataclass(frozen=True)
class ListedCertificate:
    certificate: Certificate
    member_code: str
    area_key: str


def search(
    db: Session, *, areas: list[str] | None, status: str | None, kind: str | None, ref: str | None, limit: int
) -> list[ListedCertificate]:
    conditions, params = ["TRUE"], {"limit": limit}
    if areas is not None:
        conditions.append("areas.keys && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if status:
        conditions.append("c.status = :status")
        params["status"] = status
    if kind:
        conditions.append("c.kind = :kind")
        params["kind"] = kind
    if ref:
        conditions.append("(c.certificate_ref = upper(:ref) OR m.member_code IN (:ref, upper(:ref)))")
        params["ref"] = ref
    columns = _SELECT.replace("SELECT", "SELECT m.member_code, areas.keys[cardinality(areas.keys)] AS area_key,", 1)
    rows = db.execute(
        text(
            f"""{columns}
            JOIN npm.member m ON m.id = c.member_id
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            CROSS JOIN LATERAL (
                SELECT array_remove(ARRAY['platform', 'province:' || d.province_code, 'district:' || m.district_code,
                                          'ds:' || m.ds_code, 'gn:' || m.gs_code], NULL) AS keys
            ) areas
            WHERE {' AND '.join(conditions)}
            ORDER BY c.created_at DESC LIMIT :limit"""
        ),
        params,
    ).mappings()
    listed = []
    for row in rows:
        values = dict(row)
        member_code, area_key = values.pop("member_code"), values.pop("area_key")
        listed.append(ListedCertificate(Certificate(**values), member_code, area_key))
    return listed


# --- The public check's rate limit (INT-22) ----------------------------------------------------------------


def recent_checks(db: Session, caller: str) -> int:
    return int(
        db.scalar(
            text(
                f"""SELECT count(*) FROM membership.certificate_check
                    WHERE caller_hash = :caller AND checked_at > now() - interval '{CHECK_WINDOW}'"""
            ),
            {"caller": caller},
        )
        or 0
    )


def record_check(db: Session, caller: str) -> None:
    db.execute(text("INSERT INTO membership.certificate_check (caller_hash) VALUES (:caller)"), {"caller": caller})


def purge_checks(db: Session) -> int:
    result = db.execute(
        text(f"DELETE FROM membership.certificate_check WHERE checked_at < now() - interval '{CHECK_WINDOW}'")
    )
    return int(result.rowcount or 0)  # type: ignore[attr-defined]

