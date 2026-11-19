"""SQL for assistant conversations, error reports and hand-overs (M28, D20, ENT-63).

Every function opens the row-level firewall for its own transaction first: without that, the
tables answer as if empty (Alembic revision 0052). No other module opens it.
"""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('ai.firewall', 'open', true)"))


# --- Conversations and messages --------------------------------------------------------------------------


@dataclass(frozen=True)
class Conversation:
    id: uuid.UUID
    member_id: uuid.UUID
    language: str
    created_at: datetime
    last_message_at: datetime


def find_conversation(db: Session, conversation_id: uuid.UUID) -> Conversation | None:
    _open(db)
    row = db.execute(
        text("SELECT id, member_id, language, created_at, last_message_at FROM ai.conversation WHERE id = :id"),
        {"id": conversation_id},
    ).mappings().one_or_none()
    return Conversation(**row) if row else None


def create_conversation(db: Session, member_id: uuid.UUID, language: str) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("INSERT INTO ai.conversation (member_id, language) VALUES (:member, :language) RETURNING id"),
        {"member": member_id, "language": language},
    )


def touch_conversation(db: Session, conversation_id: uuid.UUID, language: str) -> None:
    _open(db)
    db.execute(
        text("UPDATE ai.conversation SET last_message_at = clock_timestamp(), language = :language WHERE id = :id"),
        {"id": conversation_id, "language": language},
    )


def delete_conversation(db: Session, conversation_id: uuid.UUID) -> None:
    _open(db)
    db.execute(text("DELETE FROM ai.conversation WHERE id = :id"), {"id": conversation_id})


@dataclass(frozen=True)
class ConversationSummary:
    id: uuid.UUID
    last_message_at: datetime
    preview: str
    messages: int


def recent_conversations(db: Session, member_id: uuid.UUID, since: datetime, limit: int = 20) -> list[ConversationSummary]:
    _open(db)
    rows = db.execute(
        text(
            """
            SELECT c.id, c.last_message_at,
                   COALESCE((SELECT left(m.body, 120) FROM ai.message m
                             WHERE m.conversation_id = c.id AND m.role = 'member' AND m.created_at >= :since
                             ORDER BY m.created_at LIMIT 1), '') AS preview,
                   (SELECT count(*) FROM ai.message m WHERE m.conversation_id = c.id AND m.created_at >= :since)::int AS messages
            FROM ai.conversation c
            WHERE c.member_id = :member AND c.last_message_at >= :since
            ORDER BY c.last_message_at DESC LIMIT :limit
            """
        ),
        {"member": member_id, "since": since, "limit": limit},
    )
    return [ConversationSummary(**row) for row in rows.mappings() if row["messages"] > 0]


@dataclass(frozen=True)
class Message:
    id: uuid.UUID
    conversation_id: uuid.UUID
    member_id: uuid.UUID
    role: str
    body: str
    redactions: list[str]
    outcome: str | None
    refusal: str | None
    topics: list[str]
    citations: list[dict[str, Any]]
    model_id: uuid.UUID | None
    rating: str | None
    created_at: datetime
    reported: bool


_MESSAGE = """
    SELECT m.id, m.conversation_id, c.member_id, m.role, m.body, m.redactions, m.outcome, m.refusal, m.topics, m.citations,
           m.model_id, m.rating, m.created_at,
           EXISTS (SELECT 1 FROM ai.error_report r WHERE r.message_id = m.id) AS reported
    FROM ai.message m JOIN ai.conversation c ON c.id = m.conversation_id
"""


def _message(row: Any) -> Message:
    return Message(**{**row, "redactions": list(row["redactions"]), "topics": list(row["topics"])})


def insert_message(db: Session, conversation_id: uuid.UUID, *, role: str, body: str, redactions: list[str] | None = None,
                   outcome: str | None = None, refusal: str | None = None, topics: list[str] | None = None,
                   citations: list[dict[str, Any]] | None = None, model_id: uuid.UUID | None = None) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text(
            """INSERT INTO ai.message (conversation_id, role, body, redactions, outcome, refusal, topics, citations, model_id)
               VALUES (:conversation, :role, :body, :redactions, :outcome, :refusal, :topics, CAST(:citations AS jsonb), :model)
               RETURNING id"""
        ),
        {"conversation": conversation_id, "role": role, "body": body, "redactions": redactions or [], "outcome": outcome,
         "refusal": refusal, "topics": topics or [], "citations": json.dumps(citations or [], ensure_ascii=False),
         "model": model_id},
    )


def find_message(db: Session, message_id: uuid.UUID) -> Message | None:
    _open(db)
    row = db.execute(text(f"{_MESSAGE} WHERE m.id = :id"), {"id": message_id}).mappings().one_or_none()
    return _message(row) if row else None


def messages(db: Session, conversation_id: uuid.UUID, since: datetime) -> list[Message]:
    _open(db)
    rows = db.execute(
        text(f"{_MESSAGE} WHERE m.conversation_id = :id AND m.created_at >= :since ORDER BY m.created_at, m.role DESC"),
        {"id": conversation_id, "since": since},
    )
    return [_message(row) for row in rows.mappings()]


def question_before(db: Session, answer: Message) -> str | None:
    _open(db)
    return db.scalar(
        text(
            """SELECT body FROM ai.message WHERE conversation_id = :conversation AND role = 'member' AND created_at <= :at
               ORDER BY created_at DESC LIMIT 1"""
        ),
        {"conversation": answer.conversation_id, "at": answer.created_at},
    )


def set_rating(db: Session, message_id: uuid.UUID, rating: str | None) -> None:
    _open(db)
    db.execute(
        text(
            """UPDATE ai.message SET rating = CAST(:rating AS text),
                      rated_at = CASE WHEN CAST(:rating AS text) IS NULL THEN NULL ELSE clock_timestamp() END WHERE id = :id"""
        ),
        {"id": message_id, "rating": rating},
    )


def questions_since(db: Session, member_id: uuid.UUID, since: datetime) -> int:
    _open(db)
    return int(db.scalar(
        text(
            """SELECT count(*) FROM ai.message m JOIN ai.conversation c ON c.id = m.conversation_id
               WHERE c.member_id = :member AND m.role = 'member' AND m.created_at >= :since"""
        ),
        {"member": member_id, "since": since},
    ))


# --- Error reports (FR-AIA-008) ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ErrorReport:
    id: uuid.UUID
    model_id: uuid.UUID | None
    model_name: str | None
    question: str
    answer: str
    citations: list[dict[str, Any]]
    note: str
    state: str
    resolution: str | None
    resolved_by_name: str | None
    resolved_at: datetime | None
    created_at: datetime


_REPORT = """
    SELECT r.id, r.model_id, (md.name || ' ' || md.version) AS model_name, r.question, r.answer, r.citations, r.note, r.state,
           r.resolution, rb.full_name AS resolved_by_name, r.resolved_at, r.created_at
    FROM ai.error_report r
    LEFT JOIN ai.model md ON md.id = r.model_id
    LEFT JOIN npm.member rb ON rb.id = r.resolved_by
"""


def insert_error_report(db: Session, *, message: Message, member_id: uuid.UUID, question: str, note: str) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text(
            """INSERT INTO ai.error_report (message_id, member_id, model_id, question, answer, citations, note)
               VALUES (:message, :member, :model, :question, :answer, CAST(:citations AS jsonb), :note) RETURNING id"""
        ),
        {"message": message.id, "member": member_id, "model": message.model_id, "question": question,
         "answer": message.body, "citations": json.dumps(message.citations, ensure_ascii=False), "note": note},
    )


def error_reports_since(db: Session, member_id: uuid.UUID, since: datetime) -> int:
    _open(db)
    return int(db.scalar(
        text("SELECT count(*) FROM ai.error_report WHERE member_id = :member AND created_at >= :since"),
        {"member": member_id, "since": since},
    ))


def error_reports(db: Session, states: list[str], limit: int = 200) -> list[ErrorReport]:
    _open(db)
    rows = db.execute(
        text(f"{_REPORT} WHERE r.state = ANY(:states) ORDER BY (r.state = 'open') DESC, r.created_at LIMIT :limit"),
        {"states": states, "limit": limit},
    )
    return [ErrorReport(**row) for row in rows.mappings()]


def find_error_report(db: Session, report_id: uuid.UUID, *, lock: bool = False) -> ErrorReport | None:
    _open(db)
    if lock:
        db.execute(text("SELECT 1 FROM ai.error_report WHERE id = :id FOR UPDATE"), {"id": report_id})
    row = db.execute(text(f"{_REPORT} WHERE r.id = :id"), {"id": report_id}).mappings().one_or_none()
    return ErrorReport(**row) if row else None


def resolve_error_report(db: Session, report_id: uuid.UUID, state: str, resolution: str, resolved_by: uuid.UUID) -> None:
    _open(db)
    db.execute(
        text(
            """UPDATE ai.error_report SET state = :state, resolution = :resolution, resolved_by = :by,
                      resolved_at = clock_timestamp() WHERE id = :id"""
        ),
        {"id": report_id, "state": state, "resolution": resolution, "by": resolved_by},
    )


# --- Hand-overs to a person (FR-AIA-007) -------------------------------------------------------------------


@dataclass(frozen=True)
class Handover:
    id: uuid.UUID
    member_id: uuid.UUID
    language: str
    request: str
    transcript: list[dict[str, Any]]
    transcript_consent_at: datetime | None
    state: str
    reply: str | None
    replied_by_name: str | None
    replied_at: datetime | None
    closed_at: datetime | None
    created_at: datetime


_HANDOVER = """
    SELECT h.id, h.member_id, h.language, h.request, h.transcript, h.transcript_consent_at, h.state, h.reply,
           rb.full_name AS replied_by_name, h.replied_at, h.closed_at, h.created_at
    FROM ai.handover h LEFT JOIN npm.member rb ON rb.id = h.replied_by
"""


def insert_handover(db: Session, *, member_id: uuid.UUID, language: str, request: str,
                    transcript: list[dict[str, Any]]) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text(
            """INSERT INTO ai.handover (member_id, language, request, transcript, transcript_consent_at)
               VALUES (:member, :language, :request, CAST(:transcript AS jsonb),
                       CASE WHEN CAST(:shared AS boolean) THEN clock_timestamp() END) RETURNING id"""
        ),
        {"member": member_id, "language": language, "request": request,
         "transcript": json.dumps(transcript, ensure_ascii=False), "shared": bool(transcript)},
    )


def open_handovers(db: Session, member_id: uuid.UUID) -> int:
    _open(db)
    return int(db.scalar(
        text("SELECT count(*) FROM ai.handover WHERE member_id = :member AND state = 'open'"), {"member": member_id}
    ))


def member_handovers(db: Session, member_id: uuid.UUID, limit: int = 30) -> list[Handover]:
    _open(db)
    rows = db.execute(text(f"{_HANDOVER} WHERE h.member_id = :member ORDER BY h.created_at DESC LIMIT :limit"),
                      {"member": member_id, "limit": limit})
    return [Handover(**row) for row in rows.mappings()]


def handovers(db: Session, states: list[str], limit: int = 200) -> list[Handover]:
    _open(db)
    rows = db.execute(
        text(f"{_HANDOVER} WHERE h.state = ANY(:states) ORDER BY (h.state = 'open') DESC, h.created_at LIMIT :limit"),
        {"states": states, "limit": limit},
    )
    return [Handover(**row) for row in rows.mappings()]


def find_handover(db: Session, handover_id: uuid.UUID, *, lock: bool = False) -> Handover | None:
    _open(db)
    if lock:
        db.execute(text("SELECT 1 FROM ai.handover WHERE id = :id FOR UPDATE"), {"id": handover_id})
    row = db.execute(text(f"{_HANDOVER} WHERE h.id = :id"), {"id": handover_id}).mappings().one_or_none()
    return Handover(**row) if row else None


def reply_handover(db: Session, handover_id: uuid.UUID, reply: str, replied_by: uuid.UUID) -> None:
    _open(db)
    db.execute(
        text("UPDATE ai.handover SET state = 'answered', reply = :reply, replied_by = :by, replied_at = clock_timestamp() WHERE id = :id"),
        {"id": handover_id, "reply": reply, "by": replied_by},
    )


def close_handover(db: Session, handover_id: uuid.UUID) -> None:
    _open(db)
    db.execute(text("UPDATE ai.handover SET state = 'closed', closed_at = clock_timestamp() WHERE id = :id"), {"id": handover_id})


# --- The Knowledge Editor's summary and retention ----------------------------------------------------------


@dataclass(frozen=True)
class QueueCounts:
    open_error_reports: int
    open_handovers: int
    helpful_30_days: int
    not_helpful_30_days: int


def queue_counts(db: Session, since: datetime) -> QueueCounts:
    _open(db)
    row = db.execute(
        text(
            """
            SELECT (SELECT count(*) FROM ai.error_report WHERE state = 'open') AS open_error_reports,
                   (SELECT count(*) FROM ai.handover WHERE state = 'open') AS open_handovers,
                   (SELECT count(*) FROM ai.message WHERE rating = 'helpful' AND rated_at >= :since) AS helpful_30_days,
                   (SELECT count(*) FROM ai.message WHERE rating = 'not_helpful' AND rated_at >= :since) AS not_helpful_30_days
            """
        ),
        {"since": since},
    ).mappings().one()
    return QueueCounts(**row)


@dataclass(frozen=True)
class Purged:
    messages: int
    conversations: int
    handovers: int
    error_reports: int


def purge(db: Session, *, messages_before: datetime, handovers_before: datetime, reports_before: datetime) -> Purged:
    """Delete what is past its retention (OD-48 [ASSUMPTION]); the caller commits."""
    _open(db)
    deleted_messages = db.execute(text("DELETE FROM ai.message WHERE created_at < :before"), {"before": messages_before}).rowcount
    deleted_conversations = db.execute(
        text(
            """DELETE FROM ai.conversation c WHERE c.last_message_at < :before
               AND NOT EXISTS (SELECT 1 FROM ai.message m WHERE m.conversation_id = c.id)"""
        ),
        {"before": messages_before},
    ).rowcount
    deleted_handovers = db.execute(
        text(
            """DELETE FROM ai.handover WHERE state <> 'open'
               AND COALESCE(closed_at, replied_at, created_at) < :before"""
        ),
        {"before": handovers_before},
    ).rowcount
    deleted_reports = db.execute(
        text("DELETE FROM ai.error_report WHERE state <> 'open' AND resolved_at < :before"), {"before": reports_before}
    ).rowcount
    return Purged(deleted_messages, deleted_conversations, deleted_handovers, deleted_reports)
