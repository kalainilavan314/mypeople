"""SQL for misinformation reports and their screenshots."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Report:
    id: uuid.UUID
    report_ref: str
    member_id: uuid.UUID
    link: str | None
    description: str
    screenshot_id: uuid.UUID | None
    state: str
    outcome: str | None
    reason: str | None
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    appeal_body: str | None
    appeal_state: str
    appeal_outcome: str | None
    appeal_reason: str | None
    created_at: datetime


_SELECT = """SELECT id, report_ref, member_id, link, description, screenshot_id, state, outcome, reason, decided_by,
                    decided_at, appeal_body, appeal_state, appeal_outcome, appeal_reason, created_at
             FROM community.misinfo_report"""


def find(db: Session, report_id: uuid.UUID, *, lock: bool = False) -> Report | None:
    row = db.execute(text(f"{_SELECT} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": report_id}).mappings().one_or_none()
    return Report(**row) if row else None


def by_member(db: Session, member_id: uuid.UUID) -> list[Report]:
    return [Report(**r) for r in db.execute(text(f"{_SELECT} WHERE member_id = :m ORDER BY created_at DESC"),
                                             {"m": member_id}).mappings()]


def queue(db: Session, only_open: bool, limit: int = 200) -> list[Report]:
    condition = "state = 'pending' OR appeal_state = 'open'" if only_open else "TRUE"
    return [Report(**r) for r in db.execute(text(f"{_SELECT} WHERE {condition} ORDER BY created_at LIMIT :limit"),
                                             {"limit": limit}).mappings()]


def count_recent(db: Session, member_id: uuid.UUID) -> int:
    return db.scalar(text("""SELECT count(*) FROM community.misinfo_report
                             WHERE member_id = :m AND created_at > now() - interval '1 day'"""), {"m": member_id}) or 0


def insert(db: Session, member_id: uuid.UUID, link: str | None, description: str, screenshot_id: uuid.UUID | None) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO community.misinfo_report (member_id, link, description, screenshot_id)
                VALUES (:m, :l, :d, :s) RETURNING id"""),
        {"m": member_id, "l": link, "d": description, "s": screenshot_id},
    )


def update(db: Session, report_id: uuid.UUID, values: dict[str, Any]) -> None:
    sets = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE community.misinfo_report SET {sets} WHERE id = :id"), {**values, "id": report_id})


@dataclass(frozen=True)
class Screenshot:
    id: uuid.UUID
    uploader_id: uuid.UUID
    sealed_with: str
    width: int
    height: int


def insert_screenshot(db: Session, screenshot_id: uuid.UUID, uploader: uuid.UUID, sealed_with: str, size: int, width: int,
                      height: int) -> None:
    db.execute(
        text("""INSERT INTO community.misinfo_screenshot (id, uploader_id, sealed_with, byte_size, width, height)
                VALUES (:id, :u, :s, :b, :w, :h)"""),
        {"id": screenshot_id, "u": uploader, "s": sealed_with, "b": size, "w": width, "h": height},
    )


def find_screenshot(db: Session, screenshot_id: uuid.UUID) -> Screenshot | None:
    row = db.execute(text("SELECT id, uploader_id, sealed_with, width, height FROM community.misinfo_screenshot WHERE id = :id"),
                     {"id": screenshot_id}).mappings().one_or_none()
    return Screenshot(**row) if row else None


def screenshot_used(db: Session, screenshot_id: uuid.UUID) -> bool:
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM community.misinfo_report WHERE screenshot_id = :s)"),
                          {"s": screenshot_id}))
