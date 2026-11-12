"""SQL for member invitations: opaque tokens and the neutral status of each."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Invitation:
    id: uuid.UUID
    token: str
    number: int
    language: str
    created_at: datetime
    joined: bool
    active: bool


def by_inviter(db: Session, inviter_id: uuid.UUID) -> list[Invitation]:
    """Newest first. Only whether someone joined and whether their membership is Active: never who."""
    rows = db.execute(
        text(
            """
            SELECT i.id, i.token, i.number, i.language, i.created_at, i.invitee_id IS NOT NULL AS joined,
                   COALESCE(ms.state = 'active', false) AS active
            FROM membership.invitation i
            LEFT JOIN membership.membership ms ON ms.member_id = i.invitee_id
            WHERE i.inviter_id = :inviter ORDER BY i.number DESC
            """
        ),
        {"inviter": inviter_id},
    ).mappings()
    return [Invitation(**row) for row in rows]


def insert(db: Session, inviter_id: uuid.UUID, token: str, language: str) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO membership.invitation (token, inviter_id, number, language)
            VALUES (:token, :inviter,
                    (SELECT COALESCE(max(number), 0) + 1 FROM membership.invitation WHERE inviter_id = :inviter),
                    :language)
            RETURNING id
            """
        ),
        {"token": token, "inviter": inviter_id, "language": language},
    )


def count_recent(db: Session, inviter_id: uuid.UUID) -> int:
    return db.scalar(
        text("SELECT count(*) FROM membership.invitation WHERE inviter_id = :i AND created_at > now() - interval '1 day'"),
        {"i": inviter_id},
    ) or 0


def inviter_for_token(db: Session, token: str) -> uuid.UUID | None:
    """The inviter of an unused invitation."""
    return db.scalar(
        text(
            """SELECT i.inviter_id FROM membership.invitation i JOIN npm.member m ON m.id = i.inviter_id
               WHERE i.token = :token AND i.invitee_id IS NULL AND m.deleted_at IS NULL"""
        ),
        {"token": token},
    )


def mark_joined(db: Session, token: str, invitee_id: uuid.UUID) -> None:
    db.execute(
        text(
            """UPDATE membership.invitation SET invitee_id = :invitee, joined_at = clock_timestamp()
               WHERE token = :token AND invitee_id IS NULL"""
        ),
        {"token": token, "invitee": invitee_id},
    )


def referral_code(db: Session, member_id: uuid.UUID) -> str:
    return db.scalar(text("SELECT referral_code FROM npm.member WHERE id = :id"), {"id": member_id})
