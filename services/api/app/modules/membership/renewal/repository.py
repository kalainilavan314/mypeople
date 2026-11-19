"""SQL for membership.renewal_cycle (Alembic revision 0051, ENT-52).

npm.member and membership.membership belong to other revisions and are read with SQL here.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.membership.renewal.rules import GRACE_DAYS, OPENS_DAYS_BEFORE

# A member's area keys in the audit log's form, from the codes sign-up stores (see
# membership/repository.py awaiting_activation), so they can be matched against a staff member's areas.
_AREA_KEYS = """
    CROSS JOIN LATERAL (
        SELECT array_remove(
            ARRAY['platform', 'province:' || d.province_code, 'district:' || m.district_code,
                  'ds:' || m.ds_code, 'gn:' || m.gs_code],
            NULL
        ) AS keys
    ) areas
"""


@dataclass(frozen=True)
class Cycle:
    id: uuid.UUID
    member_id: uuid.UUID
    due_on: date
    opened_on: date
    state: str
    notice_30_at: datetime | None
    notice_7_at: datetime | None
    confirmed_at: datetime | None
    area_confirmation: str | None
    lapsed_at: datetime | None


_CYCLE = """
    SELECT id, member_id, due_on, opened_on, state, notice_30_at, notice_7_at, confirmed_at, area_confirmation, lapsed_at
    FROM membership.renewal_cycle
"""


def find_open(db: Session, member_id: uuid.UUID, *, lock: bool = False) -> Cycle | None:
    row = db.execute(
        text(f"{_CYCLE} WHERE member_id = :id AND state = 'open'{' FOR UPDATE' if lock else ''}"), {"id": member_id}
    ).mappings().one_or_none()
    return Cycle(**row) if row else None


def history(db: Session, member_id: uuid.UUID, limit: int = 10) -> list[Cycle]:
    """Newest first."""
    rows = db.execute(
        text(f"{_CYCLE} WHERE member_id = :id ORDER BY created_at DESC LIMIT :limit"), {"id": member_id, "limit": limit}
    ).mappings()
    return [Cycle(**row) for row in rows]


def insert(db: Session, member_id: uuid.UUID, due_on: date, opened_on: date) -> None:
    """A second open cycle is refused by the unique index; doing nothing then is the right answer."""
    db.execute(
        text(
            """
            INSERT INTO membership.renewal_cycle (member_id, due_on, opened_on) VALUES (:id, :due_on, :opened_on)
            ON CONFLICT (member_id) WHERE state = 'open' DO NOTHING
            """
        ),
        {"id": member_id, "due_on": due_on, "opened_on": opened_on},
    )


def confirm(db: Session, cycle_id: uuid.UUID, area_confirmation: str) -> None:
    db.execute(
        text(
            """
            UPDATE membership.renewal_cycle
            SET state = 'confirmed', confirmed_at = clock_timestamp(), area_confirmation = :area
            WHERE id = :id AND state = 'open'
            """
        ),
        {"id": cycle_id, "area": area_confirmation},
    )


def mark_notice(db: Session, cycle_id: uuid.UUID, days: int, now: datetime) -> None:
    column = "notice_7_at" if days == 7 else "notice_30_at"
    db.execute(text(f"UPDATE membership.renewal_cycle SET {column} = :now WHERE id = :id"), {"id": cycle_id, "now": now})


def mark_lapsed(db: Session, cycle_id: uuid.UUID, now: datetime) -> None:
    db.execute(
        text("UPDATE membership.renewal_cycle SET state = 'lapsed', lapsed_at = :now WHERE id = :id AND state = 'open'"),
        {"id": cycle_id, "now": now},
    )


def last_lapsed(db: Session, member_id: uuid.UUID) -> Cycle | None:
    row = db.execute(
        text(f"{_CYCLE} WHERE member_id = :id AND state = 'lapsed' ORDER BY lapsed_at DESC LIMIT 1"), {"id": member_id}
    ).mappings().one_or_none()
    return Cycle(**row) if row else None


def active_since(db: Session, member_id: uuid.UUID) -> date | None:
    """When the current membership began: its last activation (a reinstatement after a suspension
    keeps the yearly date), else when the state was recorded, else when the account was made."""
    moment = db.scalar(
        text(
            """
            SELECT COALESCE(
                (SELECT max(changed_at) FROM membership.membership_change WHERE member_id = :id AND action = 'activate'),
                (SELECT changed_at FROM membership.membership WHERE member_id = :id AND state = 'active'),
                (SELECT created_at FROM npm.member WHERE id = :id)
            )
            """
        ),
        {"id": member_id},
    )
    return moment.date() if moment else None


def active_members_without_cycle(db: Session, limit: int) -> list[uuid.UUID]:
    """Active members whose yearly cycle has not been opened yet, for the nightly task."""
    return list(
        db.scalars(
            text(
                """
                SELECT ms.member_id FROM membership.membership ms
                JOIN npm.member m ON m.id = ms.member_id AND m.deleted_at IS NULL
                WHERE ms.state = 'active'
                  AND NOT EXISTS (SELECT 1 FROM membership.renewal_cycle c WHERE c.member_id = ms.member_id AND c.state = 'open')
                ORDER BY ms.member_id
                LIMIT :limit
                """
            ),
            {"limit": limit},
        )
    )


def open_cycles_for_notices(db: Session, today: date, limit: int) -> list[Cycle]:
    """Open cycles of Active members falling due within 30 days that still miss a notice. Locked,
    skipping rows another run holds, so two runs never send the same notice."""
    rows = db.execute(
        text(
            f"""{_CYCLE.replace('FROM membership.renewal_cycle', 'FROM membership.renewal_cycle c')}
            WHERE c.state = 'open' AND c.due_on BETWEEN :today AND :horizon
              AND (c.notice_30_at IS NULL OR c.notice_7_at IS NULL)
              AND EXISTS (SELECT 1 FROM membership.membership ms WHERE ms.member_id = c.member_id AND ms.state = 'active')
            ORDER BY c.due_on LIMIT :limit FOR UPDATE SKIP LOCKED"""
        ),
        {"today": today, "horizon": today + timedelta(days=OPENS_DAYS_BEFORE), "limit": limit},
    ).mappings()
    return [Cycle(**row) for row in rows]


def open_cycles_past_grace(db: Session, today: date, limit: int) -> list[Cycle]:
    rows = db.execute(
        text(
            f"""{_CYCLE.replace('FROM membership.renewal_cycle', 'FROM membership.renewal_cycle c')}
            WHERE c.state = 'open' AND c.due_on < :cutoff
              AND EXISTS (SELECT 1 FROM membership.membership ms WHERE ms.member_id = c.member_id AND ms.state = 'active')
            ORDER BY c.due_on LIMIT :limit FOR UPDATE SKIP LOCKED"""
        ),
        {"cutoff": today - timedelta(days=GRACE_DAYS), "limit": limit},
    ).mappings()
    return [Cycle(**row) for row in rows]


# --- D25: the due list ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class DueMember:
    member_id: uuid.UUID
    member_code: str
    full_name: str
    area_key: str
    due_on: date
    state: str
    notice_30_at: datetime | None
    notice_7_at: datetime | None
    lapsed_at: datetime | None


def _phase_condition(phase: str | None) -> str:
    """The SQL for one phase, matching rules.phase(); lapsed means recorded by the task."""
    return {
        "upcoming": "c.state = 'open' AND c.due_on > :today + :opens",
        "due": "c.state = 'open' AND c.due_on BETWEEN :today AND :today + :opens",
        "grace": "c.state = 'open' AND c.due_on < :today",
        "lapsed": "c.state = 'lapsed' AND ms.state = 'inactive' AND ms.reason_code = 'renewal_lapsed'",
    }.get(phase or "", "(c.state = 'open' OR (c.state = 'lapsed' AND ms.state = 'inactive'))")


def due_list(db: Session, *, areas: list[str] | None, phase: str | None, today: date, limit: int) -> list[DueMember]:
    """The latest cycle of each member in the areas, soonest due first."""
    params: dict[str, Any] = {"today": today, "opens": OPENS_DAYS_BEFORE, "limit": limit}
    area_condition = ""
    if areas is not None:
        area_condition = "AND areas.keys && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(
            f"""
            SELECT m.id AS member_id, m.member_code, m.full_name, areas.keys[cardinality(areas.keys)] AS area_key,
                   c.due_on, c.state, c.notice_30_at, c.notice_7_at, c.lapsed_at
            FROM membership.renewal_cycle c
            JOIN npm.member m ON m.id = c.member_id AND m.deleted_at IS NULL
            JOIN membership.membership ms ON ms.member_id = m.id
            LEFT JOIN geo.district d ON d.district_code = m.district_code
            {_AREA_KEYS}
            WHERE {_phase_condition(phase)} {area_condition}
              AND (c.state = 'lapsed' OR ms.state = 'active')
              AND c.created_at = (SELECT max(created_at) FROM membership.renewal_cycle x WHERE x.member_id = c.member_id)
            ORDER BY c.due_on, m.member_code
            LIMIT :limit
            """
        ),
        params,
    ).mappings()
    return [DueMember(**row) for row in rows]
