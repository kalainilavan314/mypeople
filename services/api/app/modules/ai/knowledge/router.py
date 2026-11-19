"""The assistant's knowledge base for Knowledge Editors (BRD D20, PRM-47): /v1/assistant/manage/sources.

Not behind the ai_assistant switch: the sources are written and approved before the assistant opens.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.ai.knowledge import rules, service
from app.modules.ai.knowledge.rules import Kind, State
from app.modules.ai.knowledge.schemas import (
    KbDecisionIn,
    KbRetireIn,
    KbReviewIn,
    KbSourceFileOut,
    KbSourceIn,
    KbSourceOut,
    KbSourceSummaryOut,
)

Db = Annotated[Session, Depends(get_db)]
Editor = Annotated[Staff, Depends(require_permission(rules.MANAGE))]

router = APIRouter(prefix="/v1/assistant/manage/sources", tags=["assistant-knowledge"])

REFUSED = {
    403: {"description": "forbidden, or own_draft when the drafter tries to approve"},
    404: {"description": "not_found"},
    422: {"description": "source_refused with problems"},
}


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.SourceNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.SourceRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "source_refused", "problems": error.problems}
        ) from None


@router.get("", response_model=list[KbSourceSummaryOut])
def list_sources(staff: Editor, db: Db, state: State | None = None, kind: Kind | None = None) -> list[KbSourceSummaryOut]:
    """Drafts, approved and retired sources; superseded versions are in each source's history."""
    return [KbSourceSummaryOut.build(s) for s in service.sources(db, staff, state, kind)]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=KbSourceOut, responses=REFUSED)
def draft_source(body: KbSourceIn, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    """Problems: source_text_required, review_date_must_be_ahead, review_date_too_far."""
    with _answers():
        return KbSourceOut.build(service.draft(db, staff, body.model_dump(), client_ip(request)))


@router.get("/{source_id}", response_model=KbSourceFileOut, responses=REFUSED)
def read_source(source_id: uuid.UUID, staff: Editor, db: Db) -> KbSourceFileOut:
    with _answers():
        return KbSourceFileOut.build(service.source_file(db, staff, source_id))


@router.put("/{source_id}", response_model=KbSourceOut, responses=REFUSED)
def edit_draft(source_id: uuid.UUID, body: KbSourceIn, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    """Drafts only; an approved source changes through a new version."""
    with _answers():
        return KbSourceOut.build(service.edit_draft(db, staff, source_id, body.model_dump(), client_ip(request)))


@router.post("/{source_id}/new-version", status_code=status.HTTP_201_CREATED, response_model=KbSourceOut, responses=REFUSED)
def new_version(source_id: uuid.UUID, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    """A draft of the next version from an approved one (draft_exists when one is already open)."""
    with _answers():
        return KbSourceOut.build(service.new_version(db, staff, source_id, client_ip(request)))


@router.post("/{source_id}/decision", response_model=KbSourceOut, responses=REFUSED)
def decide(source_id: uuid.UUID, body: KbDecisionIn, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    """A second Knowledge Editor approves; the drafter gets 403 own_draft. Sending back needs a reason."""
    with _answers():
        return KbSourceOut.build(service.decide(db, staff, source_id, body.approve, body.reason, client_ip(request)))


@router.post("/{source_id}/review", response_model=KbSourceOut, responses=REFUSED)
def mark_reviewed(source_id: uuid.UUID, body: KbReviewIn, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    """The approved text still stands: record the review and the next review date."""
    with _answers():
        return KbSourceOut.build(service.mark_reviewed(db, staff, source_id, body.review_due, client_ip(request)))


@router.post("/{source_id}/retire", response_model=KbSourceOut, responses=REFUSED)
def retire(source_id: uuid.UUID, body: KbRetireIn, staff: Editor, request: Request, db: Db) -> KbSourceOut:
    with _answers():
        return KbSourceOut.build(service.retire(db, staff, source_id, body.reason, client_ip(request)))
