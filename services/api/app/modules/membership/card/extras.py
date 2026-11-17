"""The card's own photo and the member's drawn signature (owner's card design, 17 November 2026).

The photo is a voluntary upload just for the card, never the identity selfie or document photos
(BR-021). It is decoded and re-encoded like a gallery photo, which drops its EXIF and GPS data, and
sealed with the evidence key (AES-256-GCM, the photo id bound in) in its own folder of the evidence
directory. It is served only back to the member, and replacing or removing it deletes the old file.

The signature is what the member drew on the card's signature pad: strokes of points scaled to 0..1
of the pad, so the card can draw it at any size without storing an image.
"""

import json
import math
import uuid
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.audit import service as audit
from app.modules.content.gallery import images
from app.modules.identity.documents.vault import EvidenceUnreadable, EvidenceVault, FileStore

FOLDER = "card-photos"
MAX_STROKES = 40
MAX_POINTS_PER_STROKE = 600
MAX_POINTS = 5000


# --- The photo store ------------------------------------------------------------------------------------


def build_card_photo_vault(settings: Settings) -> EvidenceVault | None:
    if settings.evidence_storage_dir is None or settings.evidence_key is None:
        return None
    return EvidenceVault(FileStore(settings.evidence_storage_dir / FOLDER), settings.evidence_key)


def get_card_photo_vault(request: Request) -> EvidenceVault:
    vault: EvidenceVault | None = getattr(request.app.state, "card_photo_vault", None)
    if vault is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="evidence_storage_not_configured")
    return vault


CardPhotoVault = Annotated[EvidenceVault, Depends(get_card_photo_vault)]


class CardExtraRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class CardPhotoMissing(Exception):
    pass


@dataclass(frozen=True)
class StoredPhoto:
    photo_id: uuid.UUID
    sealed_with: str


def find_photo(db: Session, member_id: uuid.UUID) -> StoredPhoto | None:
    row = db.execute(
        text("SELECT photo_id, sealed_with FROM profile.card_photo WHERE member_id = :m"), {"m": member_id}
    ).mappings().one_or_none()
    return StoredPhoto(**row) if row else None


def set_photo(db: Session, vault: EvidenceVault, member_id: uuid.UUID, data: bytes, ip: str) -> uuid.UUID:
    """Store a new card photo and remove the one it replaces."""
    try:
        prepared = images.prepare(data)
    except images.ImageRejected as error:
        raise CardExtraRefused(error.code) from None
    photo_id = uuid.uuid4()
    sealed_with = vault.save(photo_id, prepared.display)
    previous = find_photo(db, member_id)
    db.execute(
        text(
            """INSERT INTO profile.card_photo (member_id, photo_id, sealed_with, width, height)
               VALUES (:m, :p, :s, :w, :h)
               ON CONFLICT (member_id) DO UPDATE SET photo_id = EXCLUDED.photo_id, sealed_with = EXCLUDED.sealed_with,
                   width = EXCLUDED.width, height = EXCLUDED.height, updated_at = clock_timestamp()"""
        ),
        {"m": member_id, "p": photo_id, "s": sealed_with, "w": prepared.width, "h": prepared.height},
    )
    audit.record(db, actor_id=member_id, action="membership.card.photo_set", target_type="member",
                 target_id=str(member_id), ip=ip)
    db.commit()
    if previous is not None:
        vault.store.delete(previous.photo_id)
    return photo_id


def remove_photo(db: Session, vault: EvidenceVault, member_id: uuid.UUID, ip: str) -> None:
    previous = find_photo(db, member_id)
    if previous is None:
        return
    db.execute(text("DELETE FROM profile.card_photo WHERE member_id = :m"), {"m": member_id})
    audit.record(db, actor_id=member_id, action="membership.card.photo_removed", target_type="member",
                 target_id=str(member_id), ip=ip)
    db.commit()
    vault.store.delete(previous.photo_id)


def photo_bytes(db: Session, vault: EvidenceVault, member_id: uuid.UUID) -> bytes:
    stored = find_photo(db, member_id)
    if stored is None:
        raise CardPhotoMissing()
    try:
        return vault.read(stored.photo_id, stored.sealed_with)
    except EvidenceUnreadable:
        raise CardPhotoMissing() from None


# --- The signature --------------------------------------------------------------------------------------


def check_strokes(strokes: list[list[list[float]]]) -> list[list[list[float]]]:
    """Strokes of [x, y] points within 0..1; returns them rounded, or raises with the problem."""
    if not 1 <= len(strokes) <= MAX_STROKES:
        raise CardExtraRefused("signature_strokes")
    total = 0
    cleaned: list[list[list[float]]] = []
    for stroke in strokes:
        if not 1 <= len(stroke) <= MAX_POINTS_PER_STROKE:
            raise CardExtraRefused("signature_points")
        points: list[list[float]] = []
        for point in stroke:
            if len(point) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1 for v in point):
                raise CardExtraRefused("signature_point_outside")
            points.append([round(float(point[0]), 4), round(float(point[1]), 4)])
        total += len(points)
        cleaned.append(points)
    if total > MAX_POINTS:
        raise CardExtraRefused("signature_points")
    if total < 3:
        raise CardExtraRefused("signature_too_short")
    return cleaned


def find_signature(db: Session, member_id: uuid.UUID) -> list[Any] | None:
    return db.scalar(text("SELECT strokes FROM profile.card_signature WHERE member_id = :m"), {"m": member_id})


def set_signature(db: Session, member_id: uuid.UUID, strokes: list[list[list[float]]], ip: str) -> list[list[list[float]]]:
    cleaned = check_strokes(strokes)
    db.execute(
        text(
            """INSERT INTO profile.card_signature (member_id, strokes) VALUES (:m, CAST(:s AS jsonb))
               ON CONFLICT (member_id) DO UPDATE SET strokes = EXCLUDED.strokes, updated_at = clock_timestamp()"""
        ),
        {"m": member_id, "s": _json(cleaned)},
    )
    audit.record(db, actor_id=member_id, action="membership.card.signature_set", target_type="member",
                 target_id=str(member_id), ip=ip)
    db.commit()
    return cleaned


def remove_signature(db: Session, member_id: uuid.UUID, ip: str) -> None:
    removed = db.execute(text("DELETE FROM profile.card_signature WHERE member_id = :m"), {"m": member_id}).rowcount
    if removed:
        audit.record(db, actor_id=member_id, action="membership.card.signature_removed", target_type="member",
                     target_id=str(member_id), ip=ip)
    db.commit()


def _json(value: object) -> str:
    return json.dumps(value, separators=(",", ":"))
