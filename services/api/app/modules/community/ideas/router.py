"""Community ideas (BRD H13, FR-IDEA-001 to 004): /v1/ideas."""

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
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.ideas import service
from app.modules.community.ideas.schemas import (
    IdeaBoardOut,
    IdeaIn,
    IdeaModerationIn,
    IdeaOut,
    PendingIdeaOut,
    SupportIn,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Moderator = Annotated[Staff, Depends(require_permission(service.MODERATE))]

router = APIRouter(prefix="/v1/ideas", tags=["ideas"], dependencies=[Depends(require_feature("ideas_surveys"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.IdeaNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.IdeaRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "idea_refused", "problems": error.problems}
        ) from None


@router.get("", response_model=IdeaBoardOut)
def read_board(member: CurrentMember, db: Db) -> IdeaBoardOut:
    """H13: Local ideas (published in the member's area) and My ideas (every state)."""
    found = service.board(db, member.id)
    return IdeaBoardOut(
        local=[IdeaOut.build(i, member.id) for i in found.local],
        mine=[IdeaOut.build(i, member.id, found.appeals.get(i.id)) for i in found.mine],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=IdeaOut)
def submit_idea(body: IdeaIn, member: CurrentMember, request: Request, db: Db) -> IdeaOut:
    """FR-IDEA-002: a receipt; shown to others only after moderation."""
    with _answers():
        return IdeaOut.build(service.submit(db, member.id, body.title, body.benefit, client_ip(request)), member.id)


@router.put("/{idea_id}/support", response_model=IdeaOut)
def set_support(idea_id: uuid.UUID, body: SupportIn, member: CurrentMember, db: Db) -> IdeaOut:
    """FR-IDEA-004: one support per member; it never changes the idea's status."""
    with _answers():
        return IdeaOut.build(service.set_support(db, member.id, idea_id, body.support), member.id)


@router.post("/{idea_id}/withdraw", response_model=IdeaOut)
def withdraw_idea(idea_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> IdeaOut:
    with _answers():
        return IdeaOut.build(service.withdraw(db, member.id, idea_id, client_ip(request)), member.id)


@router.get("/moderation", response_model=list[PendingIdeaOut])
def list_pending(staff: Moderator, db: Db) -> list[PendingIdeaOut]:
    """D12: ideas waiting for moderation in the moderator's areas, oldest first."""
    return [PendingIdeaOut.build(i) for i in service.pending(db, staff)]


@router.post("/{idea_id}/moderation", response_model=PendingIdeaOut)
def moderate_idea(idea_id: uuid.UUID, body: IdeaModerationIn, staff: Moderator, request: Request, db: Db) -> PendingIdeaOut:
    """D12: publish as written, publish an edited (redacted) version, or reject with a reason.
    Problems: reason_required, already_moderated, edits_only_when_publishing, edited_title_length,
    edited_benefit_length."""
    edits = service.Edits(title=body.edited_title, benefit=body.edited_benefit)
    with _answers():
        return PendingIdeaOut.build(
            service.moderate(db, staff, idea_id, body.publish, body.reason, client_ip(request), edits)
        )
