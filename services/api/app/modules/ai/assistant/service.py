"""The Tamil AI assistant (BRD M28, FR-AIA-001 to 010, BR-125 to 128, 15B.6, 15B.8, OD-42, OD-48).

A member asks in Tamil or English. Their words are stripped of NIC numbers, phone numbers, case
references and e-mail addresses before anything is kept or sent (FR-AIA-009). The approved
knowledge base is searched; with no passage found, the assistant says it cannot answer and offers
a person, without calling any model. Otherwise the live model (D21) writes an answer from those
passages only, which is checked (rules.check_answer) and logged (NFR-AI-01) before the member
sees it. Members rate answers, report errors to the Knowledge Editor queue (FR-AIA-008) and can
ask for a person, sharing the conversation only if they agree (FR-AIA-007). Messages are deleted
after 30 days (OD-48) and never used for training (BR-128).

Nothing about the member except their words reaches the model: no name, area, household,
membership or case (BR-127). Their area is read only to hold back manifesto material during an
election silence period.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM
from app.modules.access.service import Staff, refuse
from app.modules.ai.assistant import prompt, repository, rules
from app.modules.ai.assistant.repository import (
    Conversation,
    ConversationSummary,
    ErrorReport,
    Handover,
    Message,
    Purged,
    QueueCounts,
)
from app.modules.ai.knowledge import rules as knowledge_rules
from app.modules.ai.knowledge import service as knowledge
from app.modules.ai.knowledge.repository import Hit, SourceCounts
from app.modules.ai.providers import AnswerProvider
from app.modules.ai.redaction import redact
from app.modules.ai.registry import repository as registry_repository
from app.modules.ai.registry import rules as registry_rules
from app.modules.ai.registry import service as registry
from app.modules.ai.registry.repository import Model
from app.modules.audit import service as audit
from app.modules.election import service as election
from app.modules.messaging.notifications import service as notifications

TASK = "assistant"


class AssistantUnavailable(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class AssistantRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class AssistantNotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _kept_since() -> datetime:
    return _now() - timedelta(days=rules.RETENTION_DAYS)


def availability(db: Session, provider: AnswerProvider | None) -> tuple[Model | None, str | None]:
    """The live registry entry that may answer members, or why there is none (fails closed)."""
    if provider is None:
        return None, "provider_not_configured"
    model = registry.live_model(db, TASK, provider.code, provider.model_ref)
    if model is None:
        return None, "model_not_approved"
    return model, None


# --- Writing an answer -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class Answer:
    outcome: str
    refusal: str | None
    body: str
    topics: list[str]
    citations: list[dict[str, Any]]
    model_called: bool
    latency_ms: int = 0
    input_tokens: int | None = None
    output_tokens: int | None = None


def _in_silence(db: Session, member_id: uuid.UUID | None) -> bool:
    if member_id is None:
        return False
    keys = [area.key for area in access_repository.member_area_path(db, member_id)]
    return bool(keys) and bool(election.silences(db, keys, _now()))


def _citations(hits: list[Hit], cited: list[int], quotes: list[tuple[int, str]]) -> list[dict[str, Any]]:
    """One citation per source version, in the order the answer cited them, with its verbatim quotes."""
    by_source: dict[uuid.UUID, dict[str, Any]] = {}
    for number in cited:
        hit = hits[number - 1]
        citation = by_source.setdefault(hit.source_id, {
            "sourceId": str(hit.source_id), "familyId": str(hit.family_id), "version": hit.version, "kind": hit.kind,
            "titleTa": hit.title_ta, "titleEn": hit.title_en, "publisher": hit.publisher, "sourceUrl": hit.source_url,
            "quotes": [],
        })
        for quoted_number, words in quotes:
            if quoted_number == number:
                citation["quotes"].append({"language": hit.language, "text": words})
    return list(by_source.values())


def _answer(db: Session, provider: AnswerProvider, *, language: str, question: str, history: list[tuple[str, str]],
            member_id: uuid.UUID | None) -> Answer:
    flags = rules.topic_flags(question)
    question_terms = knowledge_rules.terms(question)
    if len(question_terms) < 2:
        # A short follow-up ("and in Mannar?") is searched together with the member's previous question.
        earlier = next((words for role, words in reversed(history) if role == "member"), "")
        question_terms = list(dict.fromkeys(question_terms + knowledge_rules.terms(earlier)))
    hits = knowledge.search(db, question_terms, excluded_kinds=rules.excluded_kinds(in_silence=_in_silence(db, member_id)),
                            limit=rules.PASSAGES)
    topics = [flag for flag in flags if flag in prompt.TOPICS]
    if not hits:
        # FR-AIA-003: no approved source, so no model is asked; the member is offered a person.
        return Answer("no_source", None, rules.fixed_text("no_source", language), topics, [], model_called=False)
    excerpts = [
        prompt.Excerpt(number=index + 1, kind=hit.kind, language=hit.language,
                       title=hit.title_ta if hit.language == "ta" else hit.title_en, publisher=hit.publisher, text=hit.body)
        for index, hit in enumerate(hits)
    ]
    content = prompt.user_content(language=language, question=question, excerpts=excerpts, history=history,
                                  reminders=rules.reminders(flags))
    reply = provider.answer(content)
    tokens = {"latency_ms": reply.latency_ms, "input_tokens": reply.input_tokens, "output_tokens": reply.output_tokens}
    if reply.stop == "refused":
        return Answer("refused", "other", rules.fixed_text("refused", language), topics, [], model_called=True, **tokens)
    if reply.stop == "failed" or reply.data is None:
        return Answer("failed", None, rules.fixed_text("failed", language), topics, [], model_called=True, **tokens)
    checked = rules.check_answer(reply.data, {excerpt.number: excerpt.text for excerpt in excerpts}, language)
    return Answer(
        checked.outcome, checked.refusal, checked.explanation, list(dict.fromkeys(topics + checked.topics)),
        _citations(hits, checked.sources, checked.quotes), model_called=True, **tokens,
    )


def _log(db: Session, model: Model, purpose: str, answer: Answer, message_id: uuid.UUID | None) -> None:
    if not answer.model_called:
        return
    registry_repository.log_inference(
        db, model_id=model.id, task=TASK, purpose=purpose, outcome=answer.outcome, refusal=answer.refusal,
        cited=[{"sourceId": c["sourceId"], "version": c["version"]} for c in answer.citations], message_id=message_id,
        latency_ms=answer.latency_ms, input_tokens=answer.input_tokens, output_tokens=answer.output_tokens,
    )


# --- Members (M28) ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Home:
    available: bool
    reason: str | None
    conversations: list[ConversationSummary]
    open_handovers: int


def home(db: Session, provider: AnswerProvider | None, member_id: uuid.UUID) -> Home:
    _model, reason = availability(db, provider)
    return Home(reason is None, reason, repository.recent_conversations(db, member_id, _kept_since()),
                repository.open_handovers(db, member_id))


def _own_conversation(db: Session, member_id: uuid.UUID, conversation_id: uuid.UUID) -> Conversation:
    conversation = repository.find_conversation(db, conversation_id)
    if conversation is None or conversation.member_id != member_id:
        raise AssistantNotFound()
    return conversation


@dataclass(frozen=True)
class ConversationView:
    conversation: Conversation
    messages: list[Message]


def conversation(db: Session, member_id: uuid.UUID, conversation_id: uuid.UUID) -> ConversationView:
    found = _own_conversation(db, member_id, conversation_id)
    return ConversationView(found, repository.messages(db, conversation_id, _kept_since()))


def delete_conversation(db: Session, member_id: uuid.UUID, conversation_id: uuid.UUID) -> None:
    """The member may delete their own conversation at any time."""
    _own_conversation(db, member_id, conversation_id)
    repository.delete_conversation(db, conversation_id)
    db.commit()


@dataclass(frozen=True)
class Asked:
    conversation_id: uuid.UUID
    question: Message
    answer: Message


def ask(db: Session, provider: AnswerProvider | None, member_id: uuid.UUID, conversation_id: uuid.UUID | None, text: str,
        language: str) -> Asked:
    if repository.questions_since(db, member_id, _now() - timedelta(hours=1)) >= rules.QUESTIONS_PER_HOUR:
        raise AssistantRefused("too_many_questions")
    model, reason = availability(db, provider)
    if model is None or provider is None:
        raise AssistantUnavailable(reason or "provider_not_configured")
    if conversation_id is None:
        conversation_id = repository.create_conversation(db, member_id, language)
        history: list[tuple[str, str]] = []
    else:
        _own_conversation(db, member_id, conversation_id)
        earlier = repository.messages(db, conversation_id, _kept_since())[-rules.HISTORY_MESSAGES:]
        history = [(m.role, m.body) for m in earlier]
    redacted = redact(text.strip(), language)
    question_id = repository.insert_message(db, conversation_id, role="member", body=redacted.text,
                                            redactions=list(redacted.kinds))
    repository.touch_conversation(db, conversation_id, language)
    # The question is kept before the model is asked, so a slow or failed answer loses nothing.
    db.commit()

    answer = _answer(db, provider, language=language, question=redacted.text, history=history, member_id=member_id)
    answer_id = repository.insert_message(
        db, conversation_id, role="assistant", body=answer.body, outcome=answer.outcome, refusal=answer.refusal,
        topics=answer.topics, citations=answer.citations, model_id=model.id if answer.model_called else None,
    )
    _log(db, model, "member", answer, answer_id)
    repository.touch_conversation(db, conversation_id, language)
    db.commit()
    question = repository.find_message(db, question_id)
    reply = repository.find_message(db, answer_id)
    assert question is not None and reply is not None
    return Asked(conversation_id, question, reply)


def _own_answer(db: Session, member_id: uuid.UUID, message_id: uuid.UUID) -> Message:
    message = repository.find_message(db, message_id)
    if message is None or message.member_id != member_id or message.role != "assistant" or message.created_at < _kept_since():
        raise AssistantNotFound()
    return message


def rate(db: Session, member_id: uuid.UUID, message_id: uuid.UUID, rating: str | None) -> Message:
    _own_answer(db, member_id, message_id)
    repository.set_rating(db, message_id, rating)
    db.commit()
    rated = repository.find_message(db, message_id)
    assert rated is not None
    return rated


def report_error(db: Session, member_id: uuid.UUID, message_id: uuid.UUID, note: str, ip: str) -> uuid.UUID:
    """FR-AIA-008: the question, the answer and its citations reach the Knowledge Editor's queue (D20).
    The reporter is never shown to staff."""
    message = _own_answer(db, member_id, message_id)
    if message.reported:
        raise AssistantRefused("already_reported")
    if repository.error_reports_since(db, member_id, _now() - timedelta(days=1)) >= rules.ERROR_REPORTS_PER_DAY:
        raise AssistantRefused("too_many_reports_today")
    conversation = repository.find_conversation(db, message.conversation_id)
    language = conversation.language if conversation else "ta"
    question = repository.question_before(db, message) or "—"
    report_id = repository.insert_error_report(db, message=message, member_id=member_id, question=question,
                                               note=redact(note.strip(), language).text)
    audit.record(db, actor_id=member_id, action="assistant.error_reported", target_type="assistant_error_report",
                 target_id=str(report_id), ip=ip)
    db.commit()
    return report_id


def request_handover(db: Session, member_id: uuid.UUID, request: str, conversation_id: uuid.UUID | None,
                     share_conversation: bool, language: str, ip: str) -> Handover:
    """FR-AIA-007: the conversation is copied only when the member ticked that they agree to share it."""
    if repository.open_handovers(db, member_id) >= rules.OPEN_HANDOVERS_MAX:
        raise AssistantRefused("too_many_open_requests")
    transcript: list[dict[str, Any]] = []
    if share_conversation:
        if conversation_id is None:
            raise AssistantRefused("conversation_required")
        _own_conversation(db, member_id, conversation_id)
        transcript = [
            {"role": m.role, "body": m.body, "createdAt": m.created_at.isoformat()}
            for m in repository.messages(db, conversation_id, _kept_since())
        ]
    handover_id = repository.insert_handover(db, member_id=member_id, language=language,
                                             request=redact(request.strip(), language).text, transcript=transcript)
    audit.record(db, actor_id=member_id, action="assistant.handover_requested", target_type="assistant_handover",
                 target_id=str(handover_id), details={"conversationShared": bool(transcript)}, ip=ip)
    db.commit()
    found = repository.find_handover(db, handover_id)
    assert found is not None
    return found


def my_handovers(db: Session, member_id: uuid.UUID) -> list[Handover]:
    return repository.member_handovers(db, member_id)


# --- Knowledge Editors (D20) --------------------------------------------------------------------------------


def _require(db: Session, staff: Staff, permissions: tuple[str, ...], ip: str, target: tuple[str, str]) -> None:
    if not any(access_rules.holds(staff.rule_assignments(), permission) for permission in permissions):
        refuse(db, staff, "/".join(permissions), "forbidden", ip, target=target, area_path=(PLATFORM,))


@dataclass(frozen=True)
class Summary:
    sources: SourceCounts
    queues: QueueCounts


def summary(db: Session, staff: Staff) -> Summary:
    return Summary(knowledge.counts(db), repository.queue_counts(db, _now() - timedelta(days=30)))


def error_reports(db: Session, staff: Staff, state: str | None) -> list[ErrorReport]:
    return repository.error_reports(db, [state] if state else ["open", "fixed", "no_change"])


def resolve_error_report(db: Session, staff: Staff, report_id: uuid.UUID, outcome: str, resolution: str, ip: str) -> ErrorReport:
    _require(db, staff, (knowledge_rules.MANAGE,), ip, ("assistant_error_report", str(report_id)))
    report = repository.find_error_report(db, report_id, lock=True)
    if report is None:
        raise AssistantNotFound()
    if report.state != "open":
        raise AssistantRefused("already_resolved")
    repository.resolve_error_report(db, report_id, outcome, resolution.strip(), staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="assistant.error_report_resolved", target_type="assistant_error_report",
                 target_id=str(report_id), area_path=(PLATFORM,), details={"outcome": outcome}, ip=ip)
    db.commit()
    found = repository.find_error_report(db, report_id)
    assert found is not None
    return found


def handovers(db: Session, staff: Staff, state: str | None) -> list[Handover]:
    return repository.handovers(db, [state] if state else ["open", "answered", "closed"])


def reply_handover(db: Session, staff: Staff, handover_id: uuid.UUID, reply: str, ip: str) -> Handover:
    """The reply reaches the member in the app; the member's name and contact details are never shown."""
    _require(db, staff, (knowledge_rules.MANAGE,), ip, ("assistant_handover", str(handover_id)))
    handover = repository.find_handover(db, handover_id, lock=True)
    if handover is None:
        raise AssistantNotFound()
    if handover.state == "closed":
        raise AssistantRefused("already_closed")
    repository.reply_handover(db, handover_id, reply.strip(), staff.member_id)
    notifications.notify(db, handover.member_id, "assistant_handover_answered", handover_id)
    audit.record(db, actor_id=staff.member_id, action="assistant.handover_answered", target_type="assistant_handover",
                 target_id=str(handover_id), area_path=(PLATFORM,), ip=ip)
    db.commit()
    found = repository.find_handover(db, handover_id)
    assert found is not None
    return found


def close_handover(db: Session, staff: Staff, handover_id: uuid.UUID, ip: str) -> Handover:
    _require(db, staff, (knowledge_rules.MANAGE,), ip, ("assistant_handover", str(handover_id)))
    handover = repository.find_handover(db, handover_id, lock=True)
    if handover is None:
        raise AssistantNotFound()
    if handover.state == "closed":
        raise AssistantRefused("already_closed")
    repository.close_handover(db, handover_id)
    audit.record(db, actor_id=staff.member_id, action="assistant.handover_closed", target_type="assistant_handover",
                 target_id=str(handover_id), area_path=(PLATFORM,), ip=ip)
    db.commit()
    found = repository.find_handover(db, handover_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class Preview:
    model: Model
    answer: Answer
    redactions: list[str]


def preview(db: Session, provider: AnswerProvider | None, staff: Staff, question: str, language: str, ip: str) -> Preview:
    """A Knowledge Editor or the AI Governance Lead tries a question against the approved sources with
    the configured model, even in shadow mode. Logged as a preview; never shown to members."""
    _require(db, staff, (knowledge_rules.MANAGE, registry_rules.MONITOR, registry_rules.APPROVE), ip,
             ("assistant_preview", "try"))
    if provider is None:
        raise AssistantUnavailable("provider_not_configured")
    model = registry.preview_model(db, TASK, provider.code, provider.model_ref)
    if model is None:
        raise AssistantUnavailable("model_not_registered")
    redacted = redact(question.strip(), language)
    answer = _answer(db, provider, language=language, question=redacted.text, history=[], member_id=None)
    _log(db, model, "staff_preview", answer, None)
    db.commit()
    return Preview(model, answer, list(redacted.kinds))


# --- Retention (OD-48) ---------------------------------------------------------------------------------------


def purge_expired(db: Session, now: datetime | None = None) -> Purged:
    """Run daily by app.tasks.cleanup. Reads already hide anything older, so a late run exposes nothing."""
    moment = now or _now()
    purged = repository.purge(
        db,
        messages_before=moment - timedelta(days=rules.RETENTION_DAYS),
        handovers_before=moment - timedelta(days=rules.HANDOVER_KEEP_DAYS),
        reports_before=moment - timedelta(days=rules.ERROR_REPORT_KEEP_DAYS),
    )
    db.commit()
    return purged
