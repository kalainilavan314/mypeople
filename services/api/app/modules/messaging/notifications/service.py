"""In-app notifications, channel choices, push devices and push delivery (BRD H03, P05, S14;
FR-HOME-009 to 011, FR-REG-021, FR-PROF-012, FR-STF-009, FR-MSG-004, 008, BR-027).

Other modules call notify() inside their own transaction, so a notice and the
change it reports are saved together or not at all (AP-08, the outbox
pattern). Every notice lands in the in-app inbox; dispatch() later pushes the
pending ones to the member's devices, following their choice for the topic
and holding non-urgent ones during quiet hours. When push is not configured
or the member has no device, the notice stays in the inbox, which is the
fallback (FR-MSG-008).

Not built yet: SMS and WhatsApp for notices (INT-01, INT-14; vendors not
contracted) and STOP replies (FR-MSG-006), which need them.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, time

from sqlalchemy.orm import Session

from app.integrations.push import PushMessage, PushSender, PushUnavailable
from app.modules.messaging.notifications import repository, rules
from app.modules.messaging.notifications.repository import StoredNotification
from app.modules.messaging.notifications.templates import TEMPLATES


class NotificationNotFound(Exception):
    pass


class PreferenceRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# --- Used by other modules, inside their transaction ---------------------------------------------------


def notify(
    db: Session,
    member_id: uuid.UUID,
    key: str,
    target_id: uuid.UUID | None,
    *,
    body_en: str | None = None,
    body_ta: str | None = None,
) -> None:
    """Add a notice from a fixed template (FR-MSG-007); the caller commits."""
    repository.insert(
        db, member_id=member_id, key=key, template=TEMPLATES[key], target_id=target_id, body_en=body_en, body_ta=body_ta
    )


def complete_action(db: Session, target_kind: str, target_id: uuid.UUID, member_id: uuid.UUID | None = None) -> None:
    """The task a notice asked for is done; the caller commits."""
    repository.complete_action(db, target_kind, target_id, member_id)


# --- The member's inbox (H03) ------------------------------------------------------------------------------


@dataclass(frozen=True)
class Inbox:
    items: list[StoredNotification]
    unread: int
    action_needed: int


def inbox(
    db: Session, member_id: uuid.UUID, *, action_needed: bool, topic: str | None, before: datetime | None, limit: int
) -> Inbox:
    items = repository.inbox(
        db, member_id, action_needed=action_needed, topics=[topic] if topic else None, before=before, limit=limit
    )
    unread, waiting = repository.counts(db, member_id)
    return Inbox(items=items, unread=unread, action_needed=waiting)


def mark_read(db: Session, member_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    """Reading never completes an action (BR-027)."""
    if not repository.exists_for(db, member_id, notification_id):
        raise NotificationNotFound()
    repository.mark_read(db, member_id, notification_id)
    db.commit()


def mark_all_read(db: Session, member_id: uuid.UUID) -> int:
    count = repository.mark_read(db, member_id, None)
    db.commit()
    return count


# --- Choices (P05, FR-PROF-012) ----------------------------------------------------------------------------


@dataclass(frozen=True)
class TopicChoice:
    topic: str
    push: bool
    sms: bool
    locked: bool  # security and transactional: always delivered


@dataclass(frozen=True)
class Choices:
    topics: list[TopicChoice]
    quiet_start: time | None
    quiet_end: time | None


def choices(db: Session, member_id: uuid.UUID) -> Choices:
    stored = repository.preferences(db, member_id)
    topics = []
    for topic in rules.TOPICS:
        push, sms = stored.get(topic, (rules.DEFAULT_PUSH, rules.DEFAULT_SMS))
        locked = topic in rules.LOCKED_TOPICS
        topics.append(TopicChoice(topic, push or locked, sms, locked))
    start, end = repository.quiet_hours(db, member_id)
    return Choices(topics=topics, quiet_start=start, quiet_end=end)


def update_choices(
    db: Session,
    member_id: uuid.UUID,
    topics: dict[str, tuple[bool, bool]],
    quiet: tuple[time | None, time | None] | None,
) -> Choices:
    for topic, (push, sms) in topics.items():
        problem = rules.check_preference(topic, push)
        if problem:
            raise PreferenceRefused(problem)
        repository.set_preference(db, member_id, topic, push, sms)
    if quiet is not None:
        repository.set_quiet_hours(db, member_id, *quiet)
    db.commit()
    return choices(db, member_id)


# --- Devices -----------------------------------------------------------------------------------------------


def register_device(db: Session, member_id: uuid.UUID, token: str, platform: str) -> None:
    repository.register_device(db, member_id, token, platform)
    db.commit()


def unregister_device(db: Session, member_id: uuid.UUID, token: str) -> None:
    """On sign-out the app gives its token back, so the next person on the phone gets nothing."""
    repository.revoke_device(db, token, member_id)
    db.commit()


# --- Push delivery (the dispatcher) --------------------------------------------------------------------------


@dataclass(frozen=True)
class Dispatched:
    sent: int
    skipped: int
    waiting: int


def dispatch(db: Session, push: PushSender, now: datetime, limit: int = 500) -> Dispatched:
    """Push the pending notices once. A push carries the short bilingual title and the notice's id
    only (INT-02). A token the service rejects is retired."""
    sent = skipped = waiting = 0
    for pending in repository.pending_pushes(db, limit, rules.DEFAULT_PUSH):
        decision = rules.push_decision(
            topic=pending.topic,
            push_wanted=pending.push_wanted,
            urgent=pending.urgent,
            quiet=rules.in_quiet_hours(now, pending.quiet_start, pending.quiet_end),
        )
        if decision == "wait":
            waiting += 1
            continue
        delivered = False
        if decision == "send":
            try:
                for device in repository.active_devices(db, pending.member_id):
                    message = PushMessage(
                        token=device.token,
                        platform=device.platform,
                        title=f"{pending.title_ta} / {pending.title_en}",
                        notification_id=str(pending.id),
                    )
                    if push.send(message):
                        delivered = True
                    else:
                        repository.revoke_device(db, device.token)
            except PushUnavailable:
                delivered = False  # no provider yet: the inbox holds it (FR-MSG-008)
        repository.mark_push(db, pending.id, "sent" if delivered else "skipped")
        if delivered:
            sent += 1
        else:
            skipped += 1
    db.commit()
    return Dispatched(sent=sent, skipped=skipped, waiting=waiting)
