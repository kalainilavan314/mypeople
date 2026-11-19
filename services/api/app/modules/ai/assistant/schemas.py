"""Request and response bodies for the Tamil AI assistant (M28) and its staff queues (D20)."""

import uuid
from datetime import datetime, timedelta
from typing import Any, Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.ai.assistant import rules
from app.modules.ai.assistant.repository import ConversationSummary, ErrorReport, Handover, Message
from app.modules.ai.assistant.rules import Language, Outcome, Rating, Refusal, Unavailable
from app.modules.ai.assistant.service import Answer, Asked, ConversationView, Home, Preview, Summary
from app.modules.ai.knowledge.rules import Kind
from app.modules.ai.redaction import Kind as RedactionKind

HandoverState = Literal["open", "answered", "closed"]
ErrorReportState = Literal["open", "fixed", "no_change"]


class AssistantQuoteOut(CamelModel):
    language: Language
    text: str = Field(description="Official text, word for word from the source (FR-AIA-004)")


class AssistantCitationOut(CamelModel):
    source_id: uuid.UUID
    family_id: uuid.UUID
    version: int
    kind: Kind
    title_ta: str
    title_en: str
    publisher: str
    source_url: str | None
    quotes: list[AssistantQuoteOut]

    @classmethod
    def build(cls, raw: dict[str, Any]) -> "AssistantCitationOut":
        return cls.model_validate(raw)


class AssistantMessageOut(CamelModel):
    id: uuid.UUID
    role: Literal["member", "assistant"]
    body: str = Field(description="The member's words (identifiers removed) or the AI explanation")
    redactions: list[RedactionKind] = Field(description="What was removed from the member's words")
    outcome: Outcome | None
    refusal: Refusal | None
    topics: list[Literal["eligibility", "election"]]
    citations: list[AssistantCitationOut]
    rating: Rating | None
    reported: bool
    created_at: datetime

    @classmethod
    def build(cls, m: Message) -> "AssistantMessageOut":
        return cls(
            id=m.id, role=m.role, body=m.body, redactions=m.redactions, outcome=m.outcome,  # type: ignore[arg-type]
            refusal=m.refusal, topics=[t for t in m.topics if t in ("eligibility", "election")],  # type: ignore[arg-type]
            citations=[AssistantCitationOut.build(c) for c in m.citations], rating=m.rating,  # type: ignore[arg-type]
            reported=m.reported, created_at=m.created_at,
        )


class AssistantConversationSummaryOut(CamelModel):
    id: uuid.UUID
    last_message_at: datetime
    preview: str = Field(description="The start of the first question")
    messages: int

    @classmethod
    def build(cls, c: ConversationSummary) -> "AssistantConversationSummaryOut":
        return cls(id=c.id, last_message_at=c.last_message_at, preview=c.preview, messages=c.messages)


class AssistantHomeOut(CamelModel):
    available: bool
    reason: Unavailable | None = Field(description="Why the assistant cannot answer yet; a person can still help")
    retention_days: int
    conversations: list[AssistantConversationSummaryOut]
    open_handovers: int

    @classmethod
    def build(cls, h: Home) -> "AssistantHomeOut":
        return cls(
            available=h.available, reason=h.reason, retention_days=rules.RETENTION_DAYS,  # type: ignore[arg-type]
            conversations=[AssistantConversationSummaryOut.build(c) for c in h.conversations], open_handovers=h.open_handovers,
        )


class AssistantConversationOut(CamelModel):
    id: uuid.UUID
    language: Language
    created_at: datetime
    last_message_at: datetime
    deleted_after: datetime = Field(description="When the oldest message shown is deleted (OD-48)")
    messages: list[AssistantMessageOut]

    @classmethod
    def build(cls, v: ConversationView) -> "AssistantConversationOut":
        oldest = v.messages[0].created_at if v.messages else v.conversation.last_message_at
        return cls(
            id=v.conversation.id, language=v.conversation.language, created_at=v.conversation.created_at,  # type: ignore[arg-type]
            last_message_at=v.conversation.last_message_at, deleted_after=oldest + timedelta(days=rules.RETENTION_DAYS),
            messages=[AssistantMessageOut.build(m) for m in v.messages],
        )


class AssistantAskIn(CamelModel):
    text: str = Field(min_length=1, max_length=rules.QUESTION_MAX)
    language: Language = "ta"
    conversation_id: uuid.UUID | None = Field(default=None, description="Left out to start a new conversation")


class AssistantAskOut(CamelModel):
    conversation_id: uuid.UUID
    question: AssistantMessageOut
    answer: AssistantMessageOut

    @classmethod
    def build(cls, a: Asked) -> "AssistantAskOut":
        return cls(conversation_id=a.conversation_id, question=AssistantMessageOut.build(a.question),
                   answer=AssistantMessageOut.build(a.answer))


class AssistantRatingIn(CamelModel):
    rating: Rating | None = Field(description="Null takes the rating back")


class AssistantErrorReportIn(CamelModel):
    note: str = Field(min_length=5, max_length=2000, description="What seems wrong")


class AssistantReceiptOut(CamelModel):
    id: uuid.UUID


class AssistantHandoverIn(CamelModel):
    request: str = Field(min_length=5, max_length=2000, description="What the member needs help with")
    language: Language = "ta"
    conversation_id: uuid.UUID | None = None
    share_conversation: bool = Field(description="The member agreed to share this conversation (FR-AIA-007)")


class AssistantHandoverOut(CamelModel):
    id: uuid.UUID
    request: str
    shared_messages: int
    state: HandoverState
    reply: str | None
    replied_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, h: Handover) -> "AssistantHandoverOut":
        return cls(id=h.id, request=h.request, shared_messages=len(h.transcript), state=h.state,  # type: ignore[arg-type]
                   reply=h.reply, replied_at=h.replied_at, created_at=h.created_at)


# --- Staff (D20) ---------------------------------------------------------------------------------------------


class AssistantSummaryOut(CamelModel):
    draft_sources: int
    approved_sources: int
    review_overdue: int = Field(description="Approved sources past their review date: not used until reviewed")
    review_due_soon: int
    open_error_reports: int
    open_handovers: int
    helpful_30_days: int
    not_helpful_30_days: int

    @classmethod
    def build(cls, s: Summary) -> "AssistantSummaryOut":
        return cls(
            draft_sources=s.sources.drafts, approved_sources=s.sources.approved, review_overdue=s.sources.review_overdue,
            review_due_soon=s.sources.review_due_soon, open_error_reports=s.queues.open_error_reports,
            open_handovers=s.queues.open_handovers, helpful_30_days=s.queues.helpful_30_days,
            not_helpful_30_days=s.queues.not_helpful_30_days,
        )


class AssistantErrorReportOut(CamelModel):
    id: uuid.UUID
    model_name: str | None
    question: str
    answer: str
    citations: list[AssistantCitationOut]
    note: str
    state: ErrorReportState
    resolution: str | None
    resolved_by_name: str | None
    resolved_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, r: ErrorReport) -> "AssistantErrorReportOut":
        return cls(
            id=r.id, model_name=r.model_name, question=r.question, answer=r.answer,
            citations=[AssistantCitationOut.build(c) for c in r.citations], note=r.note, state=r.state,  # type: ignore[arg-type]
            resolution=r.resolution, resolved_by_name=r.resolved_by_name, resolved_at=r.resolved_at, created_at=r.created_at,
        )


class AssistantResolveIn(CamelModel):
    outcome: Literal["fixed", "no_change"]
    resolution: str = Field(min_length=5, max_length=2000, description="What was changed, or why nothing was")


class AssistantTranscriptLineOut(CamelModel):
    role: Literal["member", "assistant"]
    body: str
    created_at: str


class AssistantStaffHandoverOut(CamelModel):
    id: uuid.UUID
    language: Language
    request: str
    transcript: list[AssistantTranscriptLineOut] = Field(description="Only when the member agreed to share it")
    state: HandoverState
    reply: str | None
    replied_by_name: str | None
    replied_at: datetime | None
    closed_at: datetime | None
    created_at: datetime

    @classmethod
    def build(cls, h: Handover) -> "AssistantStaffHandoverOut":
        return cls(
            id=h.id, language=h.language, request=h.request,  # type: ignore[arg-type]
            transcript=[AssistantTranscriptLineOut.model_validate(line) for line in h.transcript], state=h.state,  # type: ignore[arg-type]
            reply=h.reply, replied_by_name=h.replied_by_name, replied_at=h.replied_at, closed_at=h.closed_at,
            created_at=h.created_at,
        )


class AssistantReplyIn(CamelModel):
    reply: str = Field(min_length=5, max_length=3000)


class AssistantPreviewIn(CamelModel):
    question: str = Field(min_length=1, max_length=rules.QUESTION_MAX)
    language: Language = "ta"


class AssistantPreviewOut(CamelModel):
    model_id: uuid.UUID
    model_name: str
    model_status: Literal["shadow", "live", "retired"]
    redactions: list[RedactionKind]
    outcome: Outcome
    refusal: Refusal | None
    body: str
    topics: list[Literal["eligibility", "election"]]
    citations: list[AssistantCitationOut]
    model_called: bool = Field(description="False when no approved passage matched, so no model was asked")

    @classmethod
    def build(cls, p: Preview) -> "AssistantPreviewOut":
        a: Answer = p.answer
        return cls(
            model_id=p.model.id, model_name=f"{p.model.name} {p.model.version}", model_status=p.model.status,  # type: ignore[arg-type]
            redactions=p.redactions, outcome=a.outcome, refusal=a.refusal, body=a.body,  # type: ignore[arg-type]
            topics=[t for t in a.topics if t in ("eligibility", "election")],  # type: ignore[misc]
            citations=[AssistantCitationOut.build(c) for c in a.citations], model_called=a.model_called,
        )
