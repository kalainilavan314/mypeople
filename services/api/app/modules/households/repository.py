"""PostgreSQL operations for the My Household module with Row-Level Security."""

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Row, RowMapping, text
from sqlalchemy.orm import Session

from app.modules.households.rules import INVITATION_VALIDITY_DAYS


def set_rls_context(
    db: Session,
    member_id: uuid.UUID | None = None,
    *,
    staff_view: bool = False,
    staff_target_member_id: uuid.UUID | None = None,
    staff_household_id: uuid.UUID | None = None,
    bypass: bool = False,
) -> None:
    """Set transaction-local session variables for PostgreSQL Row-Level Security."""
    db.execute(
        text("SELECT set_config('app.current_member_id', :mid, true)"),
        {"mid": str(member_id) if member_id else ""},
    )
    db.execute(
        text("SELECT set_config('app.household_view_for_case', :view, true)"),
        {"view": "on" if staff_view else ""},
    )
    db.execute(
        text("SELECT set_config('app.household_target_member_id', :target, true)"),
        {"target": str(staff_target_member_id) if staff_target_member_id else ""},
    )
    db.execute(
        text("SELECT set_config('app.household_scope_id', :scope, true)"),
        {"scope": str(staff_household_id) if staff_household_id else ""},
    )
    db.execute(
        text("SELECT set_config('app.bypass_rls', :bypass, true)"),
        {"bypass": "on" if bypass else ""},
    )


def resolve_member_by_code(db: Session, member_code: str) -> RowMapping | None:
    """Look up a member by exact or uppercase member code."""
    return db.execute(
        text(
            """
            SELECT m.id, m.member_code, m.full_name,
                   coalesce(p.display_name, m.full_name) AS display_name
            FROM npm.member m
            LEFT JOIN profile.display_name p ON p.member_id = m.id
            WHERE upper(m.member_code) = upper(:code)
              AND m.deleted_at IS NULL
            LIMIT 1
            """
        ),
        {"code": member_code.strip()},
    ).mappings().one_or_none()


def member_profile_summary(db: Session, member_id: uuid.UUID) -> RowMapping | None:
    """Get display name and member code for a member ID."""
    return db.execute(
        text(
            """
            SELECT m.id, m.member_code, m.full_name,
                   coalesce(p.display_name, m.full_name) AS display_name
            FROM npm.member m
            LEFT JOIN profile.display_name p ON p.member_id = m.id
            WHERE m.id = :id AND m.deleted_at IS NULL
            """
        ),
        {"id": member_id},
    ).mappings().one_or_none()


def find_active_membership(db: Session, member_id: uuid.UUID) -> RowMapping | None:
    """Check if member currently belongs to an active, non-dissolved household."""
    return db.execute(
        text(
            """
            SELECT hm.id, hm.household_id, hm.role, hm.display_name,
                   hm.relationship, hm.status, hm.joined_at, h.dissolved_at
            FROM household.household_member hm
            JOIN household.household h ON h.id = hm.household_id
            WHERE hm.member_id = :member_id
              AND hm.status = 'active'
              AND h.dissolved_at IS NULL
            LIMIT 1
            """
        ),
        {"member_id": member_id},
    ).mappings().one_or_none()


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    """Serialise household changes for one person across every household."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(CAST(:id AS text), 0))"), {"id": str(member_id)})


def lock_household(db: Session, household_id: uuid.UUID) -> None:
    """Serialise membership-capacity and invitation changes for one household."""
    db.execute(text("SELECT id FROM household.household WHERE id = :id FOR UPDATE"), {"id": household_id})


def get_household(db: Session, household_id: uuid.UUID) -> RowMapping | None:
    return db.execute(
        text(
            """
            SELECT id, created_by, name, created_at, updated_at, dissolved_at
            FROM household.household
            WHERE id = :id
            """
        ),
        {"id": household_id},
    ).mappings().one_or_none()


def create_household_with_head(
    db: Session,
    creator_id: uuid.UUID,
    name: str | None,
    head_display_name: str,
) -> uuid.UUID:
    """Create a household and insert creator as head in an atomic transaction."""
    household_id = db.scalar(
        text(
            """
            INSERT INTO household.household (created_by, name)
            VALUES (:creator_id, :name)
            RETURNING id
            """
        ),
        {"creator_id": creator_id, "name": name.strip() if name else None},
    )
    db.execute(
        text(
            """
            INSERT INTO household.household_member
                (household_id, member_id, role, display_name, relationship, status)
            VALUES
                (:hid, :mid, 'head', :dname, 'head', 'active')
            """
        ),
        {"hid": household_id, "mid": creator_id, "dname": head_display_name},
    )
    record_consent_log(
        db,
        household_id=household_id,
        action="create_household",
        actor_id=creator_id,
        member_id=creator_id,
        details=None,
    )
    return household_id


def update_household_name(db: Session, household_id: uuid.UUID, name: str | None) -> None:
    db.execute(
        text(
            """
            UPDATE household.household
            SET name = :name, updated_at = clock_timestamp()
            WHERE id = :id AND dissolved_at IS NULL
            """
        ),
        {"id": household_id, "name": name.strip() if name else None},
    )


def list_members(db: Session, household_id: uuid.UUID, include_removed: bool = False) -> list[RowMapping]:
    status_filter = "" if include_removed else "AND hm.status = 'active'"
    return list(
        db.execute(
            text(
                f"""
                SELECT hm.id, hm.household_id, hm.member_id, hm.role, hm.display_name,
                       hm.relationship, hm.status, hm.joined_at, hm.removed_at,
                       m.member_code
                FROM household.household_member hm
                LEFT JOIN npm.member m ON m.id = hm.member_id
                WHERE hm.household_id = :hid {status_filter}
                ORDER BY
                    CASE hm.role WHEN 'head' THEN 1 WHEN 'adult' THEN 2 ELSE 3 END,
                    hm.joined_at ASC
                """
            ),
            {"hid": household_id},
        ).mappings()
    )


def count_active_members(db: Session, household_id: uuid.UUID) -> int:
    return db.scalar(
        text(
            """
            SELECT count(*)
            FROM household.household_member
            WHERE household_id = :hid AND status = 'active'
            """
        ),
        {"hid": household_id},
    ) or 0


def create_invitation(
    db: Session,
    household_id: uuid.UUID,
    inviter_id: uuid.UUID,
    invitee_id: uuid.UUID,
    relationship: str,
) -> uuid.UUID:
    expires_at = datetime.now(UTC) + timedelta(days=INVITATION_VALIDITY_DAYS)
    inv_id = db.scalar(
        text(
            """
            INSERT INTO household.invitation
                (household_id, inviter_member_id, invitee_member_id, relationship, expires_at)
            VALUES
                (:hid, :inviter, :invitee, :rel, :expires)
            RETURNING id
            """
        ),
        {
            "hid": household_id,
            "inviter": inviter_id,
            "invitee": invitee_id,
            "rel": relationship,
            "expires": expires_at,
        },
    )
    return inv_id


def get_invitation(db: Session, invitation_id: uuid.UUID, *, lock: bool = False) -> RowMapping | None:
    return db.execute(
        text(
            """
            SELECT i.id, i.household_id, i.inviter_member_id, i.invitee_member_id,
                   i.relationship, i.status, i.created_at, i.expires_at, i.responded_at,
                   h.name AS household_name,
                   coalesce(ip.display_name, im.full_name) AS inviter_name,
                   coalesce(ep.display_name, em.full_name) AS invitee_name,
                   em.member_code AS invitee_code
            FROM household.invitation i
            JOIN household.household h ON h.id = i.household_id
            JOIN npm.member im ON im.id = i.inviter_member_id
            JOIN npm.member em ON em.id = i.invitee_member_id
            LEFT JOIN profile.display_name ip ON ip.member_id = im.id
            LEFT JOIN profile.display_name ep ON ep.member_id = em.id
            WHERE i.id = :id
            {lock_clause}
            """
            .format(lock_clause="FOR UPDATE OF i" if lock else "")
        ),
        {"id": invitation_id},
    ).mappings().one_or_none()


def has_pending_invitation(db: Session, household_id: uuid.UUID, invitee_id: uuid.UUID) -> bool:
    count = db.scalar(
        text(
            """
            SELECT count(*)
            FROM household.invitation
            WHERE household_id = :hid
              AND invitee_member_id = :invitee
              AND status = 'pending'
              AND expires_at > clock_timestamp()
            """
        ),
        {"hid": household_id, "invitee": invitee_id},
    )
    return (count or 0) > 0


def list_received_invitations(db: Session, member_id: uuid.UUID) -> list[RowMapping]:
    # Update expired ones lazily
    db.execute(
        text(
            """
            UPDATE household.invitation
            SET status = 'expired'
            WHERE invitee_member_id = :mid
              AND status = 'pending'
              AND expires_at <= clock_timestamp()
            """
        ),
        {"mid": member_id},
    )
    return list(
        db.execute(
            text(
                """
                SELECT i.id, i.household_id, i.inviter_member_id, i.invitee_member_id,
                       i.relationship, i.status, i.created_at, i.expires_at, i.responded_at,
                       h.name AS household_name,
                       coalesce(ip.display_name, im.full_name) AS inviter_name,
                       coalesce(ep.display_name, em.full_name) AS invitee_name,
                       em.member_code AS invitee_code
                FROM household.invitation i
                JOIN household.household h ON h.id = i.household_id
                JOIN npm.member im ON im.id = i.inviter_member_id
                JOIN npm.member em ON em.id = i.invitee_member_id
                LEFT JOIN profile.display_name ip ON ip.member_id = im.id
                LEFT JOIN profile.display_name ep ON ep.member_id = em.id
                WHERE i.invitee_member_id = :mid
                  AND i.status = 'pending'
                  AND h.dissolved_at IS NULL
                ORDER BY i.created_at DESC
                """
            ),
            {"mid": member_id},
        ).mappings()
    )


def list_sent_invitations(db: Session, household_id: uuid.UUID) -> list[RowMapping]:
    return list(
        db.execute(
            text(
                """
                SELECT i.id, i.household_id, i.inviter_member_id, i.invitee_member_id,
                       i.relationship, i.status, i.created_at, i.expires_at, i.responded_at,
                       h.name AS household_name,
                       coalesce(ip.display_name, im.full_name) AS inviter_name,
                       coalesce(ep.display_name, em.full_name) AS invitee_name,
                       em.member_code AS invitee_code
                FROM household.invitation i
                JOIN household.household h ON h.id = i.household_id
                JOIN npm.member im ON im.id = i.inviter_member_id
                JOIN npm.member em ON em.id = i.invitee_member_id
                LEFT JOIN profile.display_name ip ON ip.member_id = im.id
                LEFT JOIN profile.display_name ep ON ep.member_id = em.id
                WHERE i.household_id = :hid
                  AND i.status = 'pending'
                ORDER BY i.created_at DESC
                """
            ),
            {"hid": household_id},
        ).mappings()
    )


def update_invitation_status(db: Session, invitation_id: uuid.UUID, status: str) -> None:
    db.execute(
        text(
            """
            UPDATE household.invitation
            SET status = :status, responded_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": invitation_id, "status": status},
    )


def add_member(
    db: Session,
    household_id: uuid.UUID,
    member_id: uuid.UUID | None,
    role: str,
    display_name: str,
    relationship: str,
) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO household.household_member
                (household_id, member_id, role, display_name, relationship, status)
            VALUES
                (:hid, :mid, :role, :dname, :rel, 'active')
            RETURNING id
            """
        ),
        {
            "hid": household_id,
            "mid": member_id,
            "role": role,
            "dname": display_name.strip(),
            "rel": relationship,
        },
    )


def find_member_record(db: Session, member_record_id: uuid.UUID) -> RowMapping | None:
    return db.execute(
        text(
            """
            SELECT id, household_id, member_id, role, display_name, relationship, status,
                   joined_at, removed_at
            FROM household.household_member
            WHERE id = :id
            """
        ),
        {"id": member_record_id},
    ).mappings().one_or_none()


def remove_member(db: Session, member_record_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE household.household_member
            SET status = 'removed', removed_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": member_record_id},
    )


def dissolve_household(db: Session, household_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE household.household
            SET dissolved_at = clock_timestamp(), updated_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": household_id},
    )
    db.execute(
        text(
            """
            UPDATE household.household_member
            SET status = 'removed', removed_at = clock_timestamp()
            WHERE household_id = :id AND status = 'active'
            """
        ),
        {"id": household_id},
    )
    db.execute(
        text(
            """
            UPDATE household.invitation
            SET status = 'revoked', responded_at = clock_timestamp()
            WHERE household_id = :id AND status = 'pending'
            """
        ),
        {"id": household_id},
    )


def record_consent_log(
    db: Session,
    household_id: uuid.UUID,
    action: str,
    actor_id: uuid.UUID,
    member_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO household.consent_log (household_id, member_id, actor_id, action, details)
            VALUES (:hid, :mid, :actor, :act, CAST(:det AS jsonb))
            """
        ),
        {
            "hid": household_id,
            "mid": member_id,
            "actor": actor_id,
            "act": action,
            "det": json.dumps(details) if details is not None else None,
        },
    )


def list_consent_logs(db: Session, household_id: uuid.UUID) -> list[RowMapping]:
    return list(
        db.execute(
            text(
                """
                SELECT c.id, c.household_id, c.member_id, c.actor_id, c.action, c.details, c.created_at,
                       coalesce(p.display_name, m.full_name) AS actor_name
                FROM household.consent_log c
                JOIN npm.member m ON m.id = c.actor_id
                LEFT JOIN profile.display_name p ON p.member_id = m.id
                WHERE c.household_id = :hid
                ORDER BY c.created_at DESC
                LIMIT 50
                """
            ),
            {"hid": household_id},
        ).mappings()
    )
