"""SQL for staff broadcasts (notifications.broadcast, Alembic revision 0017)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredBroadcast:
    id: uuid.UUID
    broadcast_ref: str
    topic: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    area_level: str
    area_key: str
    area_path: list[str]
    state: str
    send_at: datetime | None
    created_by: uuid.UUID
    submitted_by: uuid.UUID | None
    approved_by: uuid.UUID | None
    sent_at: datetime | None
    recipients: int | None


EDITABLE = ("topic", "title_en", "title_ta", "body_en", "body_ta")

_SELECT = """
    SELECT id, broadcast_ref, topic, title_en, title_ta, body_en, body_ta, area_level, area_key, area_path, state,
           send_at, created_by, submitted_by, approved_by, sent_at, recipients
    FROM notifications.broadcast
"""


def insert(
    db: Session, *, details: dict[str, Any], area_level: str, area_key: str, area_path: list[str], created_by: uuid.UUID
) -> StoredBroadcast:
    broadcast_id = db.scalar(
        text(
            """
            INSERT INTO notifications.broadcast (topic, title_en, title_ta, body_en, body_ta, area_level, area_key,
                                                 area_path, created_by)
            VALUES (:topic, :title_en, :title_ta, :body_en, :body_ta, :level, :key, :path, :member) RETURNING id
            """
        ),
        {**details, "level": area_level, "key": area_key, "path": area_path, "member": created_by},
    )
    stored = find(db, broadcast_id)
    assert stored is not None
    return stored


def find(db: Session, broadcast_id: uuid.UUID, *, for_update: bool = False) -> StoredBroadcast | None:
    lock = " FOR UPDATE" if for_update else ""
    row = db.execute(text(f"{_SELECT} WHERE id = :id{lock}"), {"id": broadcast_id}).mappings().one_or_none()
    return StoredBroadcast(**row) if row else None


def update(db: Session, broadcast_id: uuid.UUID, details: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in details)
    db.execute(text(f"UPDATE notifications.broadcast SET {assignments} WHERE id = :id"), {**details, "id": broadcast_id})


def set_state(db: Session, broadcast_id: uuid.UUID, state: str, **columns: Any) -> None:
    extra = "".join(f", {name} = :{name}" for name in columns)
    db.execute(
        text(f"UPDATE notifications.broadcast SET state = :state{extra} WHERE id = :id"),
        {"id": broadcast_id, "state": state, **columns},
    )


def managed(db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int) -> list[StoredBroadcast]:
    conditions = ["state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit}
    if visible_areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY created_at DESC LIMIT :limit"), params
    ).mappings()
    return [StoredBroadcast(**row) for row in rows]


def due(db: Session, now: datetime) -> list[uuid.UUID]:
    return list(
        db.scalars(
            text(
                """
                SELECT id FROM notifications.broadcast WHERE state = 'scheduled' AND COALESCE(send_at, :now) <= :now
                ORDER BY send_at NULLS FIRST
                FOR UPDATE SKIP LOCKED
                """
            ),
            {"now": now},
        )
    )


# Members of an area, from the columns both APIs keep on npm.member.
_IN_AREA = {
    "platform": "TRUE",
    "province": "m.district_code IN (SELECT district_code FROM geo.district WHERE province_code = :code)",
    "district": "m.district_code = :code",
    "ds": "COALESCE(m.ds_code, (SELECT g.ds_code FROM geo.gn_division g WHERE g.gn_code = m.gs_code)) = :code",
    "gn": "m.gs_code = :code",
}


def _area_code(area_key: str) -> str | None:
    return None if area_key == "platform" else area_key.split(":", 1)[1]


def recipients(db: Session, area_level: str, area_key: str) -> int:
    return db.scalar(
        text(f"SELECT count(*) FROM npm.member m WHERE m.deleted_at IS NULL AND {_IN_AREA[area_level]}"),
        {"code": _area_code(area_key)},
    )


def fan_out(db: Session, broadcast: StoredBroadcast) -> int:
    """An inbox item for every member in the area, in one statement; returns how many."""
    return db.execute(
        text(
            f"""
            INSERT INTO notifications.notification (member_id, topic, template, title_en, title_ta, body_en, body_ta,
                                                    target_kind, target_id, urgent, broadcast_id)
            SELECT m.id, :topic, 'broadcast', :title_en, :title_ta, :body_en, :body_ta, 'broadcast', :id,
                   :urgent, :id
            FROM npm.member m WHERE m.deleted_at IS NULL AND {_IN_AREA[broadcast.area_level]}
            """
        ),
        {
            "topic": broadcast.topic,
            "title_en": broadcast.title_en,
            "title_ta": broadcast.title_ta,
            "body_en": broadcast.body_en,
            "body_ta": broadcast.body_ta,
            "id": broadcast.id,
            "urgent": broadcast.topic == "emergency",
            "code": _area_code(broadcast.area_key),
        },
    ).rowcount
