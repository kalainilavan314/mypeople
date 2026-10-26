"""SQL for the inbox, preferences, devices and the push outbox (Alembic revision 0017)."""

import uuid
from dataclasses import dataclass
from datetime import datetime, time
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.messaging.notifications.templates import Template


@dataclass(frozen=True)
class StoredNotification:
    id: uuid.UUID
    topic: str
    template: str
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    target_kind: str
    target_id: uuid.UUID | None
    action_required: bool
    action_done_at: datetime | None
    created_at: datetime
    read_at: datetime | None


_SELECT = """
    SELECT id, topic, template, title_en, title_ta, body_en, body_ta, target_kind, target_id, action_required,
           action_done_at, created_at, read_at
    FROM notifications.notification
"""


def insert(
    db: Session,
    *,
    member_id: uuid.UUID,
    key: str,
    template: Template,
    target_id: uuid.UUID | None,
    body_en: str | None = None,
    body_ta: str | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO notifications.notification (member_id, topic, template, title_en, title_ta, body_en, body_ta,
                                                    target_kind, target_id, action_required, urgent)
            VALUES (:member, :topic, :template, :title_en, :title_ta, :body_en, :body_ta, :kind, :target,
                    :action, :urgent)
            """
        ),
        {
            "member": member_id,
            "topic": template.topic,
            "template": key,
            "title_en": template.title_en,
            "title_ta": template.title_ta,
            "body_en": body_en if body_en is not None else template.body_en,
            "body_ta": body_ta if body_ta is not None else template.body_ta,
            "kind": template.target_kind,
            "target": target_id,
            "action": template.action_required,
            "urgent": template.urgent,
        },
    )


def complete_action(db: Session, target_kind: str, target_id: uuid.UUID, member_id: uuid.UUID | None = None) -> None:
    """The task is done: the item leaves "Action needed", read or not (BR-027)."""
    db.execute(
        text(
            """
            UPDATE notifications.notification SET action_done_at = clock_timestamp()
            WHERE action_required AND action_done_at IS NULL AND target_kind = :kind AND target_id = :target
              AND (CAST(:member AS uuid) IS NULL OR member_id = :member)
            """
        ),
        {"kind": target_kind, "target": target_id, "member": member_id},
    )


def inbox(
    db: Session,
    member_id: uuid.UUID,
    *,
    action_needed: bool,
    topics: list[str] | None,
    before: datetime | None,
    limit: int,
) -> list[StoredNotification]:
    conditions = ["member_id = :member"]
    params: dict[str, Any] = {"member": member_id, "limit": limit}
    if action_needed:
        conditions.append("action_required AND action_done_at IS NULL")
    if topics is not None:
        conditions.append("topic = ANY(CAST(:topics AS text[]))")
        params["topics"] = topics
    if before is not None:
        conditions.append("created_at < :before")
        params["before"] = before
    rows = db.execute(
        text(f"{_SELECT} WHERE {' AND '.join(conditions)} ORDER BY created_at DESC, id LIMIT :limit"), params
    ).mappings()
    return [StoredNotification(**row) for row in rows]


def counts(db: Session, member_id: uuid.UUID) -> tuple[int, int]:
    """(unread, action needed)."""
    row = db.execute(
        text(
            """
            SELECT count(*) FILTER (WHERE read_at IS NULL) AS unread,
                   count(*) FILTER (WHERE action_required AND action_done_at IS NULL) AS action_needed
            FROM notifications.notification WHERE member_id = :member
            """
        ),
        {"member": member_id},
    ).one()
    return row.unread, row.action_needed


def mark_read(db: Session, member_id: uuid.UUID, notification_id: uuid.UUID | None) -> int:
    """One notification, or all of them when notification_id is None. Only the member's own."""
    return db.execute(
        text(
            """
            UPDATE notifications.notification SET read_at = clock_timestamp()
            WHERE member_id = :member AND read_at IS NULL AND (CAST(:id AS uuid) IS NULL OR id = :id)
            """
        ),
        {"member": member_id, "id": notification_id},
    ).rowcount


def exists_for(db: Session, member_id: uuid.UUID, notification_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM notifications.notification WHERE id = :id AND member_id = :member)"),
            {"id": notification_id, "member": member_id},
        )
    )


# --- Preferences and quiet hours (FR-PROF-012, FR-STF-009) -----------------------------------------------


def preferences(db: Session, member_id: uuid.UUID) -> dict[str, tuple[bool, bool]]:
    rows = db.execute(
        text("SELECT topic, push, sms FROM notifications.preference WHERE member_id = :member"), {"member": member_id}
    )
    return {row.topic: (row.push, row.sms) for row in rows}


def set_preference(db: Session, member_id: uuid.UUID, topic: str, push: bool, sms: bool) -> None:
    db.execute(
        text(
            """
            INSERT INTO notifications.preference (member_id, topic, push, sms) VALUES (:member, :topic, :push, :sms)
            ON CONFLICT (member_id, topic) DO UPDATE
            SET push = EXCLUDED.push, sms = EXCLUDED.sms, updated_at = clock_timestamp()
            """
        ),
        {"member": member_id, "topic": topic, "push": push, "sms": sms},
    )


def quiet_hours(db: Session, member_id: uuid.UUID) -> tuple[time | None, time | None]:
    row = db.execute(
        text("SELECT quiet_start, quiet_end FROM notifications.setting WHERE member_id = :member"), {"member": member_id}
    ).one_or_none()
    return (row.quiet_start, row.quiet_end) if row else (None, None)


def set_quiet_hours(db: Session, member_id: uuid.UUID, start: time | None, end: time | None) -> None:
    db.execute(
        text(
            """
            INSERT INTO notifications.setting (member_id, quiet_start, quiet_end) VALUES (:member, :start, :end)
            ON CONFLICT (member_id) DO UPDATE
            SET quiet_start = EXCLUDED.quiet_start, quiet_end = EXCLUDED.quiet_end, updated_at = clock_timestamp()
            """
        ),
        {"member": member_id, "start": start, "end": end},
    )


# --- Devices --------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Device:
    token: str
    platform: str


def register_device(db: Session, member_id: uuid.UUID, token: str, platform: str) -> None:
    """A token moves to whoever signs in on that device last, so the previous person's
    notifications never reach it."""
    db.execute(
        text(
            """
            INSERT INTO notifications.device (member_id, token, platform) VALUES (:member, :token, :platform)
            ON CONFLICT (token) DO UPDATE
            SET member_id = EXCLUDED.member_id, platform = EXCLUDED.platform, revoked_at = NULL,
                last_seen_at = clock_timestamp()
            """
        ),
        {"member": member_id, "token": token, "platform": platform},
    )


def revoke_device(db: Session, token: str, member_id: uuid.UUID | None = None) -> None:
    db.execute(
        text(
            """
            UPDATE notifications.device SET revoked_at = clock_timestamp()
            WHERE token = :token AND revoked_at IS NULL AND (CAST(:member AS uuid) IS NULL OR member_id = :member)
            """
        ),
        {"token": token, "member": member_id},
    )


def active_devices(db: Session, member_id: uuid.UUID) -> list[Device]:
    rows = db.execute(
        text("SELECT token, platform FROM notifications.device WHERE member_id = :member AND revoked_at IS NULL"),
        {"member": member_id},
    )
    return [Device(row.token, row.platform) for row in rows]


# --- The push outbox ------------------------------------------------------------------------------------


@dataclass(frozen=True)
class PendingPush:
    id: uuid.UUID
    member_id: uuid.UUID
    topic: str
    title_en: str
    title_ta: str
    urgent: bool
    push_wanted: bool
    quiet_start: time | None
    quiet_end: time | None


def pending_pushes(db: Session, limit: int, default_push: bool) -> list[PendingPush]:
    """Oldest first, with the member's choice for the topic and quiet hours; locked so two
    dispatchers never send the same one."""
    rows = db.execute(
        text(
            """
            SELECT n.id, n.member_id, n.topic, n.title_en, n.title_ta, n.urgent,
                   COALESCE(p.push, :default_push) AS push_wanted, s.quiet_start, s.quiet_end
            FROM notifications.notification n
            LEFT JOIN notifications.preference p ON p.member_id = n.member_id AND p.topic = n.topic
            LEFT JOIN notifications.setting s ON s.member_id = n.member_id
            WHERE n.push_state = 'pending'
            ORDER BY n.created_at LIMIT :limit
            FOR UPDATE OF n SKIP LOCKED
            """
        ),
        {"limit": limit, "default_push": default_push},
    )
    return [PendingPush(**row) for row in rows.mappings()]


def mark_push(db: Session, notification_id: uuid.UUID, state: str) -> None:
    db.execute(
        text(
            """
            UPDATE notifications.notification
            SET push_state = :state, pushed_at = CASE WHEN :state = 'sent' THEN clock_timestamp() END
            WHERE id = :id
            """
        ),
        {"id": notification_id, "state": state},
    )
