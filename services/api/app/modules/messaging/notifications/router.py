import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.messaging.notifications import service
from app.modules.messaging.notifications.schemas import ChoicesIn, ChoicesOut, DeviceIn, DeviceTokenIn, InboxOut, Topic

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

Db = Annotated[Session, Depends(get_db)]


@router.get("")
def read_inbox(
    member: CurrentMember,
    db: Db,
    view: Annotated[Literal["all", "action_needed"], Query()] = "all",
    topic: Annotated[Topic | None, Query(description="Category chips: review, events (issues and surveys later)")] = None,
    before: Annotated[datetime | None, Query(description="For paging: items older than this")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> InboxOut:
    """H03: All or Action needed, newest first, with the unread and action-needed counts (FR-HOME-009)."""
    return InboxOut.build(
        service.inbox(db, member.id, action_needed=view == "action_needed", topic=topic, before=before, limit=limit)
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT, responses={404: {"description": "not_found"}})
def mark_read(notification_id: uuid.UUID, member: CurrentMember, db: Db) -> None:
    """Read is separate from done: an item needing action stays under Action needed (FR-HOME-011)."""
    try:
        service.mark_read(db, member.id, notification_id)
    except service.NotificationNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(member: CurrentMember, db: Db) -> None:
    service.mark_all_read(db, member.id)


@router.get("/choices")
def read_choices(member: CurrentMember, db: Db) -> ChoicesOut:
    """P05: push and SMS per topic, and quiet hours (FR-PROF-012, FR-STF-009)."""
    return ChoicesOut.build(service.choices(db, member.id))


@router.put("/choices", responses={409: {"description": "topic_locked"}})
def update_choices(body: ChoicesIn, member: CurrentMember, db: Db) -> ChoicesOut:
    """Account and review notices cannot be turned off; asking to is refused, not ignored."""
    quiet = (None, None) if body.clear_quiet_hours else (
        (body.quiet_start, body.quiet_end) if body.quiet_start is not None else None
    )
    try:
        updated = service.update_choices(
            db, member.id, {choice.topic: (choice.push, choice.sms) for choice in body.topics}, quiet
        )
    except service.PreferenceRefused as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code) from None
    return ChoicesOut.build(updated)


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(body: DeviceIn, member: CurrentMember, db: Db) -> None:
    """The app's push token, after sign-in. A token used by someone else before moves to this member."""
    service.register_device(db, member.id, body.token, body.platform)


@router.post("/devices/unregister", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(body: DeviceTokenIn, member: CurrentMember, db: Db) -> None:
    """On sign-out, so nothing more is pushed to this phone for this member."""
    service.unregister_device(db, member.id, body.token)
