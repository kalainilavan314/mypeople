"""SQL for staff assignments and the geography they are scoped to.

access.staff_assignment is created by Alembic revision 0002. The geo tables
and npm.member still come from the Express migrations, so everything here
is plain SQL rather than ORM models.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.permissions import AreaLevel, Tier
from app.modules.access.rules import PLATFORM, Area, AreaPath, Assignment

# One query per area level, each returning the codes from province down.
_PATH_QUERIES: dict[AreaLevel, str] = {
    "province": "SELECT province_code FROM geo.province WHERE province_code = :code",
    "district": "SELECT province_code, district_code FROM geo.district WHERE district_code = :code",
    "ds": """
        SELECT d.province_code, ds.district_code, ds.ds_code
        FROM geo.ds_division ds JOIN geo.district d ON d.district_code = ds.district_code
        WHERE ds.ds_code = :code
    """,
    "gn": """
        SELECT d.province_code, ds.district_code, g.ds_code, g.gn_code
        FROM geo.gn_division g
        JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
        JOIN geo.district d ON d.district_code = ds.district_code
        WHERE g.gn_code = :code
    """,
}
_LEVELS_FROM_PROVINCE: tuple[AreaLevel, ...] = ("province", "district", "ds", "gn")


def area_path(db: Session, area: Area) -> AreaPath | None:
    """The area and every area above it, or None if no such area exists."""
    if area.level == "platform":
        return (PLATFORM,)
    row = db.execute(text(_PATH_QUERIES[area.level]), {"code": area.code}).one_or_none()
    if row is None or any(code is None for code in row):
        return None
    return (PLATFORM, *(Area(level, code) for level, code in zip(_LEVELS_FROM_PROVINCE, row)))


def member_area_path(db: Session, member_id: uuid.UUID) -> AreaPath:
    """The area a member's records belong to: their GN division, or the closest
    level they gave. A member with no known area is platform-only, so only
    staff with platform scope can act on their records."""
    row = db.execute(
        text("SELECT gs_code, ds_code, district_code FROM npm.member WHERE id = :id"), {"id": member_id}
    ).one_or_none()
    if row is not None:
        for level, code in (("gn", row.gs_code), ("ds", row.ds_code), ("district", row.district_code)):
            if code and (path := area_path(db, Area(level, code))):
                return path
    return (PLATFORM,)


@dataclass(frozen=True)
class StoredAssignment:
    id: uuid.UUID
    member_id: uuid.UUID
    tier: Tier
    area: Area
    permissions: frozenset[str]
    state: str
    granted_by: uuid.UUID | None
    granted_at: datetime
    review_due_at: datetime | None
    ended_at: datetime | None
    ended_by: uuid.UUID | None
    end_reason: str | None

    def as_rule(self) -> Assignment:
        return Assignment(tier=self.tier, area=self.area, permissions=self.permissions)


_SELECT = """
    SELECT id, member_id, tier, area_level, area_code, permissions, state, granted_by, granted_at,
           review_due_at, ended_at, ended_by, end_reason
    FROM access.staff_assignment
"""


def _to_assignment(row) -> StoredAssignment:
    return StoredAssignment(
        id=row.id,
        member_id=row.member_id,
        tier=row.tier,
        area=Area(row.area_level, row.area_code),
        permissions=frozenset(row.permissions),
        state=row.state,
        granted_by=row.granted_by,
        granted_at=row.granted_at,
        review_due_at=row.review_due_at,
        ended_at=row.ended_at,
        ended_by=row.ended_by,
        end_reason=row.end_reason,
    )


def effective_assignments(db: Session, member_id: uuid.UUID) -> list[StoredAssignment]:
    """Assignments that count right now. One whose 12-month review is overdue no longer
    counts (FR-AUTH-027: unreviewed grants are suspended automatically), and none count
    while the person's membership is not Active (BR-097), so suspending a member also
    stops their staff rights on their next request."""
    rows = db.execute(
        text(
            f"""{_SELECT}
            WHERE member_id = :member_id AND state = 'active'
              AND (review_due_at IS NULL OR review_due_at > now())
              AND EXISTS (SELECT 1 FROM membership.membership ms
                          WHERE ms.member_id = :member_id AND ms.state = 'active')
            ORDER BY granted_at"""
        ),
        {"member_id": member_id},
    )
    return [_to_assignment(row) for row in rows]


def find_assignment(db: Session, assignment_id: uuid.UUID) -> StoredAssignment | None:
    row = db.execute(text(f"{_SELECT} WHERE id = :id"), {"id": assignment_id}).one_or_none()
    return _to_assignment(row) if row else None


def insert_assignment(
    db: Session,
    *,
    member_id: uuid.UUID,
    tier: Tier,
    area: Area,
    permissions: frozenset[str],
    granted_by: uuid.UUID | None,
    granted_at: datetime,
    review_due_at: datetime | None,
    note: str | None,
) -> StoredAssignment:
    row = db.execute(
        text(
            """
            INSERT INTO access.staff_assignment
                (member_id, tier, area_level, area_code, permissions, granted_by, granted_at, review_due_at, note)
            VALUES (:member_id, :tier, :area_level, :area_code, :permissions, :granted_by, :granted_at,
                    :review_due_at, :note)
            RETURNING id
            """
        ),
        {
            "member_id": member_id,
            "tier": tier,
            "area_level": area.level,
            "area_code": area.code,
            "permissions": sorted(permissions),
            "granted_by": granted_by,
            "granted_at": granted_at,
            "review_due_at": review_due_at,
            "note": note,
        },
    ).one()
    stored = find_assignment(db, row.id)
    assert stored is not None
    return stored


def revoke_assignment(db: Session, assignment_id: uuid.UUID, ended_by: uuid.UUID, reason: str) -> StoredAssignment:
    db.execute(
        text(
            """
            UPDATE access.staff_assignment
            SET state = 'revoked', ended_at = now(), ended_by = :ended_by, end_reason = :reason
            WHERE id = :id AND state = 'active'
            """
        ),
        {"id": assignment_id, "ended_by": ended_by, "reason": reason},
    )
    stored = find_assignment(db, assignment_id)
    assert stored is not None
    return stored


def held_tiers(db: Session, member_id: uuid.UUID) -> list[Tier]:
    """The tiers of every assignment not revoked, including ones paused by a suspended membership
    or an overdue review: those come back, so they still rank the person."""
    rows = db.scalars(
        text("SELECT DISTINCT tier FROM access.staff_assignment WHERE member_id = :id AND state = 'active'"),
        {"id": member_id},
    )
    return list(rows)


def tally_denial(db: Session, actor_id: uuid.UUID, permission: str, reason: str, window: str) -> int | None:
    """Count a refusal in ops.denial_tally (Alembic 0013). None: it falls inside an open window
    and is only counted. Otherwise it opens a new window and should be written to the audit
    log; the number is how many the previous window held back."""
    key = {"actor": actor_id, "permission": permission, "reason": reason}
    opened = db.scalar(
        text(
            """
            INSERT INTO ops.denial_tally (actor_id, permission, reason) VALUES (:actor, :permission, :reason)
            ON CONFLICT DO NOTHING RETURNING 0
            """
        ),
        key,
    )
    if opened is not None:
        return 0
    row = db.execute(
        text(
            """
            SELECT suppressed, window_started_at < clock_timestamp() - CAST(:window AS interval) AS expired
            FROM ops.denial_tally WHERE actor_id = :actor AND permission = :permission AND reason = :reason
            FOR UPDATE
            """
        ),
        {**key, "window": window},
    ).one()
    if row.expired:
        db.execute(
            text(
                """
                UPDATE ops.denial_tally SET window_started_at = clock_timestamp(), suppressed = 0
                WHERE actor_id = :actor AND permission = :permission AND reason = :reason
                """
            ),
            key,
        )
        return row.suppressed
    db.execute(
        text(
            """
            UPDATE ops.denial_tally SET suppressed = suppressed + 1
            WHERE actor_id = :actor AND permission = :permission AND reason = :reason
            """
        ),
        key,
    )
    return None


def has_active_super_administrator(db: Session) -> bool:
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM access.staff_assignment WHERE tier = '5' AND state = 'active')")))


@dataclass(frozen=True)
class MemberStatus:
    id: uuid.UUID
    identity_verified: bool
    membership_state: str

    @property
    def membership_active(self) -> bool:
        return self.membership_state == "active"


def find_member_status(db: Session, member_id: uuid.UUID) -> MemberStatus | None:
    """A member who has not been deleted, whether a reviewer has confirmed their identity,
    and their membership state (Pending when nobody has activated them)."""
    row = db.execute(
        text(
            """
            SELECT m.id, m.verification_status, COALESCE(ms.state, 'pending') AS membership_state
            FROM npm.member m LEFT JOIN membership.membership ms ON ms.member_id = m.id
            WHERE m.id = :id AND m.deleted_at IS NULL
            """
        ),
        {"id": member_id},
    ).one_or_none()
    if row is None:
        return None
    # 'identity_confirmed' is the only Express state that means a person checked the identity.
    return MemberStatus(
        id=row.id,
        identity_verified=row.verification_status == "identity_confirmed",
        membership_state=row.membership_state,
    )
