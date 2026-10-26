"""Data-subject requests: a copy of one's personal data, or closing the account (BRD P06;
FR-PROF-018, 019, BR-079).

Both give a receipt (DSR- reference) with the statutory due date and go to
the DPO's register, soonest due first. Closing is confirmed with the
member's password and a one-time code sent to their confirmed number; the
receipt explains what is kept and for how long, and nothing is deleted at
once (BR-079). When the DPO completes a closure the account stops working in
both APIs; anonymising it 30 days later is a scheduled task not built yet.

Not built yet: assembling the copy of the data (the DPO prepares it from the
records; an export tool is a later batch) and correction and objection
requests.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.security import one_time_code_hash, verify_password
from app.integrations.sms import SmsSender
from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.auth import repository as attempts
from app.modules.auth import throttle
from app.modules.identity.recovery import repository as contacts
from app.modules.identity.recovery import rules as code_rules
from app.modules.identity.recovery import service as recovery
from app.modules.privacy import repository, rules
from app.modules.privacy.repository import StoredRequest


class RequestNotFound(Exception):
    pass


class RequestRefused(Exception):
    """no_recovery_number, wrong_password, invalid_code, too_many_attempts or already_closed."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _record(db: Session, actor_id: uuid.UUID, action: str, request: StoredRequest, ip: str, **details: object) -> None:
    audit.record(
        db, actor_id=actor_id, action=action, target_type="privacy_request", target_id=str(request.id),
        area_path=access_repository.member_area_path(db, request.member_id),
        details={"requestRef": request.request_ref, "kind": request.kind, "memberId": str(request.member_id), **details},
        ip=ip,
    )


def _create(db: Session, member_id: uuid.UUID, kind: rules.Kind, note: str, ip: str) -> StoredRequest:
    existing = repository.open_of(db, member_id, kind)
    if existing is not None:
        return existing
    created = repository.insert(db, member_id=member_id, kind=kind, note=note, due_at=rules.due_date(datetime.now(UTC)))
    # The note stays on the request; the audit entry holds ids only.
    _record(db, member_id, "privacy.request.created", created, ip)
    db.commit()
    return created


def request_copy(db: Session, member_id: uuid.UUID, note: str, ip: str) -> StoredRequest:
    """FR-PROF-019: routed to the DPO with its due date; asking again returns the open one."""
    return _create(db, member_id, "copy", note, ip)


def send_closure_code(db: Session, sms: SmsSender, member_id: uuid.UUID, ip: str, jwt_secret: str) -> str:
    """The one-time code that confirms a closure request, to the member's confirmed number."""
    contact = contacts.find_contact(db, member_id)
    if contact is None:
        raise RequestRefused("no_recovery_number")
    return recovery.send_code(
        db, sms, phone=contact.phone, purpose=code_rules.ACCOUNT_CLOSURE, ip=ip, jwt_secret=jwt_secret
    )


def request_closure(
    db: Session, member_id: uuid.UUID, *, password: str, code: str, note: str, ip: str, jwt_secret: str
) -> StoredRequest:
    """FR-PROF-018: only with the password and a one-time code, both checked here. Wrong passwords
    count like sign-in failures, so this cannot be used to guess one."""
    identifier = f"account-closure:{member_id}"
    if not throttle.sign_in_gate(attempts.count_recent_failures(db, identifier, ip, throttle.WINDOW)).allowed:
        raise RequestRefused("too_many_attempts")
    stored_hash = contacts.password_hash(db, member_id)
    if stored_hash is None or not verify_password(password, stored_hash):
        attempts.record_attempt(db, identifier, ip, succeeded=False)
        db.commit()
        raise RequestRefused("wrong_password")
    contact = contacts.find_contact(db, member_id)
    if contact is None:
        raise RequestRefused("no_recovery_number")
    result = contacts.consume_code(
        db, phone=contact.phone, purpose=code_rules.ACCOUNT_CLOSURE, code_hash=one_time_code_hash(code, jwt_secret)
    )
    if result != "ok":
        db.commit()  # keep the attempt count on the code
        raise RequestRefused("too_many_attempts" if result == "too_many_attempts" else "invalid_code")
    attempts.clear_failures(db, identifier, ip)
    return _create(db, member_id, "closure", note, ip)


def my_requests(db: Session, member_id: uuid.UUID) -> list[StoredRequest]:
    return repository.of_member(db, member_id)


# --- The DPO register -----------------------------------------------------------------------------------


def register(db: Session, states: list[str], limit: int) -> list[StoredRequest]:
    return repository.queue(db, states=states, limit=limit)


def close(
    db: Session, staff: Staff, request_id: uuid.UUID, outcome: rules.Outcome, note: str, ip: str
) -> tuple[StoredRequest, str | None]:
    """Complete or refuse, with a note the member sees. Completing a closure closes the account.
    Returns the request and the member's confirmed number, to tell them."""
    request = repository.find(db, request_id, for_update=True)
    if request is None:
        raise RequestNotFound()
    if request.member_id == staff.member_id:
        access.refuse(db, staff, rules.HANDLE, "own_record", ip, target=("privacy_request", str(request.id)),
                      area_path=access_repository.member_area_path(db, request.member_id))
    if request.state != "open":
        raise RequestRefused("already_closed")
    contact = contacts.find_contact(db, request.member_id)
    if request.kind == "closure" and outcome == "completed":
        repository.close_account(db, request.member_id)
    repository.close(db, request.id, state=outcome, outcome_note=note, handled_by=staff.member_id)
    _record(db, staff.member_id, f"privacy.request.{outcome}", request, ip)
    db.commit()
    closed = repository.find(db, request.id)
    assert closed is not None
    return closed, contact.phone if contact else None


def outcome_message(request: StoredRequest) -> str:
    tamil = "நிறைவேற்றப்பட்டது" if request.state == "completed" else "நிராகரிக்கப்பட்டது; காரணம் அனுப்பப்பட்டுள்ளது"
    english = "has been completed" if request.state == "completed" else "has been refused; the reason has been recorded"
    return f"என் மக்கள்: உங்கள் கோரிக்கை {request.request_ref} {tamil}.\nMy People: your request {request.request_ref} {english}."
