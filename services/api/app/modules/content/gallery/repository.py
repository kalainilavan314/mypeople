"""SQL for gallery albums, photos and removal requests (Alembic revision 0015)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class StoredAlbum:
    id: uuid.UUID
    album_ref: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    category: str
    place: str
    album_date: date
    publisher: str
    event_id: uuid.UUID | None
    area_key: str
    area_path: list[str]
    state: str
    return_note: str | None
    created_by: uuid.UUID
    submitted_by: uuid.UUID | None
    published_at: datetime | None
    photo_count: int  # photos not removed
    cover_photo_id: uuid.UUID | None  # the first photo still shown or blurred


# The details a media officer edits in a draft.
EDITABLE = ("title_en", "title_ta", "summary_en", "summary_ta", "category", "place", "album_date", "publisher", "event_id")

_SELECT = """
    SELECT a.id, a.album_ref, a.title_en, a.title_ta, a.summary_en, a.summary_ta, a.category, a.place, a.album_date,
           a.publisher, a.event_id, a.area_key, a.area_path, a.state, a.return_note, a.created_by, a.submitted_by,
           a.published_at,
           (SELECT count(*) FROM content.photo p WHERE p.album_id = a.id AND p.state <> 'removed')::int AS photo_count,
           (SELECT p.id FROM content.photo p WHERE p.album_id = a.id AND p.state <> 'removed'
            ORDER BY p.position LIMIT 1) AS cover_photo_id
    FROM content.album a
"""


def _album(row: Any) -> StoredAlbum:
    return StoredAlbum(**row)


def insert_album(
    db: Session, *, details: dict[str, Any], area_key: str, area_path: list[str], created_by: uuid.UUID
) -> StoredAlbum:
    columns = ", ".join(EDITABLE)
    values = ", ".join(f":{name}" for name in EDITABLE)
    album_id = db.scalar(
        text(
            f"""
            INSERT INTO content.album ({columns}, area_key, area_path, created_by)
            VALUES ({values}, :area_key, :area_path, :member) RETURNING id
            """
        ),
        {**details, "area_key": area_key, "area_path": area_path, "member": created_by},
    )
    stored = find_album(db, album_id)
    assert stored is not None
    return stored


def find_album(db: Session, album_id: uuid.UUID, *, for_update: bool = False) -> StoredAlbum | None:
    if for_update:
        db.execute(text("SELECT 1 FROM content.album WHERE id = :id FOR UPDATE"), {"id": album_id})
    row = db.execute(text(f"{_SELECT} WHERE a.id = :id"), {"id": album_id}).mappings().one_or_none()
    return _album(row) if row else None


def find_album_by_ref(db: Session, album_ref: str) -> StoredAlbum | None:
    row = db.execute(text(f"{_SELECT} WHERE a.album_ref = :ref"), {"ref": album_ref}).mappings().one_or_none()
    return _album(row) if row else None


def update_album(db: Session, album_id: uuid.UUID, details: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in details)
    db.execute(text(f"UPDATE content.album SET {assignments} WHERE id = :id"), {**details, "id": album_id})


def submit(db: Session, album_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE content.album SET state = 'submitted', submitted_by = :member, submitted_at = clock_timestamp(),
                   return_note = NULL
            WHERE id = :id
            """
        ),
        {"id": album_id, "member": member_id},
    )


def publish(db: Session, album_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE content.album SET state = 'published', published_by = :member, published_at = clock_timestamp()
            WHERE id = :id
            """
        ),
        {"id": album_id, "member": member_id},
    )


def return_to_draft(db: Session, album_id: uuid.UUID, note: str) -> None:
    db.execute(
        text("UPDATE content.album SET state = 'draft', return_note = :note WHERE id = :id"),
        {"id": album_id, "note": note},
    )


def published_albums(db: Session, *, category: str | None, search: str | None, limit: int) -> list[StoredAlbum]:
    """Newest first (G01)."""
    conditions = ["a.state = 'published'"]
    params: dict[str, Any] = {"limit": limit}
    if category is not None:
        conditions.append("a.category = :category")
        params["category"] = category
    if search:
        conditions.append("(a.title_en ILIKE :search OR a.title_ta ILIKE :search OR a.place ILIKE :search)")
        params["search"] = "%" + search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY a.album_date DESC, a.album_ref DESC LIMIT :limit"),
        params,
    ).mappings()
    return [_album(row) for row in rows]


def managed_albums(db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int, offset: int = 0) -> list[StoredAlbum]:
    conditions = ["a.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit, "offset": offset}
    if visible_areas is not None:
        conditions.append("a.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY a.created_at DESC, a.id DESC LIMIT :limit OFFSET :offset"), params
    ).mappings()
    return [_album(row) for row in rows]


def event_state(db: Session, event_id: uuid.UUID) -> str | None:
    return db.scalar(text("SELECT state FROM events.event WHERE id = :id"), {"id": event_id})


def event_titles(db: Session, event_id: uuid.UUID) -> tuple[str, str] | None:
    row = db.execute(text("SELECT title_en, title_ta FROM events.event WHERE id = :id"), {"id": event_id}).one_or_none()
    return (row.title_en, row.title_ta) if row else None


# --- Photos ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredPhoto:
    id: uuid.UUID
    album_id: uuid.UUID
    position: int
    caption_en: str
    caption_ta: str
    width: int
    height: int
    state: str


_PHOTO = "SELECT id, album_id, position, caption_en, caption_ta, width, height, state FROM content.photo"


def insert_photo(
    db: Session, *, photo_id: uuid.UUID, album_id: uuid.UUID, width: int, height: int, created_by: uuid.UUID
) -> StoredPhoto:
    """Added after the album's last photo; the album row is locked by the caller."""
    db.execute(
        text(
            """
            INSERT INTO content.photo (id, album_id, position, width, height, created_by)
            SELECT :id, :album, COALESCE(max(position), 0) + 1, :width, :height, :member
            FROM content.photo WHERE album_id = :album
            """
        ),
        {"id": photo_id, "album": album_id, "width": width, "height": height, "member": created_by},
    )
    stored = find_photo(db, photo_id)
    assert stored is not None
    return stored


def find_photo(db: Session, photo_id: uuid.UUID) -> StoredPhoto | None:
    row = db.execute(text(f"{_PHOTO} WHERE id = :id"), {"id": photo_id}).mappings().one_or_none()
    return StoredPhoto(**row) if row else None


def album_photos(db: Session, album_id: uuid.UUID) -> list[StoredPhoto]:
    """The photos still shown or blurred, in order."""
    rows = db.execute(
        text(f"{_PHOTO} WHERE album_id = :album AND state <> 'removed' ORDER BY position"), {"album": album_id}
    ).mappings()
    return [StoredPhoto(**row) for row in rows]


def photo_at(db: Session, album_id: uuid.UUID, number: int) -> StoredPhoto | None:
    """The photo a person sees as number n (counting from 1) in the album's grid."""
    photos = album_photos(db, album_id)
    return photos[number - 1] if 1 <= number <= len(photos) else None


def update_captions(db: Session, photo_id: uuid.UUID, captions: dict[str, str]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in captions)
    db.execute(text(f"UPDATE content.photo SET {assignments} WHERE id = :id"), {**captions, "id": photo_id})


def delete_photo(db: Session, photo_id: uuid.UUID) -> None:
    db.execute(text("DELETE FROM content.photo WHERE id = :id"), {"id": photo_id})


def set_photo_state(db: Session, photo_id: uuid.UUID, state: str) -> None:
    db.execute(text("UPDATE content.photo SET state = :state WHERE id = :id"), {"id": photo_id, "state": state})


# --- Removal requests -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredRequest:
    id: uuid.UUID
    request_ref: str
    photo_id: uuid.UUID
    album_id: uuid.UUID
    album_ref: str
    reason: str
    note: str
    requester_id: uuid.UUID | None
    contact: str | None
    area_path: list[str]
    state: str
    decision_reason: str | None
    created_at: datetime
    due_at: datetime
    decided_at: datetime | None


_REQUEST = """
    SELECT r.id, r.request_ref, r.photo_id, p.album_id, a.album_ref, r.reason, r.note, r.requester_id, r.contact,
           r.area_path, r.state, r.decision_reason, r.created_at, r.due_at, r.decided_at
    FROM content.removal_request r
    JOIN content.photo p ON p.id = r.photo_id
    JOIN content.album a ON a.id = p.album_id
"""


def insert_request(
    db: Session,
    *,
    photo_id: uuid.UUID,
    reason: str,
    note: str,
    requester_id: uuid.UUID | None,
    contact: str | None,
    ip: str,
    area_path: list[str],
) -> StoredRequest:
    request_id = db.scalar(
        text(
            """
            INSERT INTO content.removal_request (photo_id, reason, note, requester_id, contact, requester_ip, area_path)
            VALUES (:photo, :reason, :note, :requester, :contact, :ip, :area_path) RETURNING id
            """
        ),
        {
            "photo": photo_id,
            "reason": reason,
            "note": note,
            "requester": requester_id,
            "contact": contact,
            "ip": ip,
            "area_path": area_path,
        },
    )
    stored = find_request(db, request_id)
    assert stored is not None
    return stored


def find_request(db: Session, request_id: uuid.UUID, *, for_update: bool = False) -> StoredRequest | None:
    if for_update:
        db.execute(text("SELECT 1 FROM content.removal_request WHERE id = :id FOR UPDATE"), {"id": request_id})
    row = db.execute(text(f"{_REQUEST} WHERE r.id = :id"), {"id": request_id}).mappings().one_or_none()
    return StoredRequest(**row) if row else None


def open_request_of(db: Session, photo_id: uuid.UUID, member_id: uuid.UUID) -> StoredRequest | None:
    row = db.execute(
        text(f"{_REQUEST} WHERE r.photo_id = :photo AND r.requester_id = :member AND r.state = 'open'"),
        {"photo": photo_id, "member": member_id},
    ).mappings().one_or_none()
    return StoredRequest(**row) if row else None


def requests_of(db: Session, member_id: uuid.UUID) -> list[StoredRequest]:
    rows = db.execute(
        text(f"{_REQUEST} WHERE r.requester_id = :member ORDER BY r.created_at DESC"), {"member": member_id}
    ).mappings()
    return [StoredRequest(**row) for row in rows]


def public_requests_from(db: Session, ip: str) -> int:
    return db.scalar(
        text(
            """
            SELECT count(*) FROM content.removal_request
            WHERE requester_ip = :ip AND requester_id IS NULL AND created_at > now() - interval '1 hour'
            """
        ),
        {"ip": ip},
    )


def queue(db: Session, *, visible_areas: list[str] | None, states: list[str], limit: int, offset: int = 0) -> list[StoredRequest]:
    """Soonest due first (FR-ADM-006). visible_areas=None means every area."""
    conditions = ["r.state = ANY(CAST(:states AS text[]))"]
    params: dict[str, Any] = {"states": states, "limit": limit, "offset": offset}
    if visible_areas is not None:
        conditions.append("r.area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    rows = db.execute(
        text(f"{_REQUEST} WHERE {' AND '.join(conditions)} ORDER BY r.due_at, r.request_ref LIMIT :limit OFFSET :offset"), params
    ).mappings()
    return [StoredRequest(**row) for row in rows]


def decide(db: Session, request_id: uuid.UUID, *, state: str, reason: str, decided_by: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE content.removal_request
            SET state = :state, decision_reason = :reason, decided_by = :member, decided_at = clock_timestamp()
            WHERE id = :id AND state = 'open'
            """
        ),
        {"id": request_id, "state": state, "reason": reason, "member": decided_by},
    )


def overdue_unescalated(db: Session, open_for: timedelta) -> list[uuid.UUID]:
    """Open requests older than open_for whose Tier 5 alert has not gone out yet."""
    return list(
        db.scalars(
            text(
                """
                SELECT id FROM content.removal_request
                WHERE state = 'open' AND escalated_at IS NULL AND created_at <= now() - CAST(:age AS interval)
                ORDER BY created_at FOR UPDATE SKIP LOCKED
                """
            ),
            {"age": open_for},
        )
    )


def mark_escalated(db: Session, request_id: uuid.UUID) -> None:
    db.execute(text("UPDATE content.removal_request SET escalated_at = clock_timestamp() WHERE id = :id"), {"id": request_id})


def tier5_takedown_holders(db: Session) -> list[uuid.UUID]:
    """Tier 5 holders of gallery.takedown whose assignment counts now (an Active membership,
    review not overdue)."""
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.tier = '5' AND a.state = 'active' AND 'gallery.takedown' = ANY(a.permissions)
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                """
            )
        )
    )


def other_open_requests(db: Session, photo_id: uuid.UUID, request_id: uuid.UUID) -> list[uuid.UUID]:
    return list(
        db.scalars(
            text("SELECT id FROM content.removal_request WHERE photo_id = :photo AND state = 'open' AND id <> :id"),
            {"photo": photo_id, "id": request_id},
        )
    )
