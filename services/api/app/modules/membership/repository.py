"""Member profile and membership state queries.

npm.member and the geo tables are still owned by the Express migrations, so
they are read with SQL here (see app/modules/auth/repository.py for why).
membership.* is created by Alembic revision 0006.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import RowMapping, text
from sqlalchemy.orm import Session

# Serialises changes per member, so two staff acting at once cannot both
# start from the same state.
_CHANGE_LOCK_SPACE = 30_003

# The area names follow server/src/db.js: the DS division is the one the
# member chose at sign-up, falling back to the one their GN division is in.
PROFILE_QUERY = text(
    """
    SELECT m.id, m.member_code, m.full_name, m.phone, m.dob, m.gender, m.language,
           m.tier, m.referral_code, m.verification_status, m.verified_at,
           m.district_code, d.name_en AS district_name,
           m.ds_code, ds.name_en AS ds_name,
           m.gs_code, g.name_en AS gs_name,
           m.created_at AS joined_at
    FROM npm.member m
    LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
    LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
    LEFT JOIN geo.district d ON d.district_code = m.district_code
    WHERE m.id = :id AND m.deleted_at IS NULL
    """
)


def find_member_profile(db: Session, member_id: uuid.UUID) -> RowMapping | None:
    return db.execute(PROFILE_QUERY, {"id": member_id}).mappings().one_or_none()


@dataclass(frozen=True)
class MembershipState:
    state: str
    reason_code: str | None
    changed_at: datetime | None


@dataclass(frozen=True)
class MembershipChange:
    id: int
    action: str
    from_state: str
    to_state: str
    reason_code: str
    note: str | None
    changed_by: uuid.UUID | None
    changed_at: datetime


def lock_member(db: Session, member_id: uuid.UUID) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(:space, hashtext(CAST(:member_id AS text)))"),
        {"space": _CHANGE_LOCK_SPACE, "member_id": member_id},
    )


def current_state(db: Session, member_id: uuid.UUID) -> MembershipState:
    """A member nobody has activated yet has no row and is Pending."""
    row = db.execute(
        text("SELECT state, reason_code, changed_at FROM membership.membership WHERE member_id = :id"),
        {"id": member_id},
    ).one_or_none()
    if row is None:
        return MembershipState(state="pending", reason_code=None, changed_at=None)
    return MembershipState(state=row.state, reason_code=row.reason_code, changed_at=row.changed_at)


def record_change(
    db: Session,
    *,
    member_id: uuid.UUID,
    action: str,
    from_state: str,
    to_state: str,
    reason_code: str,
    note: str | None,
    changed_by: uuid.UUID | None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO membership.membership (member_id, state, reason_code, changed_by)
            VALUES (:member_id, :to_state, :reason_code, :changed_by)
            ON CONFLICT (member_id) DO UPDATE
            SET state = EXCLUDED.state, reason_code = EXCLUDED.reason_code,
                changed_by = EXCLUDED.changed_by, changed_at = clock_timestamp()
            """
        ),
        {"member_id": member_id, "to_state": to_state, "reason_code": reason_code, "changed_by": changed_by},
    )
    db.execute(
        text(
            """
            INSERT INTO membership.membership_change (member_id, action, from_state, to_state, reason_code, note, changed_by)
            VALUES (:member_id, :action, :from_state, :to_state, :reason_code, :note, :changed_by)
            """
        ),
        {
            "member_id": member_id,
            "action": action,
            "from_state": from_state,
            "to_state": to_state,
            "reason_code": reason_code,
            "note": note,
            "changed_by": changed_by,
        },
    )


def history(db: Session, member_id: uuid.UUID) -> list[MembershipChange]:
    """Newest first."""
    rows = db.execute(
        text(
            """
            SELECT id, action, from_state, to_state, reason_code, note, changed_by, changed_at
            FROM membership.membership_change WHERE member_id = :id ORDER BY id DESC
            """
        ),
        {"id": member_id},
    ).mappings()
    return [MembershipChange(**row) for row in rows]


@dataclass(frozen=True)
class AwaitingMember:
    id: uuid.UUID
    member_code: str
    full_name: str
    verified_at: datetime | None
    area: str


def awaiting_activation(db: Session, *, visible_areas: list[str] | None, limit: int) -> list[AwaitingMember]:
    """Members whose identity is confirmed and whose membership is still Pending, oldest first.

    The area keys are built from the codes sign-up stores on the member, in
    the audit log's form, so they can be matched against a staff member's areas.
    """
    params: dict[str, Any] = {"limit": limit}
    area_condition = ""
    if visible_areas is not None:
        area_condition = "AND areas.keys && CAST(:areas AS text[])"
        params["areas"] = visible_areas
    rows = db.execute(
        text(
            f"""
            SELECT m.id, m.member_code, m.full_name, m.verified_at, areas.keys[cardinality(areas.keys)] AS area
            FROM npm.member m
            LEFT JOIN membership.membership ms ON ms.member_id = m.id
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            CROSS JOIN LATERAL (
                SELECT array_remove(
                    ARRAY['platform', 'province:' || d.province_code, 'district:' || m.district_code,
                          'ds:' || m.ds_code, 'gn:' || m.gs_code],
                    NULL
                ) AS keys
            ) areas
            WHERE m.deleted_at IS NULL AND m.verification_status = 'identity_confirmed'
              AND COALESCE(ms.state, 'pending') = 'pending' {area_condition}
            ORDER BY m.verified_at NULLS LAST, m.member_code
            LIMIT :limit
            """
        ),
        params,
    ).mappings()
    return [AwaitingMember(**row) for row in rows]


@dataclass(frozen=True)
class LookedUpMember:
    id: uuid.UUID
    member_code: str
    full_name: str
    district_name: str | None
    gn_name: str | None
    identity_verified: bool
    membership_state: str


def lookup_member(db: Session, member_code: str) -> LookedUpMember | None:
    """FR-STF-003: an exact member ID, as printed or typed in lower case; never a partial match."""
    row = db.execute(
        text(
            """
            SELECT m.id, m.member_code, m.full_name, d.name_en AS district_name, g.name_en AS gn_name,
                   m.verification_status = 'identity_confirmed' AS identity_verified,
                   COALESCE(ms.state, 'pending') AS membership_state
            FROM npm.member m
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
            LEFT JOIN membership.membership ms ON ms.member_id = m.id
            WHERE m.member_code IN (:code, upper(:code)) AND m.deleted_at IS NULL
            LIMIT 1
            """
        ),
        {"code": member_code},
    ).mappings().one_or_none()
    return LookedUpMember(**row) if row else None


# --- Consent records (ENT-05) -------------------------------------------------------------


def record_consent(db: Session, member_id: uuid.UUID, consent_type: str, notice_version: str) -> None:
    db.execute(
        text(
            """
            INSERT INTO membership.consent_record (member_id, consent_type, notice_version)
            VALUES (:member_id, :consent_type, :notice_version)
            """
        ),
        {"member_id": member_id, "consent_type": consent_type, "notice_version": notice_version},
    )


def has_consent(db: Session, member_id: uuid.UUID, consent_type: str, notice_version: str) -> bool:
    """A consent to this version of the notice that has not been withdrawn."""
    return bool(
        db.scalar(
            text(
                """
                SELECT EXISTS (SELECT 1 FROM membership.consent_record
                               WHERE member_id = :member_id AND consent_type = :consent_type
                                 AND notice_version = :notice_version AND withdrawn_at IS NULL)
                """
            ),
            {"member_id": member_id, "consent_type": consent_type, "notice_version": notice_version},
        )
    )
