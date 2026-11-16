"""PostgreSQL operations for the My Household module, under row-level security (Alembic 0021, 0042).

Every statement runs with the caller's `app.current_member_id`, so the database itself hides other
households. A few writes the policies cannot express (a joining adult adding their own row, the
head handing over, a guardian who is not the head deleting a child's record, the household ending)
run inside `system_access`, only after the service has checked the rule, and each is scoped by id.
"""

import json
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session

from app.modules.households.rules import ERASED_NAME, INVITATION_VALIDITY_DAYS

_MEMBER_COLUMNS = """hm.id, hm.household_id, hm.member_id, hm.role, hm.display_name, hm.relationship, hm.status,
                     hm.joined_at, hm.removed_at, hm.age_band, hm.occupation_category, hm.birth_year,
                     hm.guardian_member_id"""

_INVITATION_SELECT = """
    SELECT i.id, i.household_id, i.inviter_member_id, i.invitee_member_id,
           i.relationship, i.status, i.created_at, i.expires_at, i.responded_at,
           h.name AS household_name,
           coalesce(ip.display_name, im.full_name) AS inviter_name,
           em.member_code AS invitee_code
    FROM household.invitation i
    LEFT JOIN household.household h ON h.id = i.household_id
    JOIN npm.member im ON im.id = i.inviter_member_id
    JOIN npm.member em ON em.id = i.invitee_member_id
    LEFT JOIN profile.display_name ip ON ip.member_id = im.id
"""


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


@contextmanager
def system_access(db: Session, member_id: uuid.UUID) -> Iterator[None]:
    """Open row-level security for statements the service has already authorised, then put the
    member's own context back, even when the block raises."""
    set_rls_context(db, member_id, bypass=True)
    try:
        yield
    finally:
        set_rls_context(db, member_id)


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
    """The member's own active row in a household that has not been dissolved."""
    return db.execute(
        text(
            """
            SELECT hm.id, hm.household_id, hm.member_id, hm.role, hm.display_name,
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


def staff_find_household_id(db: Session, target_member_id: uuid.UUID) -> uuid.UUID | None:
    """For the staff view: the target's active household, read from their own row only (the staff
    context can see the target's row before it knows the household)."""
    return db.scalar(
        text(
            """
            SELECT household_id FROM household.household_member
            WHERE member_id = :member_id AND status = 'active'
            LIMIT 1
            """
        ),
        {"member_id": target_member_id},
    )


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    """Serialise household changes for one person across every household."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(CAST(:id AS text), 0))"), {"id": str(member_id)})


def lock_household(db: Session, household_id: uuid.UUID) -> None:
    """Serialise capacity and membership changes for one household. An advisory lock, because a
    row lock would silently skip the row for anyone the policies do not let update it (an invitee
    accepting, an adult adding a child)."""
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended('household:' || CAST(:id AS text), 0))"),
        {"id": str(household_id)},
    )


def get_household(db: Session, household_id: uuid.UUID) -> RowMapping | None:
    return db.execute(
        text(
            """
            SELECT id, created_by, name, created_at, updated_at, dissolved_at, area_key, area_path,
                   caseworker_consent_at, caseworker_consent_by
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
    area_path: list[str],
) -> uuid.UUID:
    """Create a household in the creator's area and insert the creator as head."""
    household_id: uuid.UUID = db.scalar(
        text(
            """
            INSERT INTO household.household (created_by, name, area_key, area_path)
            VALUES (:creator_id, :name, :area_key, :area_path)
            RETURNING id
            """
        ),
        {
            "creator_id": creator_id,
            "name": name.strip() if name and name.strip() else None,
            "area_key": area_path[-1],
            "area_path": area_path,
        },
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
        {"id": household_id, "name": name.strip() if name and name.strip() else None},
    )


def set_caseworker_consent(db: Session, household_id: uuid.UUID, given_by: uuid.UUID | None) -> None:
    """Record (given_by set) or withdraw (None) the household's caseworker consent."""
    db.execute(
        text(
            """
            UPDATE household.household
            SET caseworker_consent_at = CASE WHEN CAST(:by AS uuid) IS NULL THEN NULL ELSE clock_timestamp() END,
                caseworker_consent_by = CAST(:by AS uuid),
                updated_at = clock_timestamp()
            WHERE id = :id AND dissolved_at IS NULL
            """
        ),
        {"id": household_id, "by": str(given_by) if given_by else None},
    )


def list_members(db: Session, household_id: uuid.UUID, include_removed: bool = False) -> list[RowMapping]:
    status_filter = "" if include_removed else "AND hm.status = 'active'"
    return list(
        db.execute(
            text(
                f"""
                SELECT {_MEMBER_COLUMNS}, m.member_code
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


def longest_standing_adult(db: Session, household_id: uuid.UUID) -> RowMapping | None:
    """Who becomes head when the head leaves: the adult who joined first."""
    return db.execute(
        text(
            """
            SELECT id, member_id
            FROM household.household_member
            WHERE household_id = :hid AND role = 'adult' AND status = 'active'
            ORDER BY joined_at ASC, id ASC
            LIMIT 1
            """
        ),
        {"hid": household_id},
    ).mappings().one_or_none()


def create_invitation(
    db: Session,
    household_id: uuid.UUID,
    inviter_id: uuid.UUID,
    invitee_id: uuid.UUID,
    relationship: str,
) -> uuid.UUID:
    expires_at = datetime.now(UTC) + timedelta(days=INVITATION_VALIDITY_DAYS)
    inv_id: uuid.UUID = db.scalar(
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
    """One invitation. The household is joined on the outside: an invitee cannot see a household
    they are not in, so for them the household name is empty here."""
    return db.execute(
        text(_INVITATION_SELECT + " WHERE i.id = :id " + ("FOR UPDATE OF i" if lock else "")),
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
    """The member's own pending invitations with the household's name, so they know what they are
    accepting. Run inside system_access: an invitee cannot otherwise see the household's row; the
    query is limited to invitations addressed to this member."""
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
                _INVITATION_SELECT
                + """
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
                _INVITATION_SELECT
                + """
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


def revoke_invitations_from(db: Session, household_id: uuid.UUID, inviter_id: uuid.UUID) -> None:
    """Pending invitations a departing member sent lapse with them."""
    db.execute(
        text(
            """
            UPDATE household.invitation
            SET status = 'revoked', responded_at = clock_timestamp()
            WHERE household_id = :hid AND inviter_member_id = :inviter AND status = 'pending'
            """
        ),
        {"hid": household_id, "inviter": inviter_id},
    )


def add_member(
    db: Session,
    household_id: uuid.UUID,
    member_id: uuid.UUID | None,
    role: str,
    display_name: str,
    relationship: str,
) -> uuid.UUID:
    record_id: uuid.UUID = db.scalar(
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
    return record_id


def add_dependant(
    db: Session,
    household_id: uuid.UUID,
    guardian_id: uuid.UUID,
    first_name: str,
    relationship: str,
    birth_year: int,
) -> uuid.UUID:
    """OD-31: a child's minimum record, with the adult who added it as guardian; no account."""
    record_id: uuid.UUID = db.scalar(
        text(
            """
            INSERT INTO household.household_member
                (household_id, member_id, role, display_name, relationship, status, birth_year, guardian_member_id)
            VALUES
                (:hid, NULL, 'dependent', :name, :rel, 'active', :year, :guardian)
            RETURNING id
            """
        ),
        {"hid": household_id, "name": first_name, "rel": relationship, "year": birth_year, "guardian": guardian_id},
    )
    return record_id


def find_member_record(db: Session, member_record_id: uuid.UUID) -> RowMapping | None:
    return db.execute(
        text(
            f"""
            SELECT {_MEMBER_COLUMNS}
            FROM household.household_member hm
            WHERE hm.id = :id
            """
        ),
        {"id": member_record_id},
    ).mappings().one_or_none()


def update_dependant(db: Session, record_id: uuid.UUID, changes: dict[str, Any]) -> None:
    """changes holds only display_name, relationship and birth_year (set by the service)."""
    columns = {"display_name", "relationship", "birth_year"}
    assignments = ", ".join(f"{column} = :{column}" for column in changes if column in columns)
    if not assignments:
        return
    db.execute(
        text(f"UPDATE household.household_member SET {assignments} WHERE id = :id AND role = 'dependent'"),
        {"id": record_id, **{k: v for k, v in changes.items() if k in columns}},
    )


def update_adult_details(db: Session, record_id: uuid.UUID, changes: dict[str, Any]) -> None:
    """An adult's own age band and occupation category, or (by the head) their relationship."""
    columns = {"age_band", "occupation_category", "relationship"}
    assignments = ", ".join(f"{column} = :{column}" for column in changes if column in columns)
    if not assignments:
        return
    db.execute(
        text(f"UPDATE household.household_member SET {assignments} WHERE id = :id AND role <> 'dependent'"),
        {"id": record_id, **{k: v for k, v in changes.items() if k in columns}},
    )


def delete_dependant(db: Session, household_id: uuid.UUID, record_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            DELETE FROM household.household_member
            WHERE id = :id AND household_id = :hid AND role = 'dependent'
            """
        ),
        {"id": record_id, "hid": household_id},
    )


def delete_dependants_of(db: Session, household_id: uuid.UUID, guardian_id: uuid.UUID) -> int:
    """A guardian who leaves takes their children's records with them: nobody else manages them."""
    result = db.execute(
        text(
            """
            DELETE FROM household.household_member
            WHERE household_id = :hid AND role = 'dependent' AND guardian_member_id = :guardian
            """
        ),
        {"hid": household_id, "guardian": guardian_id},
    )
    return int(getattr(result, "rowcount", 0) or 0)


def remove_member(db: Session, member_record_id: uuid.UUID) -> None:
    """The adult is no longer in the household: their stored name and own details are erased; the
    row stays so the log's ids still point somewhere."""
    db.execute(
        text(
            """
            UPDATE household.household_member
            SET status = 'removed', removed_at = clock_timestamp(), display_name = :erased,
                age_band = NULL, occupation_category = NULL
            WHERE id = :id
            """
        ),
        {"id": member_record_id, "erased": ERASED_NAME},
    )


def make_head(db: Session, member_record_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE household.household_member
            SET role = 'head', relationship = 'head'
            WHERE id = :id AND role = 'adult' AND status = 'active'
            """
        ),
        {"id": member_record_id},
    )


def dissolve_household(db: Session, household_id: uuid.UUID) -> None:
    """End the household: children's records are deleted, stored names and the household's name
    are erased, consent and pending invitations end. The change log stays, holding ids only."""
    db.execute(
        text(
            """
            UPDATE household.household
            SET dissolved_at = clock_timestamp(), updated_at = clock_timestamp(), name = NULL,
                caseworker_consent_at = NULL, caseworker_consent_by = NULL
            WHERE id = :id
            """
        ),
        {"id": household_id},
    )
    db.execute(
        text("DELETE FROM household.household_member WHERE household_id = :id AND role = 'dependent'"),
        {"id": household_id},
    )
    db.execute(
        text(
            """
            UPDATE household.household_member
            SET status = 'removed', removed_at = coalesce(removed_at, clock_timestamp()), display_name = :erased,
                age_band = NULL, occupation_category = NULL
            WHERE household_id = :id
            """
        ),
        {"id": household_id, "erased": ERASED_NAME},
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
    """Append to the household's change log. Details hold ids and field names, never names."""
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


def list_household_log(db: Session, household_id: uuid.UUID, limit: int = 100) -> list[RowMapping]:
    """The household's change log for its own adults: the action, who, and when. A name comes only
    from the household's own row for a current adult, never from another module."""
    return list(
        db.execute(
            text(
                """
                SELECT c.id, c.action, c.actor_id, c.created_at,
                       hm.display_name AS actor_name
                FROM household.consent_log c
                LEFT JOIN household.household_member hm
                       ON hm.household_id = c.household_id AND hm.member_id = c.actor_id AND hm.status = 'active'
                WHERE c.household_id = :hid
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT :limit
                """
            ),
            {"hid": household_id, "limit": limit},
        ).mappings()
    )
