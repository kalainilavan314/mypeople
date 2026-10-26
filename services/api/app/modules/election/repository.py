"""SQL for election periods and notices (election.period and election.notice, Alembic revision 0018)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredPeriod:
    id: uuid.UUID
    period_ref: str
    election_type: str
    title_en: str
    title_ta: str
    area_key: str
    area_path: list[str]
    starts_at: datetime
    ends_at: datetime
    silence_starts_at: datetime
    silence_ends_at: datetime
    polling_day: date
    source_url: str
    source_reference: str
    source_published_at: datetime
    state: str
    declared_at: datetime
    closed_at: datetime | None


@dataclass(frozen=True)
class StoredNotice:
    id: uuid.UUID
    period_id: uuid.UUID
    source: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    source_url: str | None
    document_reference: str | None
    source_published_at: datetime | None
    published_at: datetime
    withdrawn_at: datetime | None


_PERIOD = """
    SELECT id, period_ref, election_type, title_en, title_ta, area_key, area_path, starts_at, ends_at,
           silence_starts_at, silence_ends_at, polling_day, source_url, source_reference, source_published_at,
           state, declared_at, closed_at
    FROM election.period
"""

_NOTICE = """
    SELECT id, period_id, source, title_en, title_ta, body_en, body_ta, source_url, document_reference,
           source_published_at, published_at, withdrawn_at
    FROM election.notice
"""

# A period applies to a place when either area contains the other (as access.rules.overlaps).
_OVERLAPS = "(area_key = ANY(CAST(:path AS text[])) OR :leaf = ANY(area_path))"


def insert_period(db: Session, details: dict[str, Any], area_key: str, area_path: list[str], member_id: uuid.UUID) -> StoredPeriod:
    period_id = db.scalar(
        text(
            """
            INSERT INTO election.period (election_type, title_en, title_ta, area_key, area_path, starts_at, ends_at,
                                         silence_starts_at, silence_ends_at, polling_day, source_url,
                                         source_reference, source_published_at, declared_by)
            VALUES (:election_type, :title_en, :title_ta, :area_key, :area_path, :starts_at, :ends_at,
                    :silence_starts_at, :silence_ends_at, :polling_day, :source_url, :source_reference,
                    :source_published_at, :member)
            RETURNING id
            """
        ),
        {**details, "area_key": area_key, "area_path": area_path, "member": member_id},
    )
    period = find_period(db, period_id)
    assert period is not None
    return period


def find_period(db: Session, period_id: uuid.UUID, *, for_update: bool = False) -> StoredPeriod | None:
    lock = " FOR UPDATE" if for_update else ""
    row = db.execute(text(f"{_PERIOD} WHERE id = :id{lock}"), {"id": period_id}).mappings().one_or_none()
    return StoredPeriod(**row) if row else None


def periods(db: Session, states: list[str], limit: int) -> list[StoredPeriod]:
    rows = db.execute(
        text(f"{_PERIOD} WHERE state = ANY(CAST(:states AS text[])) ORDER BY starts_at DESC LIMIT :limit"),
        {"states": states, "limit": limit},
    ).mappings()
    return [StoredPeriod(**row) for row in rows]


def overlapping(
    db: Session, area_path: list[str], starts_at: datetime, ends_at: datetime, *, exclude: uuid.UUID | None = None
) -> list[str]:
    """Refs of declared periods for an overlapping area and time (D22's overlap warning)."""
    return list(
        db.scalars(
            text(
                f"""
                SELECT period_ref FROM election.period
                WHERE state = 'declared' AND {_OVERLAPS} AND starts_at < :ends AND ends_at > :starts
                  AND id IS DISTINCT FROM :exclude
                ORDER BY period_ref
                """
            ),
            {"path": area_path, "leaf": area_path[-1], "starts": starts_at, "ends": ends_at, "exclude": exclude},
        )
    )


def silences(db: Session, area_path: list[str], starts_at: datetime, ends_at: datetime) -> list[str]:
    """Refs of declared periods whose silence window overlaps the place and the time span.
    A single moment is a span with starts_at == ends_at."""
    return list(
        db.scalars(
            text(
                f"""
                SELECT period_ref FROM election.period
                WHERE state = 'declared' AND {_OVERLAPS}
                  AND silence_starts_at <= :ends AND silence_ends_at > :starts
                ORDER BY period_ref
                """
            ),
            {"path": area_path, "leaf": area_path[-1], "starts": starts_at, "ends": ends_at},
        )
    )


def current_for(db: Session, area_path: list[str], now: datetime) -> list[StoredPeriod]:
    """Periods running now whose area contains the member's, the soonest polling day first. A member
    with no known area sees only platform-wide ones."""
    rows = db.execute(
        text(
            f"""
            {_PERIOD}
            WHERE state = 'declared' AND area_key = ANY(CAST(:path AS text[])) AND starts_at <= :now AND ends_at > :now
            ORDER BY polling_day, period_ref
            """
        ),
        {"path": area_path, "now": now},
    ).mappings()
    return [StoredPeriod(**row) for row in rows]


def close_period(db: Session, period_id: uuid.UUID, state: str, reason: str, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE election.period
            SET state = :state, close_reason = :reason, closed_by = :member, closed_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": period_id, "state": state, "reason": reason, "member": member_id},
    )


def insert_notice(db: Session, period_id: uuid.UUID, details: dict[str, Any], member_id: uuid.UUID) -> StoredNotice:
    notice_id = db.scalar(
        text(
            """
            INSERT INTO election.notice (period_id, source, title_en, title_ta, body_en, body_ta, source_url,
                                         document_reference, source_published_at, published_by)
            VALUES (:period, :source, :title_en, :title_ta, :body_en, :body_ta, :source_url, :document_reference,
                    :source_published_at, :member)
            RETURNING id
            """
        ),
        {**details, "period": period_id, "member": member_id},
    )
    notice = find_notice(db, notice_id)
    assert notice is not None
    return notice


def find_notice(db: Session, notice_id: uuid.UUID, *, for_update: bool = False) -> StoredNotice | None:
    lock = " FOR UPDATE" if for_update else ""
    row = db.execute(text(f"{_NOTICE} WHERE id = :id{lock}"), {"id": notice_id}).mappings().one_or_none()
    return StoredNotice(**row) if row else None


def notices(db: Session, period_ids: list[uuid.UUID], *, include_withdrawn: bool) -> list[StoredNotice]:
    withdrawn = "" if include_withdrawn else " AND withdrawn_at IS NULL"
    rows = db.execute(
        text(f"{_NOTICE} WHERE period_id = ANY(CAST(:ids AS uuid[])){withdrawn} ORDER BY published_at DESC"),
        {"ids": period_ids},
    ).mappings()
    return [StoredNotice(**row) for row in rows]


def withdraw_notice(db: Session, notice_id: uuid.UUID) -> None:
    db.execute(text("UPDATE election.notice SET withdrawn_at = clock_timestamp() WHERE id = :id"), {"id": notice_id})
