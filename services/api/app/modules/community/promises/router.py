"""Promise Tracker (BRD M18, M19, D16, FR-PRM-001 to 010): /v1/promises."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.promises import rules, service
from app.modules.community.promises.rules import Status, Theme
from app.modules.community.promises.schemas import (
    ModerationIn,
    PendingWorkOut,
    PromiseDetailOut,
    PromiseFeedbackIn,
    PromiseFeedbackOut,
    PromiseIn,
    PromiseSummaryOut,
    PromiseUpdateIn,
    PromiseUpdateOut,
    PublicationDecisionIn,
    ReplyIn,
    ReportRowOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
PromiseStaff = Annotated[Staff, Depends(require_permission(rules.EDIT, rules.PUBLISH, service.MODERATE))]
Office = Annotated[Staff, Depends(require_permission(rules.EDIT))]
Publisher = Annotated[Staff, Depends(require_permission(rules.PUBLISH))]
Moderator = Annotated[Staff, Depends(require_permission(service.MODERATE))]

router = APIRouter(prefix="/v1/promises", tags=["promises"], dependencies=[Depends(require_feature("promises"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.PromiseNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.PromiseRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "promise_refused", "problems": error.problems}
        ) from None


def _area(body: PromiseIn) -> Area | None:
    if body.area is None:
        return None
    return Area(body.area.level, None if body.area.level == "platform" else body.area.code)


@router.get("", response_model=list[PromiseSummaryOut])
def list_promises(
    member: CurrentMember,
    db: Db,
    promise_status: Annotated[Status | None, Query(alias="status")] = None,
    theme: Theme | None = None,
    area: Annotated[str | None, Query(max_length=40, description="An area key such as district:LK41")] = None,
) -> list[PromiseSummaryOut]:
    """M18: every published promise, filterable by status, theme and area (FR-PRM-007)."""
    return [PromiseSummaryOut.build(p) for p in service.published(db, promise_status, theme, area)]


@router.get("/manage", response_model=list[PromiseSummaryOut])
def list_managed(
    staff: PromiseStaff, db: Db, promise_status: Annotated[Status | None, Query(alias="status")] = None,
    theme: Theme | None = None,
) -> list[PromiseSummaryOut]:
    with _answers():
        return [PromiseSummaryOut.build(p) for p in service.managed(db, staff, promise_status, theme)]


@router.get("/manage/pending", response_model=PendingWorkOut)
def pending_work(staff: PromiseStaff, db: Db) -> PendingWorkOut:
    """Updates waiting for a second person's approval, and feedback waiting for moderation."""
    updates, feedback = service.pending_work(db, staff)
    return PendingWorkOut(updates=[PromiseUpdateOut.build(u) for u in updates],
                          feedback=[PromiseFeedbackOut.build(f) for f in feedback])


@router.get("/manage/report", response_model=list[ReportRowOut])
def progress_report(staff: PromiseStaff, db: Db) -> list[ReportRowOut]:
    """FR-PRM-010: published promises by status, theme, office and area."""
    with _answers():
        rows = service.report(db, staff)
    return [ReportRowOut(status=s, theme=t, office_en=o, area_key=a, count=n) for s, t, o, a, n in rows]  # type: ignore[arg-type]


@router.post("/manage", status_code=status.HTTP_201_CREATED, response_model=PromiseDetailOut)
def draft_promise(body: PromiseIn, staff: Office, request: Request, db: Db) -> PromiseDetailOut:
    if body.area is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail={"code": "promise_refused", "problems": ["area_required"]})
    values = body.model_dump(exclude={"milestones", "area"})
    with _answers():
        promise = service.save_draft(db, staff, None, values, _area(body), [m.model_dump() for m in body.milestones],
                                     client_ip(request))
        return PromiseDetailOut.from_view(service.staff_view(db, staff, promise.id))


@router.get("/manage/{promise_id}", response_model=PromiseDetailOut)
def read_managed(promise_id: uuid.UUID, staff: PromiseStaff, db: Db) -> PromiseDetailOut:
    with _answers():
        return PromiseDetailOut.from_view(service.staff_view(db, staff, promise_id))


@router.put("/manage/{promise_id}", response_model=PromiseDetailOut)
def update_draft(promise_id: uuid.UUID, body: PromiseIn, staff: Office, request: Request, db: Db) -> PromiseDetailOut:
    """Drafts only; a published promise changes through dated updates."""
    values = body.model_dump(exclude={"milestones", "area"})
    with _answers():
        service.save_draft(db, staff, promise_id, values, None, [m.model_dump() for m in body.milestones], client_ip(request))
        return PromiseDetailOut.from_view(service.staff_view(db, staff, promise_id))


@router.post("/manage/{promise_id}/request-publication", response_model=PromiseDetailOut)
def request_publication(promise_id: uuid.UUID, staff: Office, request: Request, db: Db) -> PromiseDetailOut:
    with _answers():
        service.request_publication(db, staff, promise_id, client_ip(request))
        return PromiseDetailOut.from_view(service.staff_view(db, staff, promise_id))


@router.post("/manage/{promise_id}/publication-decision", response_model=PromiseDetailOut)
def decide_publication(promise_id: uuid.UUID, body: PublicationDecisionIn, staff: Publisher, request: Request,
                       db: Db) -> PromiseDetailOut:
    """FR-PRM-003: a second authorised person approves; the person who asked cannot (403 own_draft)."""
    with _answers():
        service.decide_publication(db, staff, promise_id, body.approve, body.reason, client_ip(request))
        return PromiseDetailOut.from_view(service.staff_view(db, staff, promise_id))


@router.post("/manage/{promise_id}/updates", status_code=status.HTTP_201_CREATED, response_model=PromiseUpdateOut)
def draft_update(promise_id: uuid.UUID, body: PromiseUpdateIn, staff: Office, request: Request, db: Db) -> PromiseUpdateOut:
    """A dated update with evidence, or a correction of an earlier one; applied once approved."""
    with _answers():
        return PromiseUpdateOut.build(service.draft_update(
            db, staff, promise_id, new_status=body.new_status, note_en=body.note_en, note_ta=body.note_ta,
            evidence_refs=body.evidence_refs, corrects_id=body.corrects_id, ip=client_ip(request),
        ))


@router.post("/manage/updates/{update_id}/decision", response_model=PromiseUpdateOut)
def decide_update(update_id: uuid.UUID, body: PublicationDecisionIn, staff: Publisher, request: Request,
                  db: Db) -> PromiseUpdateOut:
    with _answers():
        return PromiseUpdateOut.build(service.decide_update(db, staff, update_id, body.approve, body.reason, client_ip(request)))


@router.post("/manage/feedback/{feedback_id}/moderation", response_model=PromiseFeedbackOut)
def moderate_feedback(feedback_id: uuid.UUID, body: ModerationIn, staff: Moderator, request: Request,
                      db: Db) -> PromiseFeedbackOut:
    with _answers():
        return PromiseFeedbackOut.build(service.moderate_feedback(db, staff, feedback_id, body.publish, body.reason,
                                                                  client_ip(request)))


@router.post("/manage/feedback/{feedback_id}/reply", response_model=PromiseFeedbackOut)
def reply(feedback_id: uuid.UUID, body: ReplyIn, staff: Office, request: Request, db: Db) -> PromiseFeedbackOut:
    """The responsible office's reply, shown under the feedback (FR-PRM-006)."""
    with _answers():
        return PromiseFeedbackOut.build(service.reply_to_feedback(db, staff, feedback_id, body.reply_en, body.reply_ta,
                                                                  client_ip(request)))


@router.get("/{promise_id}", response_model=PromiseDetailOut)
def read_promise(promise_id: uuid.UUID, member: CurrentMember, db: Db) -> PromiseDetailOut:
    """M19: the promise with its milestones, approved updates (corrections beside the originals) and
    moderated feedback with the office's replies."""
    with _answers():
        return PromiseDetailOut.from_view(service.public_view(db, promise_id))


@router.post("/{promise_id}/feedback", status_code=status.HTTP_201_CREATED, response_model=PromiseFeedbackOut)
def give_feedback(promise_id: uuid.UUID, body: PromiseFeedbackIn, member: CurrentMember, request: Request,
                  db: Db) -> PromiseFeedbackOut:
    """Shown to others only after moderation."""
    with _answers():
        return PromiseFeedbackOut.build(service.give_feedback(db, member.id, promise_id, body.body, client_ip(request)))
