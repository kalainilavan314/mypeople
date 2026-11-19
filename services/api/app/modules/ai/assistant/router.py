"""The Tamil AI assistant (BRD M28, FR-AIA-001 to 010): /v1/assistant, and the Knowledge Editor's queues
(D20, PRM-47): /v1/assistant/manage.

The member routes sit behind the ai_assistant switch (404 feature_unavailable while it is off). The
staff routes do not: sources are prepared and the model tried in shadow mode before the switch opens.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.ai.assistant import service
from app.modules.ai.assistant.schemas import (
    AssistantAskIn,
    AssistantAskOut,
    AssistantConversationOut,
    AssistantErrorReportIn,
    AssistantErrorReportOut,
    AssistantHandoverIn,
    AssistantHandoverOut,
    AssistantHomeOut,
    AssistantMessageOut,
    AssistantPreviewIn,
    AssistantPreviewOut,
    AssistantRatingIn,
    AssistantReceiptOut,
    AssistantReplyIn,
    AssistantResolveIn,
    AssistantStaffHandoverOut,
    AssistantSummaryOut,
)
from app.modules.ai.knowledge import rules as knowledge_rules
from app.modules.ai.providers import AnswerProvider
from app.modules.ai.registry import rules as registry_rules
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Editor = Annotated[Staff, Depends(require_permission(knowledge_rules.MANAGE))]
Tester = Annotated[
    Staff, Depends(require_permission(knowledge_rules.MANAGE, registry_rules.MONITOR, registry_rules.APPROVE))
]

router = APIRouter(prefix="/v1/assistant", tags=["assistant"], dependencies=[Depends(require_feature("ai_assistant"))])
manage_router = APIRouter(prefix="/v1/assistant/manage", tags=["assistant-knowledge"])

REFUSED = {
    404: {"description": "not_found, or feature_unavailable while the assistant is switched off"},
    409: {"description": "assistant_refused: already_reported, already_resolved, already_closed, conversation_required"},
    429: {"description": "too_many_questions (30 an hour), too_many_reports_today, too_many_open_requests"},
    503: {"description": "assistant_unavailable: provider_not_configured, model_not_approved or model_not_registered"},
}
_LIMITS = frozenset({"too_many_questions", "too_many_reports_today", "too_many_open_requests"})


def _provider(request: Request) -> AnswerProvider | None:
    return request.app.state.assistant_provider


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.AssistantNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.AssistantUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "assistant_unavailable", "problems": [error.reason]}
        ) from None
    except service.AssistantRefused as error:
        code = status.HTTP_429_TOO_MANY_REQUESTS if error.code in _LIMITS else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"code": "assistant_refused", "problems": [error.code]}) from None


# --- Members (M28) -------------------------------------------------------------------------------------------


@router.get("", response_model=AssistantHomeOut)
def assistant_home(member: CurrentMember, request: Request, db: Db) -> AssistantHomeOut:
    """Whether the assistant can answer now (and why not), the member's recent conversations and open
    requests for a person. Any signed-in member may use it."""
    return AssistantHomeOut.build(service.home(db, _provider(request), member.id))


@router.post("/messages", response_model=AssistantAskOut, responses=REFUSED)
def ask(body: AssistantAskIn, member: CurrentMember, request: Request, db: Db) -> AssistantAskOut:
    """Ask in Tamil or English. Identifiers are removed first (the question's `redactions` say which);
    the answer cites approved sources, with official text quoted word for word, or says it cannot answer."""
    with _answers():
        return AssistantAskOut.build(
            service.ask(db, _provider(request), member.id, body.conversation_id, body.text, body.language)
        )


@router.get("/conversations/{conversation_id}", response_model=AssistantConversationOut, responses=REFUSED)
def read_conversation(conversation_id: uuid.UUID, member: CurrentMember, db: Db) -> AssistantConversationOut:
    """The member's own conversation: messages from the last 30 days (OD-48)."""
    with _answers():
        return AssistantConversationOut.build(service.conversation(db, member.id, conversation_id))


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, responses=REFUSED)
def delete_conversation(conversation_id: uuid.UUID, member: CurrentMember, db: Db) -> Response:
    with _answers():
        service.delete_conversation(db, member.id, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/messages/{message_id}/rating", response_model=AssistantMessageOut, responses=REFUSED)
def rate_answer(message_id: uuid.UUID, body: AssistantRatingIn, member: CurrentMember, db: Db) -> AssistantMessageOut:
    with _answers():
        return AssistantMessageOut.build(service.rate(db, member.id, message_id, body.rating))


@router.post("/messages/{message_id}/error-report", status_code=status.HTTP_201_CREATED, response_model=AssistantReceiptOut,
             responses=REFUSED)
def report_error(message_id: uuid.UUID, body: AssistantErrorReportIn, member: CurrentMember, request: Request,
                 db: Db) -> AssistantReceiptOut:
    """FR-AIA-008: the question, the answer and its citations go to the Knowledge Editor (D20)."""
    with _answers():
        return AssistantReceiptOut(id=service.report_error(db, member.id, message_id, body.note, client_ip(request)))


@router.get("/handovers", response_model=list[AssistantHandoverOut])
def my_handovers(member: CurrentMember, db: Db) -> list[AssistantHandoverOut]:
    return [AssistantHandoverOut.build(h) for h in service.my_handovers(db, member.id)]


@router.post("/handovers", status_code=status.HTTP_201_CREATED, response_model=AssistantHandoverOut, responses=REFUSED)
def request_handover(body: AssistantHandoverIn, member: CurrentMember, request: Request, db: Db) -> AssistantHandoverOut:
    """FR-AIA-007: ask for a person. The conversation is shared only with shareConversation true."""
    with _answers():
        return AssistantHandoverOut.build(service.request_handover(
            db, member.id, body.request, body.conversation_id, body.share_conversation, body.language, client_ip(request)
        ))


# --- Knowledge Editors (D20) -------------------------------------------------------------------------------


@manage_router.get("/summary", response_model=AssistantSummaryOut)
def summary(staff: Editor, db: Db) -> AssistantSummaryOut:
    return AssistantSummaryOut.build(service.summary(db, staff))


@manage_router.get("/error-reports", response_model=list[AssistantErrorReportOut])
def error_reports(staff: Editor, db: Db, state: Literal["open", "fixed", "no_change"] | None = None) -> list[AssistantErrorReportOut]:
    """The Knowledge Editor's queue (FR-AIA-008); open reports first. Never names who reported."""
    return [AssistantErrorReportOut.build(r) for r in service.error_reports(db, staff, state)]


@manage_router.post("/error-reports/{report_id}/resolve", response_model=AssistantErrorReportOut, responses=REFUSED)
def resolve_error_report(report_id: uuid.UUID, body: AssistantResolveIn, staff: Editor, request: Request,
                         db: Db) -> AssistantErrorReportOut:
    with _answers():
        return AssistantErrorReportOut.build(
            service.resolve_error_report(db, staff, report_id, body.outcome, body.resolution, client_ip(request))
        )


@manage_router.get("/handovers", response_model=list[AssistantStaffHandoverOut])
def handovers(staff: Editor, db: Db, state: Literal["open", "answered", "closed"] | None = None) -> list[AssistantStaffHandoverOut]:
    """[ASSUMPTION] Knowledge Editors answer requests for a person until a help desk exists."""
    return [AssistantStaffHandoverOut.build(h) for h in service.handovers(db, staff, state)]


@manage_router.post("/handovers/{handover_id}/reply", response_model=AssistantStaffHandoverOut, responses=REFUSED)
def reply_handover(handover_id: uuid.UUID, body: AssistantReplyIn, staff: Editor, request: Request,
                   db: Db) -> AssistantStaffHandoverOut:
    """The member is notified and reads the reply in the app."""
    with _answers():
        return AssistantStaffHandoverOut.build(service.reply_handover(db, staff, handover_id, body.reply, client_ip(request)))


@manage_router.post("/handovers/{handover_id}/close", response_model=AssistantStaffHandoverOut, responses=REFUSED)
def close_handover(handover_id: uuid.UUID, staff: Editor, request: Request, db: Db) -> AssistantStaffHandoverOut:
    with _answers():
        return AssistantStaffHandoverOut.build(service.close_handover(db, staff, handover_id, client_ip(request)))


@manage_router.post("/try", response_model=AssistantPreviewOut, responses=REFUSED)
def try_question(body: AssistantPreviewIn, staff: Tester, request: Request, db: Db) -> AssistantPreviewOut:
    """Try a question against the approved sources with the configured model, in shadow mode too.
    Logged as a staff preview (NFR-AI-01); nothing is kept but the log entry."""
    with _answers():
        return AssistantPreviewOut.build(
            service.preview(db, _provider(request), staff, body.question, body.language, client_ip(request))
        )
