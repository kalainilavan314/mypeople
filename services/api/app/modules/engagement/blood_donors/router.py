"""Blood donor network (BRD M37, M38, D27, FR-BLD-001 to 008): /v1/donors.

There is deliberately no endpoint that lists or searches donors (FR-BLD-002).
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access import rules as access_rules
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import PLATFORM, Area
from app.modules.access.service import AccessRefused, Staff, load_staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.engagement.blood_donors import rules, service
from app.modules.engagement.blood_donors.dependencies import PartnerRequester
from app.modules.engagement.blood_donors.schemas import (
    BloodAnswerIn,
    BloodCloseIn,
    BloodContactOut,
    BloodDecisionIn,
    BloodDeskAccessOut,
    BloodDeskOut,
    BloodDonorHomeOut,
    BloodDonorIn,
    BloodDonorOut,
    BloodNoticeOut,
    BloodOversightOut,
    BloodPartnerActiveIn,
    BloodPartnerIn,
    BloodPartnerOut,
    BloodRequestDetailOut,
    BloodRequesterIn,
    BloodRequesterOut,
    BloodRequestIn,
    BloodRequestOut,
)
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
Oversight = Annotated[Staff, Depends(require_permission(rules.OVERSIGHT))]

router = APIRouter(prefix="/v1/donors", tags=["donors"], dependencies=[Depends(require_feature("blood_donors"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.DonorNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.DonorRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "donor_refused", "problems": error.problems}
        ) from None


def _now() -> datetime:
    return datetime.now(UTC)


def _detail(view: service.RequestView) -> BloodRequestDetailOut:
    return BloodRequestDetailOut(**BloodRequestOut.build(view.request).model_dump(),
                                 contacts=[BloodContactOut.build(c) for c in view.contacts])


# --- Donors (M37, M38) ---------------------------------------------------------------------------------------


@router.get("/me", response_model=BloodDonorHomeOut)
def my_donor(member: CurrentMember, db: Db) -> BloodDonorHomeOut:
    """M37: the member's own donor record (null until they opt in) and the requests they were told about."""
    home = service.my_donor(db, member.id)
    now = _now()
    return BloodDonorHomeOut(donor=BloodDonorOut.build(home.donor) if home.donor else None,
                             notices=[BloodNoticeOut.build(r, q, now) for r, q in home.notices],
                             blood_groups=list(rules.BLOOD_GROUPS))


@router.put("/me", response_model=BloodDonorOut)
def enrol(body: BloodDonorIn, member: CurrentMember, request: Request, db: Db) -> BloodDonorOut:
    """FR-BLD-001: opt in, or change the details; consent each time (422 consent_required)."""
    values = body.model_dump(exclude={"area", "consent"})
    with _answers():
        return BloodDonorOut.build(service.enrol(db, member.id, values, Area(body.area.level, body.area.code), body.consent,
                                                 client_ip(request), _now()))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def withdraw(member: CurrentMember, request: Request, db: Db) -> Response:
    """FR-BLD-007: withdraw; the donor record and every answer are deleted at once."""
    with _answers():
        service.withdraw(db, member.id, client_ip(request))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/requests/{request_id}", response_model=BloodNoticeOut)
def read_notice(request_id: uuid.UUID, member: CurrentMember, db: Db) -> BloodNoticeOut:
    """M38: only for a donor who was told about it."""
    with _answers():
        found = service.notice(db, member.id, request_id)
    return BloodNoticeOut.build(found.response, found.request)


@router.post("/me/requests/{request_id}/answer", response_model=BloodNoticeOut)
def answer(request_id: uuid.UUID, body: BloodAnswerIn, member: CurrentMember, request: Request, db: Db) -> BloodNoticeOut:
    """M38, FR-BLD-005: accept (with consent to pass on the contact) or decline, once."""
    with _answers():
        found = service.answer(db, member.id, request_id, body.accept, body.consent, client_ip(request), _now())
    return BloodNoticeOut.build(found.response, found.request)


# --- The request desk (D27) ----------------------------------------------------------------------------------


@router.get("/desk/access", response_model=BloodDeskAccessOut)
def desk_access(member: CurrentMember, db: Db) -> BloodDeskAccessOut:
    """Whether this account may use the partner desk or the Tier 5 oversight; changes nothing."""
    access = service.partner_access(db, member.id)
    staff = load_staff(db, member.id)
    return BloodDeskAccessOut(partner=BloodPartnerOut.build(access.partner) if access else None,
                              oversight=access_rules.holds(staff.rule_assignments(), rules.OVERSIGHT, (PLATFORM,)))


@router.get("/desk", response_model=BloodDeskOut)
def desk(access: PartnerRequester, db: Db) -> BloodDeskOut:
    now = _now()
    return BloodDeskOut(partner=BloodPartnerOut.build(access.partner),
                        requests=[BloodRequestOut.build(q, now) for q in service.desk(db, access)])


@router.post("/desk/requests", status_code=status.HTTP_201_CREATED, response_model=BloodRequestDetailOut)
def raise_request(body: BloodRequestIn, access: PartnerRequester, request: Request, db: Db) -> BloodRequestDetailOut:
    """FR-BLD-003, 004, 008: matching donors are told privately; past 10 requests in an hour it waits for
    Tier 5 approval (state awaiting_approval)."""
    values = body.model_dump(exclude={"area"})
    with _answers():
        raised = service.raise_request(db, access, values, Area(body.area.level, body.area.code), client_ip(request), _now())
        return _detail(service.partner_request(db, access, raised.id))


@router.get("/desk/requests/{request_id}", response_model=BloodRequestDetailOut)
def read_request(request_id: uuid.UUID, access: PartnerRequester, db: Db) -> BloodRequestDetailOut:
    """Counts, and the contact of each donor who accepted and consented; never anyone else's identity."""
    with _answers():
        return _detail(service.partner_request(db, access, request_id))


@router.post("/desk/requests/{request_id}/close", response_model=BloodRequestDetailOut)
def close_request(request_id: uuid.UUID, body: BloodCloseIn, access: PartnerRequester, request: Request,
                  db: Db) -> BloodRequestDetailOut:
    with _answers():
        return _detail(service.close_request(db, access, request_id, body.outcome, client_ip(request), _now()))


# --- Tier 5 oversight (D27) ----------------------------------------------------------------------------------


@router.get("/oversight", response_model=BloodOversightOut)
def oversight(staff: Oversight, db: Db) -> BloodOversightOut:
    """Partners, their requesters, requests waiting for approval and recent requests, with counts only."""
    now = _now()
    with _answers():
        found = service.oversight(db, staff)
    return BloodOversightOut(partners=[BloodPartnerOut.build(p) for p in found.partners],
                             requesters=[BloodRequesterOut.build(r) for r in found.requesters],
                             awaiting=[BloodRequestOut.build(q, now) for q in found.awaiting],
                             recent=[BloodRequestOut.build(q, now) for q in found.recent])


@router.post("/oversight/partners", status_code=status.HTTP_201_CREATED, response_model=BloodPartnerOut)
def add_partner(body: BloodPartnerIn, staff: Oversight, request: Request, db: Db) -> BloodPartnerOut:
    with _answers():
        return BloodPartnerOut.build(service.add_partner(db, staff, name=body.name, kind=body.kind,
                                                         district=Area("district", body.district_code),
                                                         agreement_ref=body.agreement_ref, ip=client_ip(request)))


@router.post("/oversight/partners/{partner_id}/active", response_model=BloodPartnerOut)
def set_partner_active(partner_id: uuid.UUID, body: BloodPartnerActiveIn, staff: Oversight, request: Request,
                       db: Db) -> BloodPartnerOut:
    with _answers():
        return BloodPartnerOut.build(service.set_partner_active(db, staff, partner_id, body.active, client_ip(request)))


@router.post("/oversight/partners/{partner_id}/requesters", status_code=status.HTTP_201_CREATED,
             response_model=BloodRequesterOut)
def authorise_requester(partner_id: uuid.UUID, body: BloodRequesterIn, staff: Oversight, request: Request,
                        db: Db) -> BloodRequesterOut:
    """PRM-55: a named, identity-verified account of the partner, by its member code."""
    with _answers():
        return BloodRequesterOut.build(service.authorise_requester(db, staff, partner_id, body.member_code, client_ip(request)))


@router.post("/oversight/requesters/{requester_id}/revoke", response_model=BloodRequesterOut)
def revoke_requester(requester_id: uuid.UUID, staff: Oversight, request: Request, db: Db) -> BloodRequesterOut:
    with _answers():
        return BloodRequesterOut.build(service.revoke_requester(db, staff, requester_id, client_ip(request)))


@router.post("/oversight/requests/{request_id}/decision", response_model=BloodRequestOut)
def decide(request_id: uuid.UUID, body: BloodDecisionIn, staff: Oversight, request: Request, db: Db) -> BloodRequestOut:
    """FR-BLD-008: approve or refuse a request over the hourly limit; never your own (own_request)."""
    with _answers():
        return BloodRequestOut.build(service.decide(db, staff, request_id, body.approve, body.reason, client_ip(request),
                                                    _now()))
