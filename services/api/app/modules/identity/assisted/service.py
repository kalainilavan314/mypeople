"""Assisted identity verification (BRD M05, S04, FR-IDV-014, FR-STF-004, BR-010, BR-021, BR-144, OD-04).

The member asks for help (M05) with a reason, a route (supervised capture on their own phone, a
district-office visit, or a call back first) and an optional preferred day; the request holds no ID
data. Staff holding members.assisted_verification or members.verify over the member's area arrange a
time, start a session and witness the capture (S04). The member takes the photos on their own phone
or an office device and they go, as always, only through the evidence vault
(identity/documents): this module never reads, copies or returns an image, and the witness's phone
holds none (BR-021). When every checklist item is ticked and the server holds every image the
route needs, completing the session submits the images to the normal identity review on the
member's behalf. A reviewer holding members.verify then decides, and never the person who
witnessed it (identity/reviews).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access import service as access
from app.modules.access.rules import AreaPath, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE
from app.modules.identity.assisted import repository, rules
from app.modules.identity.assisted.repository import AssistedSession, MemberCard, Request
from app.modules.identity.assisted.rules import ASSIST, STAFF_PERMISSIONS, VERIFY
from app.modules.identity.documents import repository as documents
from app.modules.identity.recovery import repository as contacts
from app.modules.identity.registration import repository as registration
from app.modules.identity.reviews import repository as reviews_repository
from app.modules.identity.reviews import service as reviews
from app.modules.identity.reviews.rules import REQUIRED_DOCUMENTS
from app.modules.membership import repository as membership_repository
from app.modules.membership.rules import NOTICE_VERSIONS
from app.modules.messaging.notifications import service as notifications


class AssistedRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class AssistedNotFound(Exception):
    pass


class AssistedConflict(Exception):
    """not_your_session: someone else is witnessing this session."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _path(request: Request) -> AreaPath:
    return tuple(area_from_key(key) for key in request.area_path)


def _audit(db: Session, actor_id: uuid.UUID, action: str, request: Request, ip: str, **details: object) -> None:
    """Ids and codes only: never an image, an ID number, the phone number or the witness's notes."""
    audit.record(
        db, actor_id=actor_id, action=action, target_type="assisted_request", target_id=str(request.id),
        area_path=_path(request), details={"memberId": str(request.member_id), "requestRef": request.request_ref, **details},
        ip=ip,
    )


def _reload(db: Session, request_id: uuid.UUID) -> Request:
    found = repository.find_request(db, request_id)
    assert found is not None
    return found


def _staff_notified(db: Session, request: Request) -> list[uuid.UUID]:
    """The trained coordinators over the member's area, or the reviewers when none is appointed yet."""
    return repository.holders(db, ASSIST, request.area_path) or repository.holders(db, VERIFY, request.area_path)


# --- The member (M05) ------------------------------------------------------------------------------------


@dataclass(frozen=True)
class MyAssisted:
    request: Request | None
    identity_verified: bool
    review_state: str | None
    contact_on_record: bool


def my_assisted(db: Session, member_id: uuid.UUID) -> MyAssisted:
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    review = reviews_repository.latest_review(db, member_id)
    return MyAssisted(
        request=repository.latest_request(db, member_id),
        identity_verified=status.identity_verified,
        review_state=review.state if review else None,
        contact_on_record=contacts.find_contact(db, member_id) is not None,
    )


def request_help(db: Session, member_id: uuid.UUID, *, reason: str, route: str, preferred_date: object,
                 preferred_time: str | None, ip: str, now: datetime | None = None) -> Request:
    """M05, FR-IDV-014. A second tap returns the request already open."""
    today = (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()
    repository.lock_member(db, member_id)
    latest = repository.latest_request(db, member_id)
    if latest is not None and latest.state in rules.OPEN_STATES:
        return latest
    mine = my_assisted(db, member_id)
    problems = rules.check_request(
        identity_verified=mine.identity_verified, review_state=mine.review_state,
        contact_on_record=mine.contact_on_record, preferred_date=preferred_date,  # type: ignore[arg-type]
        today=today,
    )
    if problems:
        raise AssistedRefused(problems)
    area_path = [area.key for area in access_repository.member_area_path(db, member_id)]
    request_id = repository.insert_request(
        db, member_id=member_id, reason=reason, route=route, preferred_date=preferred_date,  # type: ignore[arg-type]
        preferred_time=preferred_time, area_path=area_path,
    )
    request = _reload(db, request_id)
    for holder in _staff_notified(db, request):
        if holder != member_id:
            notifications.notify(db, holder, "assisted_request_received", request.id)
    _audit(db, member_id, "identity.assisted.requested", request, ip, reason=reason, route=route)
    db.commit()
    return request


def cancel(db: Session, member_id: uuid.UUID, ip: str) -> Request:
    repository.lock_member(db, member_id)
    request = repository.latest_request(db, member_id)
    if request is None:
        raise AssistedNotFound()
    problems = rules.check_cancel(request.state)
    if problems:
        raise AssistedRefused(problems)
    repository.update_request(db, request.id, {"state": "cancelled"})
    notifications.complete_action(db, "assisted_session", request.id)
    _audit(db, member_id, "identity.assisted.cancelled", request, ip)
    db.commit()
    return _reload(db, request.id)


# --- Staff (S04) ---------------------------------------------------------------------------------------------


def _holds(staff: Staff, path: AreaPath) -> bool:
    return any(access_rules.holds(staff.rule_assignments(), permission, path) for permission in STAFF_PERMISSIONS)


def _load(db: Session, staff: Staff, request_id: uuid.UUID, ip: str, *, lock: bool = False) -> Request:
    """Never one's own request (BR-085), and either permission over the member's area. Refusals are audited."""
    request = repository.find_request(db, request_id, lock=lock)
    if request is None:
        raise AssistedNotFound()
    target = ("assisted_request", str(request.id))
    if request.member_id == staff.member_id:
        access.refuse(db, staff, ASSIST, "own_record", ip, target=target, area_path=_path(request))
    if not _holds(staff, _path(request)):
        access.refuse(db, staff, ASSIST, "outside_your_area", ip, target=target, area_path=_path(request))
    return request


def _visible_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in STAFF_PERMISSIONS:
        areas = access.visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


def queue(db: Session, staff: Staff, states: list[str], limit: int) -> list[Request]:
    return repository.queue(db, areas=_visible_areas(staff), states=states, limit=limit)


@dataclass(frozen=True)
class RequestFile:
    """Everything S04 shows: who to meet and how to reach them, which images the server already holds
    (kinds and times only, never the images) and the sessions so far."""

    request: Request
    member: MemberCard
    phone: str | None
    route: str  # nic or passport: which images the review needs
    required_documents: tuple[str, ...]
    received: dict[str, datetime]
    consent_given: bool
    sessions: list[AssistedSession]


def request_file(db: Session, staff: Staff, request_id: uuid.UUID, ip: str) -> RequestFile:
    request = _load(db, staff, request_id, ip)
    member = repository.member_card(db, request.member_id)
    if member is None:
        raise AssistedNotFound()
    route = registration.account_route(db, request.member_id)
    contact = contacts.find_contact(db, request.member_id)
    open_request = request.state in rules.OPEN_STATES
    if open_request:
        # The phone number is shown only while the request is open, and every opening is recorded.
        _audit(db, staff.member_id, "identity.assisted.opened", request, ip)
        db.commit()
    return RequestFile(
        request=request,
        member=member,
        phone=contact.phone if contact and open_request else None,
        route=route,
        required_documents=REQUIRED_DOCUMENTS[route],  # type: ignore[index]
        received={d.kind: d.server_ack_at for d in documents.current_documents(db, request.member_id)},
        consent_given=membership_repository.has_consent(
            db, request.member_id, "identity_review", NOTICE_VERSIONS["identity_review"]
        ),
        sessions=repository.sessions_for_request(db, request.id),
    )


def schedule(db: Session, staff: Staff, request_id: uuid.UUID, scheduled_for: datetime, meeting_place: str, ip: str,
             now: datetime | None = None) -> Request:
    request = _load(db, staff, request_id, ip, lock=True)
    problems = rules.check_schedule(request.state, scheduled_for, now or datetime.now(UTC))
    if problems:
        raise AssistedRefused(problems)
    repository.update_request(db, request.id, {"state": "scheduled", "scheduled_for": scheduled_for,
                                                "meeting_place": meeting_place.strip(), "scheduled_by": staff.member_id})
    notifications.complete_action(db, "assisted_session", request.id)
    notifications.notify(db, request.member_id, "assisted_scheduled", request.id)
    _audit(db, staff.member_id, "identity.assisted.scheduled", request, ip)
    db.commit()
    return _reload(db, request.id)


def start_session(db: Session, staff: Staff, request_id: uuid.UUID, device: str, ip: str) -> AssistedSession:
    request = _load(db, staff, request_id, ip, lock=True)
    problems = rules.check_start(request.state)
    if problems:
        raise AssistedRefused(problems)
    tier = max(
        (t for p in STAFF_PERMISSIONS if (t := access_rules.highest_tier(staff.rule_assignments(), p, _path(request)))),
        key=lambda t: access_rules.TIER_RANK[t],
    )
    session_id = repository.insert_session(db, request_id=request.id, witness_id=staff.member_id, witness_tier=tier,
                                           device=device)
    repository.update_request(db, request.id, {"state": "in_session"})
    notifications.complete_action(db, "assisted_session", request.id)
    _audit(db, staff.member_id, "identity.assisted.session_started", request, ip, sessionId=str(session_id), device=device)
    db.commit()
    found = repository.find_session(db, session_id)
    assert found is not None
    return found


def _open_session(db: Session, staff: Staff, request: Request, session_id: uuid.UUID) -> AssistedSession:
    session = repository.find_session(db, session_id, lock=True)
    if session is None or session.request_id != request.id:
        raise AssistedNotFound()
    if session.ended_at is not None:
        raise AssistedRefused("session_ended")
    if session.witness_id != staff.member_id:
        raise AssistedConflict("not_your_session")
    return session


def complete_session(db: Session, staff: Staff, request_id: uuid.UUID, session_id: uuid.UUID, checklist: list[str],
                     notes: str | None, ip: str) -> RequestFile:
    """FR-STF-004: the whole checklist and every image of the route, then the images go to the normal review."""
    request = _load(db, staff, request_id, ip, lock=True)
    session = _open_session(db, staff, request, session_id)
    route = registration.account_route(db, request.member_id)
    received = {d.kind for d in documents.current_documents(db, request.member_id)}
    consent = membership_repository.has_consent(db, request.member_id, "identity_review", NOTICE_VERSIONS["identity_review"])
    problems = rules.check_complete(checklist, REQUIRED_DOCUMENTS[route], received, consent)  # type: ignore[index]
    if problems:
        raise AssistedRefused(problems)
    try:
        review = reviews.submit(db, request.member_id, route, ip, actor_id=staff.member_id, commit=False)  # type: ignore[arg-type]
    except reviews.SubmissionRefused as error:
        raise AssistedRefused(error.problems) from None
    repository.end_session(db, session.id, outcome="completed", checklist=sorted(checklist),
                           notes=notes.strip() if notes and notes.strip() else None, abandon_reason=None, review_id=review.id)
    repository.update_request(db, request.id, {"state": "completed"})
    notifications.notify(db, request.member_id, "assisted_submitted", review.id)
    _audit(db, staff.member_id, "identity.assisted.completed", request, ip, sessionId=str(session.id),
           reviewId=str(review.id), reviewRef=review.review_ref, device=session.device)
    db.commit()
    return request_file(db, staff, request.id, ip)


def abandon_session(db: Session, staff: Staff, request_id: uuid.UUID, session_id: uuid.UUID, reason: str,
                    notes: str | None, ip: str) -> Request:
    request = _load(db, staff, request_id, ip, lock=True)
    session = _open_session(db, staff, request, session_id)
    state, route, closed_reason = rules.after_abandon(reason)  # type: ignore[arg-type]
    repository.end_session(db, session.id, outcome="abandoned", checklist=[],
                           notes=notes.strip() if notes and notes.strip() else None, abandon_reason=reason, review_id=None)
    values: dict[str, object] = {"state": state, "scheduled_for": None, "meeting_place": None}
    if route:
        values["route"] = route
    if closed_reason:
        values["closed_reason"] = closed_reason
    repository.update_request(db, request.id, values)
    if state == "requested":
        notifications.notify(db, request.member_id, "assisted_rearrange", request.id)
    _audit(db, staff.member_id, "identity.assisted.session_abandoned", request, ip, sessionId=str(session.id),
           reason=reason)
    db.commit()
    return _reload(db, request.id)


def close(db: Session, staff: Staff, request_id: uuid.UUID, reason: str, ip: str) -> Request:
    request = _load(db, staff, request_id, ip, lock=True)
    problems = rules.check_close(request.state)
    if problems:
        raise AssistedRefused(problems)
    repository.update_request(db, request.id, {"state": "closed", "closed_reason": reason})
    notifications.complete_action(db, "assisted_session", request.id)
    _audit(db, staff.member_id, "identity.assisted.closed", request, ip, reason=reason)
    db.commit()
    return _reload(db, request.id)


def sessions_for_review(db: Session, staff: Staff, review_id: uuid.UUID, ip: str) -> list[tuple[AssistedSession, str]]:
    """W02: the reviewer sees how the images were captured: the witness's tier, the device, the checklist
    and the notes, never who the witness was."""
    review = reviews_repository.find_review(db, review_id)
    if review is None:
        raise AssistedNotFound()
    access.check_record_scope(
        db, staff, VERIFY, member_id=review.member_id, area_path=tuple(area_from_key(k) for k in review.area_path),
        target=("identity_review", str(review.id)), ip=ip,
    )
    return repository.sessions_for_review(db, review_id)

