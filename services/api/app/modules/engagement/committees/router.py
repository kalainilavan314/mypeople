"""Wings and committees (BRD M31, M32, S18, D23; FR-COM-001 to 009): /v1/committees.

Member and coordinator routes take the signed-in member: a coordinator's rights come from their
role in that one committee (PRM-50, scope C), which the service checks on every call. The
administration routes (D23) need roles.assign or system.configure and check the committee's area.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.engagement.committees import rules, service
from app.modules.engagement.committees.rules import CommitteeState, WingType
from app.modules.engagement.committees.schemas import (
    CommitteeAdminOut,
    CommitteeAdminDetailOut,
    CommitteeApplicationDecisionIn,
    CommitteeApplicationIn,
    CommitteeCardOut,
    CommitteeOut,
    CommitteeProposalIn,
    CommitteeSpaceOut,
    CommitteeCoordinatingOut,
    CommitteeDecisionIn,
    CommitteeItemIn,
    CommitteeItemOut,
    CommitteeManageOut,
    CommitteeMembershipOut,
    CommitteePostDecisionIn,
    CommitteePostIn,
    CommitteePostOut,
    CommitteeReasonIn,
    CommitteeRoleGrantIn,
    CommitteeRoleIn,
    CommitteeRosterEntryOut,
    CommitteeSignupIn,
    CommitteeSignupsOut,
    CommitteeThreadIn,
    CommitteeThreadOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Administrator = Annotated[Staff, Depends(require_permission(rules.ADMINISTER, rules.APPROVE))]
Approver = Annotated[Staff, Depends(require_permission(rules.APPROVE))]

router = APIRouter(prefix="/v1/committees", tags=["committees"], dependencies=[Depends(require_feature("committees"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.CommitteeNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.CommitteeRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "committee_refused", "problems": error.problems}
        ) from None


def _today():
    return service._today()


# --- Administration (D23); declared first so "/admin" is never read as a committee id -----------------------


@router.get("/admin", response_model=list[CommitteeAdminOut])
def admin_list(
    staff: Administrator, db: Db, committee_state: Annotated[CommitteeState | None, Query(alias="state")] = None,
    wing_type: WingType | None = None,
) -> list[CommitteeAdminOut]:
    """D23: wings and committees in the administrator's areas, proposals included."""
    return [CommitteeAdminOut.build(c) for c in service.admin_list(db, staff, [committee_state] if committee_state else None,
                                                                   wing_type)]


@router.post("/admin", status_code=status.HTTP_201_CREATED, response_model=CommitteeAdminOut)
def propose(body: CommitteeProposalIn, staff: Administrator, request: Request, db: Db) -> CommitteeAdminOut:
    """FR-COM-001: proposed now; it exists for members once a Tier 5 approves it."""
    area = Area(body.area.level, None if body.area.level == "platform" else body.area.code)
    with _answers():
        return CommitteeAdminOut.build(service.propose(db, staff, body.model_dump(exclude={"area"}), area, client_ip(request)))


@router.get("/admin/{committee_id}", response_model=CommitteeAdminDetailOut)
def admin_read(committee_id: uuid.UUID, staff: Administrator, request: Request, db: Db) -> CommitteeAdminDetailOut:
    """The roster with roles and the activity counts; never the committee's content (RB-08)."""
    with _answers():
        return CommitteeAdminDetailOut.from_view(service.admin_view(db, staff, committee_id, client_ip(request)))


@router.post("/admin/{committee_id}/decision", response_model=CommitteeAdminOut)
def admin_decide(committee_id: uuid.UUID, body: CommitteeDecisionIn, staff: Approver, request: Request, db: Db) -> CommitteeAdminOut:
    """Tier 5 approves, or rejects with a reason (FR-COM-001)."""
    with _answers():
        return CommitteeAdminOut.build(service.decide(db, staff, committee_id, body.approve, body.reason, client_ip(request)))


@router.post("/admin/{committee_id}/close", response_model=CommitteeAdminOut)
def admin_close(committee_id: uuid.UUID, body: CommitteeReasonIn, staff: Approver, request: Request, db: Db) -> CommitteeAdminOut:
    with _answers():
        return CommitteeAdminOut.build(service.close(db, staff, committee_id, body.reason, client_ip(request)))


@router.post("/admin/{committee_id}/roles", response_model=CommitteeRosterEntryOut)
def admin_grant_role(committee_id: uuid.UUID, body: CommitteeRoleGrantIn, staff: Administrator, request: Request,
                     db: Db) -> CommitteeRosterEntryOut:
    """FR-COM-003: an explicit role grant by member code, logged with the administrator."""
    with _answers():
        return CommitteeRosterEntryOut.build(service.grant_role(db, staff, committee_id, body.member_code, body.role,
                                                       client_ip(request)))


@router.post("/admin/{committee_id}/members/{membership_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def admin_remove(committee_id: uuid.UUID, membership_id: uuid.UUID, body: CommitteeReasonIn, staff: Administrator,
                 request: Request, db: Db) -> Response:
    with _answers():
        service.admin_remove(db, staff, committee_id, membership_id, body.reason, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Coordinators and secretaries (S18) ------------------------------------------------------------------


@router.get("/coordinating", response_model=list[CommitteeCoordinatingOut])
def list_coordinating(member: CurrentMember, db: Db) -> list[CommitteeCoordinatingOut]:
    """The committees where the member is coordinator or secretary, with how much waits for them."""
    return [CommitteeCoordinatingOut(committee=CommitteeOut.build(c.committee), role=c.role, waiting=c.waiting)  # type: ignore[arg-type]
            for c in service.coordinating(db, member.id)]


@router.get("/{committee_id}/manage", response_model=CommitteeManageOut)
def manage(committee_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> CommitteeManageOut:
    with _answers():
        return CommitteeManageOut.from_view(service.manage_view(db, member.id, committee_id, client_ip(request)), _today(),
                                            member.id)


@router.post("/{committee_id}/manage/applications/{membership_id}/decision", response_model=CommitteeRosterEntryOut)
def decide_application(committee_id: uuid.UUID, membership_id: uuid.UUID, body: CommitteeApplicationDecisionIn,
                       member: CurrentMember, request: Request, db: Db) -> CommitteeRosterEntryOut:
    with _answers():
        return CommitteeRosterEntryOut.build(service.decide_application(db, member.id, committee_id, membership_id, body.approve,
                                                               body.role, body.reason, client_ip(request)))


@router.put("/{committee_id}/manage/members/{membership_id}/role", response_model=CommitteeRosterEntryOut)
def set_role(committee_id: uuid.UUID, membership_id: uuid.UUID, body: CommitteeRoleIn, member: CurrentMember, request: Request,
             db: Db) -> CommitteeRosterEntryOut:
    with _answers():
        return CommitteeRosterEntryOut.build(service.set_role(db, member.id, committee_id, membership_id, body.role,
                                                     client_ip(request)))


@router.post("/{committee_id}/manage/members/{membership_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(committee_id: uuid.UUID, membership_id: uuid.UUID, body: CommitteeReasonIn, member: CurrentMember,
                  request: Request, db: Db) -> Response:
    with _answers():
        service.remove_member(db, member.id, committee_id, membership_id, body.reason, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{committee_id}/manage/items", status_code=status.HTTP_201_CREATED, response_model=CommitteeItemOut)
def create_item(committee_id: uuid.UUID, body: CommitteeItemIn, member: CurrentMember, request: Request, db: Db) -> CommitteeItemOut:
    with _answers():
        return CommitteeItemOut.build(service.create_item(db, member.id, committee_id, body.model_dump(), client_ip(request)),
                             viewer=member.id)


@router.post("/{committee_id}/manage/items/{item_id}/decision", response_model=CommitteeItemOut)
def decide_item(committee_id: uuid.UUID, item_id: uuid.UUID, body: CommitteeDecisionIn, member: CurrentMember, request: Request,
                db: Db) -> CommitteeItemOut:
    """Minutes: a coordinator other than the author approves (403 own_minutes). Threads: a moderator."""
    with _answers():
        return CommitteeItemOut.build(service.decide_item(db, member.id, committee_id, item_id, body.approve, body.reason,
                                                 client_ip(request)), viewer=member.id)


@router.post("/{committee_id}/manage/items/{item_id}/hide", response_model=CommitteeItemOut)
def hide_item(committee_id: uuid.UUID, item_id: uuid.UUID, body: CommitteeReasonIn, member: CurrentMember, request: Request,
              db: Db) -> CommitteeItemOut:
    with _answers():
        return CommitteeItemOut.build(service.hide_item(db, member.id, committee_id, item_id, body.reason, client_ip(request)),
                             viewer=member.id)


@router.get("/{committee_id}/manage/items/{item_id}/signups", response_model=CommitteeSignupsOut)
def list_signups(committee_id: uuid.UUID, item_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> CommitteeSignupsOut:
    with _answers():
        return CommitteeSignupsOut(names=service.signups(db, member.id, committee_id, item_id, client_ip(request)))


@router.post("/{committee_id}/manage/posts/{post_id}/decision", response_model=CommitteePostOut)
def decide_post(committee_id: uuid.UUID, post_id: uuid.UUID, body: CommitteePostDecisionIn, member: CurrentMember,
                request: Request, db: Db) -> CommitteePostOut:
    with _answers():
        return CommitteePostOut.build(service.decide_post(db, member.id, committee_id, post_id, body.decision, body.reason,
                                                 client_ip(request)), member.id)


# --- Members (M31, M32) ----------------------------------------------------------------------------------


@router.get("", response_model=list[CommitteeCardOut])
def list_committees(member: CurrentMember, db: Db, wing_type: WingType | None = None) -> list[CommitteeCardOut]:
    """M31: approved committees for the member's area (and platform-wide ones), with their own state."""
    return [CommitteeCardOut.from_card(card) for card in service.member_committees(db, member.id, wing_type)]


@router.get("/{committee_id}", response_model=CommitteeSpaceOut)
def read_space(committee_id: uuid.UUID, member: CurrentMember, db: Db) -> CommitteeSpaceOut:
    """M32: the committee's space for its approved members; its description and the application for anyone else."""
    with _answers():
        return CommitteeSpaceOut.from_space(service.space(db, member.id, committee_id), _today())


@router.post("/{committee_id}/applications", status_code=status.HTTP_201_CREATED, response_model=CommitteeMembershipOut)
def apply(committee_id: uuid.UUID, body: CommitteeApplicationIn, member: CurrentMember, request: Request, db: Db) -> CommitteeMembershipOut:
    with _answers():
        return CommitteeMembershipOut.build(service.apply(db, member.id, committee_id, body.note, client_ip(request)))


@router.post("/{committee_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave(committee_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> Response:
    """Withdraws an application, or leaves the committee."""
    with _answers():
        service.leave(db, member.id, committee_id, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{committee_id}/threads", status_code=status.HTTP_201_CREATED, response_model=CommitteeItemOut)
def start_thread(committee_id: uuid.UUID, body: CommitteeThreadIn, member: CurrentMember, request: Request, db: Db) -> CommitteeItemOut:
    """FR-COM-008: a discussion thread for the whole committee, moderated; there are no direct messages."""
    with _answers():
        item = service.create_item(db, member.id, committee_id, {"item_type": "thread", "title": body.title,
                                                                 "body": body.body}, client_ip(request))
        return CommitteeItemOut.build(item, viewer=member.id)


@router.get("/{committee_id}/threads/{thread_id}", response_model=CommitteeThreadOut)
def read_thread(committee_id: uuid.UUID, thread_id: uuid.UUID, member: CurrentMember, db: Db) -> CommitteeThreadOut:
    with _answers():
        return CommitteeThreadOut.from_view(service.thread(db, member.id, committee_id, thread_id), member.id)


@router.post("/{committee_id}/threads/{thread_id}/posts", status_code=status.HTTP_201_CREATED, response_model=CommitteePostOut)
def reply(committee_id: uuid.UUID, thread_id: uuid.UUID, body: CommitteePostIn, member: CurrentMember, request: Request,
          db: Db) -> CommitteePostOut:
    with _answers():
        return CommitteePostOut.build(service.reply(db, member.id, committee_id, thread_id, body.body, client_ip(request)), member.id)


@router.post("/{committee_id}/tasks/{item_id}/done", response_model=CommitteeItemOut)
def complete_task(committee_id: uuid.UUID, item_id: uuid.UUID, member: CurrentMember, request: Request, db: Db) -> CommitteeItemOut:
    with _answers():
        return CommitteeItemOut.build(service.complete_task(db, member.id, committee_id, item_id, client_ip(request)),
                             viewer=member.id, today=_today())


@router.put("/{committee_id}/volunteer/{item_id}/signup", response_model=CommitteeItemOut)
def set_signup(committee_id: uuid.UUID, item_id: uuid.UUID, body: CommitteeSignupIn, member: CurrentMember, request: Request,
               db: Db) -> CommitteeItemOut:
    with _answers():
        item = service.set_signup(db, member.id, committee_id, item_id, body.signed_up, client_ip(request))
        return CommitteeItemOut.build(item, viewer=member.id, signed_up=body.signed_up)
