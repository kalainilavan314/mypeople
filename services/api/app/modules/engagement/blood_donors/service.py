"""Blood donor network (BRD M37, M38, D27; FR-BLD-001 to 008, BR-139 to 141, OS-15, OD-39).

A member opts in as a donor (M37) and may change or withdraw at any time; withdrawal deletes the donor
record and their answers at once. A hospital or the blood transfusion service raises a request from
an authorised partner account (D27); past 10 requests in an hour, further ones wait for Tier 5
approval. Up to 25 available donors of the same blood group in the same broad area are told privately
(M38), at most once a day each. The partner sees only how many were told, accepted and declined, plus
the contact of each donor who accepted and consented. Nobody can list or search donors (FR-BLD-002).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE, PLATFORM, Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.audit import service as audit
from app.modules.engagement.blood_donors import repository, rules
from app.modules.engagement.blood_donors.repository import Donor, Partner, Request, Requester, Response, SharedContact
from app.modules.messaging.notifications import service as notifications


class DonorRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class DonorNotFound(Exception):
    pass


def _today(now: datetime) -> date:
    return now.astimezone(LOCAL_ZONE).date()


def _area_path(db: Session, area: Area) -> list[str]:
    path = access_repository.area_path(db, area)
    if path is None:
        raise DonorRefused("unknown_area")
    return [a.key for a in path]


# --- Donors (M37, M38) ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class DonorHome:
    donor: Donor | None
    notices: list[tuple[Response, Request]]


def my_donor(db: Session, member_id: uuid.UUID) -> DonorHome:
    donor = repository.find_donor(db, member_id)
    return DonorHome(donor, repository.my_notices(db, member_id) if donor else [])


def enrol(db: Session, member_id: uuid.UUID, values: dict[str, Any], area: Area, consent: bool, ip: str,
          now: datetime) -> Donor:
    """FR-BLD-001: explicit opt-in each time the details are saved; no opt-in, no donor record."""
    problems = rules.check_donor(consent=consent, area_level=area.level, methods=values["contact_methods"],
                                 paused_until=values.get("paused_until"), today=_today(now))
    if problems:
        raise DonorRefused(problems)
    path = _area_path(db, area)
    existed = repository.find_donor(db, member_id) is not None
    repository.save_donor(db, member_id, {**values, "contact_methods": sorted(set(values["contact_methods"]))}, path[-1], path,
                          rules.CONSENT_VERSION)
    # Ids only: never the blood group, the area or the contact (health data, BR-090).
    audit.record(db, actor_id=member_id, action="donor.updated" if existed else "donor.enrolled", target_type="member",
                 target_id=str(member_id), ip=ip)
    db.commit()
    found = repository.find_donor(db, member_id)
    assert found is not None
    return found


def withdraw(db: Session, member_id: uuid.UUID, ip: str) -> None:
    """FR-BLD-007: the donor record is deleted at once, with every answer they gave, and the action logged."""
    waiting = [request.id for response, request in repository.my_notices(db, member_id) if response.state == "notified"]
    if not repository.delete_donor(db, member_id):
        raise DonorNotFound()
    for request_id in waiting:  # the notices asking for an answer no longer ask
        notifications.complete_action(db, "blood_request", request_id, member_id)
    audit.record(db, actor_id=member_id, action="donor.withdrawn", target_type="member", target_id=str(member_id), ip=ip)
    db.commit()


@dataclass(frozen=True)
class Notice:
    response: Response
    request: Request


def notice(db: Session, member_id: uuid.UUID, request_id: uuid.UUID) -> Notice:
    """M38: only a donor who was told about the request may open it."""
    response = repository.find_response(db, request_id, member_id)
    request = repository.find_request(db, request_id) if response else None
    if response is None or request is None:
        raise DonorNotFound()
    return Notice(response, request)


def answer(db: Session, member_id: uuid.UUID, request_id: uuid.UUID, accept: bool, consent: bool, ip: str,
           now: datetime) -> Notice:
    """M38, FR-BLD-005: accepting with consent passes the donor's contact to the partner; declining or not
    answering shares nothing."""
    request = repository.find_request(db, request_id, lock=True)
    response = repository.find_response(db, request_id, member_id, lock=True)
    donor = repository.find_donor(db, member_id)
    if request is None or response is None or donor is None:
        raise DonorNotFound()
    problem = rules.check_answer(request_state=request.state, needed_by=request.needed_by, response_state=response.state,
                                 accept=accept, consent=consent, now=now)
    if problem:
        raise DonorRefused(problem)
    repository.answer(db, response.id, accept, donor)
    repository.update_request(db, request.id, {"accepted": request.accepted + 1} if accept else {"declined": request.declined + 1})
    notifications.complete_action(db, "blood_request", request.id, member_id)
    if accept:
        for requester in repository.requester_members(db, request.partner_id):
            notifications.notify(db, requester, "blood_donor_accepted", request.id)
    audit.record(db, actor_id=member_id, action="donor.request.accepted" if accept else "donor.request.declined",
                 target_type="donor_request", target_id=str(request.id), ip=ip)
    db.commit()
    return notice(db, member_id, request_id)


# --- Partner requesters (D27, PRM-55) -----------------------------------------------------------------------


@dataclass(frozen=True)
class PartnerAccess:
    requester: Requester
    partner: Partner


def partner_access(db: Session, member_id: uuid.UUID) -> PartnerAccess | None:
    found = repository.active_requester(db, member_id)
    return PartnerAccess(*found) if found else None


def desk(db: Session, access: PartnerAccess) -> list[Request]:
    return repository.partner_requests(db, access.partner.id)


def _notify_matches(db: Session, request: Request, now: datetime) -> int:
    members = repository.match(db, request, today=_today(now), notice_before=now - rules.NOTICE_GAP,
                               limit=rules.NOTICES_PER_REQUEST)
    for member in members:
        notifications.notify(db, member, "blood_request_match", request.id)
    repository.update_request(db, request.id, {"notified": request.notified + len(members)})
    return len(members)


def raise_request(db: Session, access: PartnerAccess, values: dict[str, Any], area: Area, ip: str, now: datetime) -> Request:
    """FR-BLD-003, 004, 008: from an authorised partner only; over the hourly limit it waits for Tier 5."""
    problems = rules.check_request(area_level=area.level, needed_by=values["needed_by"], now=now)
    if problems:
        raise DonorRefused(problems)
    path = _area_path(db, area)
    # Counting and inserting under the partner's lock, so ten quick requests cannot all slip under the limit.
    if repository.find_partner(db, access.partner.id, lock=True) is None:
        raise DonorNotFound()
    over = rules.needs_approval(repository.count_since(db, access.partner.id, now - timedelta(hours=1)))
    request_id = repository.insert_request(db, {
        **values, "partner_id": access.partner.id, "raised_by": access.requester.member_id, "area_key": path[-1],
        "area_path": path, "state": "awaiting_approval" if over else "open", "over_limit": over,
    })
    created = repository.find_request(db, request_id)
    assert created is not None
    notified = 0
    if over:
        for holder in repository.holders(db, rules.OVERSIGHT):
            notifications.notify(db, holder, "blood_request_over_limit", request_id)
    else:
        notified = _notify_matches(db, created, now)
    audit.record(db, actor_id=access.requester.member_id, action="donor.request.raised", target_type="donor_request",
                 target_id=str(request_id), details={"partner": str(access.partner.id), "overLimit": over, "notified": notified},
                 ip=ip)
    db.commit()
    found = repository.find_request(db, request_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class RequestView:
    request: Request
    contacts: list[SharedContact]


def partner_request(db: Session, access: PartnerAccess, request_id: uuid.UUID) -> RequestView:
    request = repository.find_request(db, request_id)
    if request is None or request.partner_id != access.partner.id:
        raise DonorNotFound()
    return RequestView(request, repository.shared_contacts(db, request_id))


def close_request(db: Session, access: PartnerAccess, request_id: uuid.UUID, outcome: str, ip: str, now: datetime) -> RequestView:
    request = repository.find_request(db, request_id, lock=True)
    if request is None or request.partner_id != access.partner.id:
        raise DonorNotFound()
    if request.state not in ("open", "awaiting_approval"):
        raise DonorRefused(f"not_allowed_from:{request.state}")
    repository.update_request(db, request_id, {"state": "closed", "outcome": outcome, "closed_at": now})
    notifications.complete_action(db, "blood_request", request_id)
    notifications.complete_action(db, "blood_request_staff", request_id)
    audit.record(db, actor_id=access.requester.member_id, action="donor.request.closed", target_type="donor_request",
                 target_id=str(request_id), details={"outcome": outcome}, ip=ip)
    db.commit()
    return partner_request(db, access, request_id)


# --- Tier 5 oversight (D27) ----------------------------------------------------------------------------------


def _require_oversight(staff: Staff) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.OVERSIGHT, (PLATFORM,)):
        raise AccessRefused("forbidden")


@dataclass(frozen=True)
class Oversight:
    partners: list[Partner]
    requesters: list[Requester]
    awaiting: list[Request]
    recent: list[Request]


def oversight(db: Session, staff: Staff) -> Oversight:
    """Read-only, with counts only: never a donor's identity (FR-BLD-002)."""
    _require_oversight(staff)
    return Oversight(repository.partners(db), repository.requesters(db), repository.all_requests(db, awaiting_only=True),
                     repository.all_requests(db, awaiting_only=False, limit=100))


def add_partner(db: Session, staff: Staff, *, name: str, kind: str, district: Area, agreement_ref: str, ip: str) -> Partner:
    """DEP-18, OD-39: only an organisation with a signed agreement on file."""
    _require_oversight(staff)
    if district.level != "district":
        raise DonorRefused("district_required")
    path = _area_path(db, district)
    partner_id = repository.insert_partner(db, name=name.strip(), kind=kind, district_key=path[-1],
                                           agreement_ref=agreement_ref.strip(), by=staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="donor.partner.added", target_type="donor_partner",
                 target_id=str(partner_id), ip=ip)
    db.commit()
    found = repository.find_partner(db, partner_id)
    assert found is not None
    return found


def set_partner_active(db: Session, staff: Staff, partner_id: uuid.UUID, active: bool, ip: str) -> Partner:
    _require_oversight(staff)
    if repository.find_partner(db, partner_id) is None:
        raise DonorNotFound()
    repository.set_partner_active(db, partner_id, active)
    audit.record(db, actor_id=staff.member_id, action="donor.partner.activated" if active else "donor.partner.suspended",
                 target_type="donor_partner", target_id=str(partner_id), ip=ip)
    db.commit()
    found = repository.find_partner(db, partner_id)
    assert found is not None
    return found


def authorise_requester(db: Session, staff: Staff, partner_id: uuid.UUID, member_code: str, ip: str) -> Requester:
    """PRM-55: a named, identity-verified account of the partner may raise requests [ASSUMPTION] OD-39."""
    _require_oversight(staff)
    partner = repository.find_partner(db, partner_id)
    if partner is None:
        raise DonorNotFound()
    if not partner.active:
        raise DonorRefused("partner_not_active")
    account = repository.member_by_code(db, member_code)
    if account is None:
        raise DonorRefused("account_not_found")
    member_id, verified = account
    if not verified:
        raise DonorRefused("identity_not_verified")
    if repository.active_requester(db, member_id) is not None:
        raise DonorRefused("already_a_requester")
    requester_id = repository.insert_requester(db, partner_id, member_id, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="donor.requester.authorised", target_type="donor_partner",
                 target_id=str(partner_id), details={"member": str(member_id)}, ip=ip)
    db.commit()
    found = repository.find_requester(db, requester_id)
    assert found is not None
    return found


def revoke_requester(db: Session, staff: Staff, requester_id: uuid.UUID, ip: str) -> Requester:
    _require_oversight(staff)
    found = repository.find_requester(db, requester_id)
    if found is None:
        raise DonorNotFound()
    if found.revoked_at is not None:
        raise DonorRefused("already_revoked")
    repository.revoke_requester(db, requester_id, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="donor.requester.revoked", target_type="donor_partner",
                 target_id=str(found.partner_id), details={"member": str(found.member_id)}, ip=ip)
    db.commit()
    result = repository.find_requester(db, requester_id)
    assert result is not None
    return result


def decide(db: Session, staff: Staff, request_id: uuid.UUID, approve: bool, reason: str | None, ip: str,
           now: datetime) -> Request:
    """FR-BLD-008: Tier 5 approves or refuses a request over the hourly limit; never their own."""
    _require_oversight(staff)
    request = repository.find_request(db, request_id, lock=True)
    if request is None:
        raise DonorNotFound()
    if request.state != "awaiting_approval":
        raise DonorRefused(f"not_allowed_from:{request.state}")
    if problem := rules.check_decider(request.raised_by, staff.member_id):
        raise DonorRefused(problem)
    if approve and request.needed_by <= now:
        raise DonorRefused("needed_by_in_past")
    if not approve and not (reason and len(reason.strip()) >= 5):
        raise DonorRefused("reason_required")
    repository.update_request(db, request_id, {"state": "open" if approve else "refused", "decided_by": staff.member_id,
                                               "decided_at": now, "decision_reason": reason.strip() if reason else None})
    notified = 0
    if approve:
        opened = repository.find_request(db, request_id)
        assert opened is not None
        notified = _notify_matches(db, opened, now)
    notifications.complete_action(db, "blood_request_staff", request_id)
    audit.record(db, actor_id=staff.member_id, action="donor.request.approved" if approve else "donor.request.refused",
                 target_type="donor_request", target_id=str(request_id), details={"notified": notified}, ip=ip)
    db.commit()
    found = repository.find_request(db, request_id)
    assert found is not None
    return found


def purge(db: Session, now: datetime | None = None) -> int:
    """OD-39 [ASSUMPTION]: requests and their answers are deleted 12 months after they were raised."""
    removed = repository.purge_before(db, (now or datetime.now(UTC)) - rules.KEEP_REQUESTS)
    db.commit()
    return removed
