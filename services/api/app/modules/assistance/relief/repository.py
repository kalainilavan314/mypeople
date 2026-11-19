"""SQL for relief stock and distributions (Alembic 0048). Every function opens the relief firewall for its own
transaction first: without that, relief rows are invisible to the database session, so no other module,
report or ad-hoc join can read who received relief (FR-DIS-005)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('relief.firewall', 'open', true)"))


def lock_store_item(db: Session, store_key: str, item: str) -> None:
    """One handing-out at a time per store and item, so two officers cannot both take the last sacks."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('relief:' || :store || ':' || :item))"),
               {"store": store_key, "item": item})


def balance(db: Session, store_key: str, item: str) -> int:
    _open(db)
    return int(db.scalar(
        text("""SELECT COALESCE((SELECT sum(quantity) FROM relief.supply WHERE store_key = :s AND item = :i), 0)
                     - COALESCE((SELECT sum(quantity) FROM relief.distribution WHERE store_key = :s AND item = :i), 0)"""),
        {"s": store_key, "i": item},
    ) or 0)


@dataclass(frozen=True)
class StockLine:
    store_key: str
    item: str
    received: int
    handed_out: int


def stock(db: Session, areas: list[str] | None) -> list[StockLine]:
    """Received and handed out per store and item, for the stores in these areas (None: all)."""
    _open(db)
    condition, params = "TRUE", {}
    if areas is not None:
        condition = "store_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"""
            WITH moves AS (
                SELECT store_key, item, quantity AS received, 0 AS handed_out FROM relief.supply WHERE {condition}
                UNION ALL
                SELECT store_key, item, 0, quantity FROM relief.distribution WHERE {condition}
            )
            SELECT store_key, item, sum(received)::int AS received, sum(handed_out)::int AS handed_out
            FROM moves GROUP BY store_key, item ORDER BY store_key, item
        """),
        params,
    ).mappings()
    return [StockLine(**row) for row in rows]


@dataclass(frozen=True)
class Supply:
    id: uuid.UUID
    store_key: str
    item: str
    quantity: int
    supplier: str
    received_on: date
    alert_id: uuid.UUID | None
    created_at: datetime


def insert_supply(db: Session, *, store_key: str, store_path: list[str], item: str, quantity: int, supplier: str,
                  received_on: date, alert_id: uuid.UUID | None, by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO relief.supply (store_key, store_path, item, quantity, supplier, received_on, alert_id, recorded_by)
                VALUES (:store, :path, :item, :q, :supplier, :on, :alert, :by) RETURNING id"""),
        {"store": store_key, "path": store_path, "item": item, "q": quantity, "supplier": supplier, "on": received_on,
         "alert": alert_id, "by": by},
    )


def supplies(db: Session, areas: list[str] | None, limit: int = 100) -> list[Supply]:
    _open(db)
    condition, params = "TRUE", {"limit": limit}
    if areas is not None:
        condition = "store_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"""SELECT id, store_key, item, quantity, supplier, received_on, alert_id, created_at FROM relief.supply
                 WHERE {condition} ORDER BY created_at DESC LIMIT :limit"""),
        params,
    ).mappings()
    return [Supply(**row) for row in rows]


@dataclass(frozen=True)
class Distribution:
    id: uuid.UUID
    distribution_ref: str
    store_key: str
    area_key: str
    item: str
    quantity: int
    recipient_kind: str
    case_id: uuid.UUID | None
    group_site: str | None
    households: int | None
    evidence: str
    delivered_on: date
    alert_id: uuid.UUID | None
    created_at: datetime


_DISTRIBUTION = """SELECT id, distribution_ref, store_key, area_key, item, quantity, recipient_kind, case_id, group_site,
                          households, evidence, delivered_on, alert_id, created_at FROM relief.distribution"""


def insert_distribution(db: Session, values: dict[str, Any], by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO relief.distribution (store_key, store_path, area_key, area_path, item, quantity, recipient_kind,
                                                 case_id, group_site, households, evidence, delivered_on, alert_id, recorded_by)
                VALUES (:store_key, :store_path, :area_key, :area_path, :item, :quantity, :recipient_kind, :case_id,
                        :group_site, :households, :evidence, :delivered_on, :alert_id, :by)
                RETURNING id"""),
        {**values, "by": by},
    )


def find_distribution(db: Session, distribution_id: uuid.UUID) -> Distribution | None:
    _open(db)
    row = db.execute(text(f"{_DISTRIBUTION} WHERE id = :id"), {"id": distribution_id}).mappings().one_or_none()
    return Distribution(**row) if row else None


def distributions(db: Session, areas: list[str] | None, limit: int = 100) -> list[Distribution]:
    _open(db)
    condition, params = "TRUE", {"limit": limit}
    if areas is not None:
        condition = "(area_path && CAST(:areas AS text[]) OR store_path && CAST(:areas AS text[]))"
        params["areas"] = areas or ["none"]
    rows = db.execute(text(f"{_DISTRIBUTION} WHERE {condition} ORDER BY created_at DESC LIMIT :limit"), params).mappings()
    return [Distribution(**row) for row in rows]
