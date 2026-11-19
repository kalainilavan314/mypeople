"""SQL for official content: signing keys, publishers, images, statements and revisions (Alembic 0050)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class SigningKey:
    key_id: str
    algorithm: str
    public_key: str
    first_used_at: datetime


@dataclass(frozen=True)
class Publisher:
    id: uuid.UUID
    member_id: uuid.UUID
    member_code: str
    full_name: str
    name_en: str
    name_ta: str
    state: str
    registered_by: uuid.UUID
    registered_at: datetime
    revoked_at: datetime | None
    revoke_reason: str | None


@dataclass(frozen=True)
class Image:
    id: uuid.UUID
    uploaded_by: uuid.UUID
    sha256: str
    byte_size: int
    width: int
    height: int


@dataclass(frozen=True)
class Statement:
    id: uuid.UUID
    statement_ref: str
    check_code: str | None
    state: str
    draft_title_en: str
    draft_title_ta: str
    draft_body_en: str
    draft_body_ta: str
    draft_image_id: uuid.UUID | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    withdrawn_at: datetime | None
    withdrawal_reason_en: str | None
    withdrawal_reason_ta: str | None


@dataclass(frozen=True)
class Revision:
    id: uuid.UUID
    statement_id: uuid.UUID
    revision: int
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    image_id: uuid.UUID | None
    image_sha256: str | None
    image_width: int | None
    image_height: int | None
    correction_reason_en: str | None
    correction_reason_ta: str | None
    publisher_id: uuid.UUID
    publisher_name_en: str
    publisher_name_ta: str
    key_id: str
    public_key: str
    signed_payload: str
    signature: str
    published_at: datetime


# --- Signing keys -------------------------------------------------------------------------------------------


def record_key(db: Session, key_id: str, algorithm: str, public_key: str) -> None:
    """Kept once, never changed: statements signed before a key rotation still verify."""
    db.execute(
        text(
            """INSERT INTO content.signing_key (key_id, algorithm, public_key) VALUES (:key_id, :algorithm, :public_key)
               ON CONFLICT (key_id) DO NOTHING"""
        ),
        {"key_id": key_id, "algorithm": algorithm, "public_key": public_key},
    )


def keys(db: Session) -> list[SigningKey]:
    rows = db.execute(
        text("SELECT key_id, algorithm, public_key, first_used_at FROM content.signing_key ORDER BY first_used_at")
    ).mappings()
    return [SigningKey(**row) for row in rows]


# --- Publishers ---------------------------------------------------------------------------------------------

_PUBLISHER = """SELECT p.id, p.member_id, m.member_code, m.full_name, p.name_en, p.name_ta, p.state, p.registered_by,
                       p.registered_at, p.revoked_at, p.revoke_reason
                FROM content.official_publisher p JOIN npm.member m ON m.id = p.member_id"""


def active_publisher_for(db: Session, member_id: uuid.UUID) -> Publisher | None:
    row = db.execute(text(f"{_PUBLISHER} WHERE p.member_id = :m AND p.state = 'active'"), {"m": member_id}).mappings().one_or_none()
    return Publisher(**row) if row else None


def find_publisher(db: Session, publisher_id: uuid.UUID, *, lock: bool = False) -> Publisher | None:
    row = db.execute(
        text(f"{_PUBLISHER} WHERE p.id = :id{' FOR UPDATE OF p' if lock else ''}"), {"id": publisher_id}
    ).mappings().one_or_none()
    return Publisher(**row) if row else None


def publishers(db: Session) -> list[Publisher]:
    rows = db.execute(text(f"{_PUBLISHER} ORDER BY p.state, p.registered_at DESC LIMIT 200")).mappings()
    return [Publisher(**row) for row in rows]


def insert_publisher(db: Session, member_id: uuid.UUID, name_en: str, name_ta: str, registered_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO content.official_publisher (member_id, name_en, name_ta, registered_by)
               VALUES (:m, :en, :ta, :by) RETURNING id"""
        ),
        {"m": member_id, "en": name_en, "ta": name_ta, "by": registered_by},
    )


def revoke_publisher(db: Session, publisher_id: uuid.UUID, revoked_by: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """UPDATE content.official_publisher
               SET state = 'revoked', revoked_by = :by, revoked_at = clock_timestamp(), revoke_reason = :reason
               WHERE id = :id"""
        ),
        {"id": publisher_id, "by": revoked_by, "reason": reason},
    )


# --- Images -------------------------------------------------------------------------------------------------


def insert_image(db: Session, image_id: uuid.UUID, uploaded_by: uuid.UUID, sha256: str, byte_size: int, width: int,
                 height: int) -> None:
    db.execute(
        text(
            """INSERT INTO content.official_image (id, uploaded_by, sha256, byte_size, width, height)
               VALUES (:id, :by, :sha, :size, :w, :h)"""
        ),
        {"id": image_id, "by": uploaded_by, "sha": sha256, "size": byte_size, "w": width, "h": height},
    )


def find_image(db: Session, image_id: uuid.UUID) -> Image | None:
    row = db.execute(
        text("SELECT id, uploaded_by, sha256, byte_size, width, height FROM content.official_image WHERE id = :id"),
        {"id": image_id},
    ).mappings().one_or_none()
    return Image(**row) if row else None


def image_is_public(db: Session, image_id: uuid.UUID) -> bool:
    """Only an image that a published revision carries is served without signing in."""
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM content.official_revision WHERE image_id = :id)"), {"id": image_id}))


# --- Statements and revisions -------------------------------------------------------------------------------

_STATEMENT = """SELECT id, statement_ref, check_code, state, draft_title_en, draft_title_ta, draft_body_en, draft_body_ta,
                       draft_image_id, created_by, created_at, updated_at, withdrawn_at, withdrawal_reason_en,
                       withdrawal_reason_ta
                FROM content.official_statement"""


def find_statement(db: Session, statement_id: uuid.UUID, *, lock: bool = False) -> Statement | None:
    row = db.execute(
        text(f"{_STATEMENT} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": statement_id}
    ).mappings().one_or_none()
    return Statement(**row) if row else None


def find_by_code(db: Session, check_code: str) -> Statement | None:
    row = db.execute(text(f"{_STATEMENT} WHERE check_code = :code"), {"code": check_code}).mappings().one_or_none()
    return Statement(**row) if row else None


def statements(db: Session, states: list[str], limit: int) -> list[Statement]:
    rows = db.execute(
        text(f"{_STATEMENT} WHERE state = ANY(CAST(:states AS text[])) ORDER BY updated_at DESC LIMIT :limit"),
        {"states": states, "limit": limit},
    ).mappings()
    return [Statement(**row) for row in rows]


def insert_statement(db: Session, values: dict[str, Any], created_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO content.official_statement (draft_title_en, draft_title_ta, draft_body_en, draft_body_ta,
                                                       draft_image_id, created_by)
               VALUES (:title_en, :title_ta, :body_en, :body_ta, :image_id, :by) RETURNING id"""
        ),
        {**values, "by": created_by},
    )


def update_draft(db: Session, statement_id: uuid.UUID, values: dict[str, Any]) -> None:
    db.execute(
        text(
            """UPDATE content.official_statement
               SET draft_title_en = :title_en, draft_title_ta = :title_ta, draft_body_en = :body_en,
                   draft_body_ta = :body_ta, draft_image_id = :image_id, updated_at = clock_timestamp()
               WHERE id = :id"""
        ),
        {**values, "id": statement_id},
    )


def set_published(db: Session, statement_id: uuid.UUID, check_code: str) -> None:
    db.execute(
        text(
            """UPDATE content.official_statement SET state = 'published', check_code = :code, updated_at = clock_timestamp()
               WHERE id = :id"""
        ),
        {"id": statement_id, "code": check_code},
    )


def touch(db: Session, statement_id: uuid.UUID) -> None:
    db.execute(text("UPDATE content.official_statement SET updated_at = clock_timestamp() WHERE id = :id"), {"id": statement_id})


def set_withdrawn(db: Session, statement_id: uuid.UUID, withdrawn_by: uuid.UUID, reason_en: str, reason_ta: str) -> None:
    db.execute(
        text(
            """UPDATE content.official_statement
               SET state = 'withdrawn', withdrawn_by = :by, withdrawn_at = clock_timestamp(),
                   withdrawal_reason_en = :en, withdrawal_reason_ta = :ta, updated_at = clock_timestamp()
               WHERE id = :id"""
        ),
        {"id": statement_id, "by": withdrawn_by, "en": reason_en, "ta": reason_ta},
    )


def code_taken(db: Session, check_code: str) -> bool:
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM content.official_statement WHERE check_code = :c)"), {"c": check_code}))


_REVISION = """SELECT r.id, r.statement_id, r.revision, r.title_en, r.title_ta, r.body_en, r.body_ta, r.image_id,
                      r.image_sha256, i.width AS image_width, i.height AS image_height, r.correction_reason_en,
                      r.correction_reason_ta, r.publisher_id, p.name_en AS publisher_name_en,
                      p.name_ta AS publisher_name_ta, r.key_id, k.public_key, r.signed_payload, r.signature,
                      r.published_at
               FROM content.official_revision r
               JOIN content.official_publisher p ON p.id = r.publisher_id
               JOIN content.signing_key k ON k.key_id = r.key_id
               LEFT JOIN content.official_image i ON i.id = r.image_id"""


def revisions(db: Session, statement_ids: list[uuid.UUID]) -> list[Revision]:
    """Every revision of these statements, oldest first."""
    if not statement_ids:
        return []
    rows = db.execute(
        text(f"{_REVISION} WHERE r.statement_id = ANY(CAST(:ids AS uuid[])) ORDER BY r.statement_id, r.revision"),
        {"ids": statement_ids},
    ).mappings()
    return [Revision(**row) for row in rows]


def insert_revision(db: Session, values: dict[str, Any]) -> None:
    db.execute(
        text(
            """INSERT INTO content.official_revision (statement_id, revision, title_en, title_ta, body_en, body_ta,
                                                      image_id, image_sha256, correction_reason_en, correction_reason_ta,
                                                      publisher_id, key_id, signed_payload, signature, published_at)
               VALUES (:statement_id, :revision, :title_en, :title_ta, :body_en, :body_ta, :image_id, :image_sha256,
                       :correction_reason_en, :correction_reason_ta, :publisher_id, :key_id, :signed_payload,
                       :signature, :published_at)"""
        ),
        values,
    )
