"""SQL for the ballot box: participation records, anonymous ballots and the chain head.

Every function opens the row-level firewall for its own transaction first; without that the ballot
schema is invisible to the database session (Alembic 0046, FR-PBG-010). Nothing here joins a
participation row to a ballot row, and nothing returns a ballot to anyone but the recount.
"""

import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.engagement.budgeting.rules import StoredBallot


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('ballot.firewall', 'open', true)"))


def start_chain(db: Session, cycle_id: uuid.UUID, genesis: str) -> None:
    _open(db)
    db.execute(
        text("INSERT INTO ballot.chain (cycle_id, length, head_hash) VALUES (:c, 0, :h) ON CONFLICT (cycle_id) DO NOTHING"),
        {"c": cycle_id, "h": genesis},
    )


def lock_chain(db: Session, cycle_id: uuid.UUID) -> tuple[int, str] | None:
    """(length, head hash), locked until commit so ballots are chained one at a time."""
    _open(db)
    row = db.execute(
        text("SELECT length, head_hash FROM ballot.chain WHERE cycle_id = :c FOR UPDATE"), {"c": cycle_id}
    ).one_or_none()
    return (row.length, row.head_hash) if row else None


def participated_on(db: Session, cycle_id: uuid.UUID, member_id: uuid.UUID) -> date | None:
    _open(db)
    return db.scalar(
        text("SELECT participated_on FROM ballot.participation WHERE cycle_id = :c AND member_id = :m"),
        {"c": cycle_id, "m": member_id},
    )


def record_participation(db: Session, cycle_id: uuid.UUID, member_id: uuid.UUID, day: date, receipt_hash: str) -> bool:
    """FR-PBG-004: False when the member already took part (the primary key refuses a second row)."""
    _open(db)
    inserted = db.scalar(
        text(
            """INSERT INTO ballot.participation (cycle_id, member_id, participated_on, receipt_code_hash)
               VALUES (:c, :m, :d, :r) ON CONFLICT (cycle_id, member_id) DO NOTHING RETURNING member_id"""
        ),
        {"c": cycle_id, "m": member_id, "d": day, "r": receipt_hash},
    )
    return inserted is not None


def append_ballot(db: Session, cycle_id: uuid.UUID, ballot: StoredBallot) -> None:
    """The caller holds the chain lock (lock_chain) and passes the next position and hashes."""
    _open(db)
    db.execute(
        text(
            """INSERT INTO ballot.ballot (ballot_id, cycle_id, position, choices, receipt_hash, prev_hash, ballot_hash)
               VALUES (:id, :c, :position, :choices, :receipt, :prev, :hash)"""
        ),
        {"id": ballot.ballot_id, "c": cycle_id, "position": ballot.position, "choices": ballot.choices,
         "receipt": ballot.receipt_hash, "prev": ballot.prev_hash, "hash": ballot.ballot_hash},
    )
    db.execute(
        text("UPDATE ballot.chain SET length = :n, head_hash = :h WHERE cycle_id = :c"),
        {"n": ballot.position, "h": ballot.ballot_hash, "c": cycle_id},
    )


def ballots(db: Session, cycle_id: uuid.UUID) -> list[StoredBallot]:
    """For the recount only (FR-PBG-006); the API never returns a ballot."""
    _open(db)
    rows = db.execute(
        text("""SELECT ballot_id, position, choices, receipt_hash, prev_hash, ballot_hash FROM ballot.ballot
                WHERE cycle_id = :c ORDER BY position"""),
        {"c": cycle_id},
    ).mappings()
    return [StoredBallot(**{**row, "choices": list(row["choices"])}) for row in rows]


def counts(db: Session, cycle_id: uuid.UUID) -> tuple[int, int]:
    """(participation records, ballots): equal unless something is wrong, which blocks certification."""
    _open(db)
    row = db.execute(
        text("""SELECT (SELECT count(*) FROM ballot.participation WHERE cycle_id = :c) AS took_part,
                       (SELECT count(*) FROM ballot.ballot WHERE cycle_id = :c) AS ballots"""),
        {"c": cycle_id},
    ).one()
    return int(row.took_part), int(row.ballots)


def ballot_with_receipt(db: Session, cycle_id: uuid.UUID, receipt_hash: str) -> bool:
    _open(db)
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM ballot.ballot WHERE cycle_id = :c AND receipt_hash = :r)"),
            {"c": cycle_id, "r": receipt_hash},
        )
    )


def participation_with_receipt(db: Session, cycle_id: uuid.UUID, member_id: uuid.UUID, receipt_hash: str) -> bool:
    _open(db)
    return bool(
        db.scalar(
            text("""SELECT EXISTS (SELECT 1 FROM ballot.participation
                                   WHERE cycle_id = :c AND member_id = :m AND receipt_code_hash = :r)"""),
            {"c": cycle_id, "m": member_id, "r": receipt_hash},
        )
    )


def reorder_participation(db: Session, cycle_id: uuid.UUID) -> int:
    """When voting closes, write the cycle's participation rows again in member-id order (random,
    since ids are random), so the order they were stored in, which follows the order people voted,
    no longer sits beside the chain's order of ballots. Returns the rows rewritten."""
    _open(db)
    db.execute(text("SELECT set_config('ballot.maintenance', 'on', true)"))
    rows = db.execute(
        text("""DELETE FROM ballot.participation WHERE cycle_id = :c
                RETURNING member_id, participated_on, receipt_code_hash"""),
        {"c": cycle_id},
    ).all()
    for row in sorted(rows, key=lambda r: str(r.member_id)):
        db.execute(
            text("""INSERT INTO ballot.participation (cycle_id, member_id, participated_on, receipt_code_hash)
                    VALUES (:c, :m, :d, :r)"""),
            {"c": cycle_id, "m": row.member_id, "d": row.participated_on, "r": row.receipt_code_hash},
        )
    db.execute(text("SELECT set_config('ballot.maintenance', 'off', true)"))
    return len(rows)


def purge(db: Session, cycle_id: uuid.UUID) -> tuple[int, int]:
    """ENT-46, ENT-47: 12 months after certification only the published totals remain."""
    _open(db)
    db.execute(text("SELECT set_config('ballot.maintenance', 'on', true)"))
    took_part = db.execute(text("DELETE FROM ballot.participation WHERE cycle_id = :c"), {"c": cycle_id}).rowcount
    cast = db.execute(text("DELETE FROM ballot.ballot WHERE cycle_id = :c"), {"c": cycle_id}).rowcount
    db.execute(text("SELECT set_config('ballot.maintenance', 'off', true)"))
    return int(took_part or 0), int(cast or 0)
