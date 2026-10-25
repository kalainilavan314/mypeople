"""Recovery contact, account recovery and assisted recovery (BRD FR-REG-028, FR-AUTH-014 to 017,
FR-AUTH-023, FR-AUTH-026, BR-023, BR-024).

- A mobile number becomes the recovery contact only after the member enters
  the code sent to it (FR-REG-028). Changing it later tells the old number.
- Recovery sends a code only to a confirmed contact and answers the same way
  whether or not the ID number is registered (BR-023, FR-AUTH-014). A correct
  code gives a 10-minute reset token; the new password ends every session and
  the contact is told (FR-AUTH-015, 016). This is also how a member moves to a
  new phone without staff (FR-AUTH-026).
- Someone who cannot use their contact asks for assisted recovery and gets a
  reference (FR-AUTH-017). A reviewer who has checked the person's identity can
  replace the recovery contact; the person then recovers normally.

Not built yet: the 24-hour delay on high-risk actions after a contact change
(FR-AUTH-023), because no such action exists yet; the change time is recorded.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.security import hash_password, one_time_code_hash
from app.integrations.sms import SmsSender, SmsUnavailable
from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import PLATFORM, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.auth import repository as auth_repository
from app.modules.identity.recovery import repository, reset_tokens, rules
from app.modules.identity.recovery.repository import AssistedRequest
from app.modules.identity.registration import rules as registration_rules


class TooManyRequests(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"retry after {retry_after}s")
        self.retry_after = retry_after


class InvalidPhone(Exception):
    pass


class PhoneUnavailable(Exception):
    """The number belongs to another account."""


class CodeRefused(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason  # invalid_code or too_many_attempts


class PasswordRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class RequestNotFound(Exception):
    pass


class ResolutionRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _send_code(
    db: Session, sms: SmsSender, *, phone: str, purpose: str, ip: str, jwt_secret: str, wait_quietly: bool = False
) -> str | None:
    """Issue and send a code; returns it (only development shows it) or None when limits stop it quietly."""
    wait = rules.code_request_wait(repository.code_requests(db, phone, ip))
    if wait is not None:
        if wait_quietly:
            return None  # recovery answers the same either way (BR-023)
        raise TooManyRequests(wait)
    code = rules.new_code()
    lifetime = rules.CODE_LIFETIME[purpose]
    # Sent before saving: if the provider refuses, no code exists that nobody received.
    sms.send(phone, rules.code_message(code, lifetime))
    repository.issue_code(
        db, phone=phone, purpose=purpose, code_hash=one_time_code_hash(code, jwt_secret), ip=ip, lifetime=lifetime
    )
    db.commit()
    return code


def notify_member(db: Session, sms: SmsSender, member_id: uuid.UUID, text: str) -> None:
    """A notice to the member's confirmed number, if they have one; best effort."""
    contact = repository.find_contact(db, member_id)
    if contact is not None:
        _notify(sms, contact.phone, text)


def _notify(sms: SmsSender, phone: str, text: str) -> None:
    """Best effort: a notice that cannot be sent must not undo the change it reports."""
    try:
        sms.send(phone, text)
    except SmsUnavailable:
        pass


# --- Recovery contact (FR-REG-028) ---------------------------------------------------------------


def my_phone(db: Session, member_id: uuid.UUID) -> str | None:
    contact = repository.find_contact(db, member_id)
    return contact.phone if contact else None


def request_phone_confirmation(
    db: Session, sms: SmsSender, member_id: uuid.UUID, raw_phone: str, ip: str, jwt_secret: str
) -> str | None:
    phone = rules.normalise_phone(raw_phone)
    if phone is None:
        raise InvalidPhone()
    if repository.phone_in_use(db, phone, member_id):
        raise PhoneUnavailable()
    return _send_code(db, sms, phone=phone, purpose=rules.CONFIRM_PHONE, ip=ip, jwt_secret=jwt_secret)


def confirm_phone(
    db: Session, sms: SmsSender, member_id: uuid.UUID, raw_phone: str, code: str, ip: str, jwt_secret: str
) -> str:
    phone = rules.normalise_phone(raw_phone)
    if phone is None:
        raise InvalidPhone()
    result = repository.consume_code(
        db, phone=phone, purpose=rules.CONFIRM_PHONE, code_hash=one_time_code_hash(code, jwt_secret)
    )
    if result != "ok":
        db.commit()  # keep the attempt count
        raise CodeRefused("too_many_attempts" if result == "too_many_attempts" else "invalid_code")
    if repository.phone_in_use(db, phone, member_id):
        raise PhoneUnavailable()

    previous = repository.find_contact(db, member_id)
    repository.set_contact(db, member_id, phone, confirmed_by=None)
    audit.record(
        db,
        actor_id=member_id,
        action="identity.contact.confirmed",
        target_type="member",
        target_id=str(member_id),
        area_path=access_repository.member_area_path(db, member_id),
        details={"memberId": str(member_id), "replaced": previous is not None},
        ip=ip,
    )
    db.commit()
    if previous is not None and previous.phone != phone:
        _notify(sms, previous.phone, rules.CONTACT_CHANGED_MESSAGE)  # FR-AUTH-023
    return phone


# --- Recovery (FR-AUTH-014 to 016) -------------------------------------------------------------------


def request_recovery(db: Session, sms: SmsSender, id_hash: str, ip: str, jwt_secret: str) -> str | None:
    """Send a code to the confirmed contact, if there is one. The caller answers the same in every case."""
    member_id = repository.member_by_id_hash(db, id_hash)
    contact = repository.find_contact(db, member_id) if member_id else None
    if contact is None:
        return None
    return _send_code(db, sms, phone=contact.phone, purpose=rules.RECOVERY, ip=ip, jwt_secret=jwt_secret, wait_quietly=True)


def verify_recovery(db: Session, id_hash: str, code: str, jwt_secret: str) -> str:
    """A correct recovery code gives a 10-minute reset token."""
    member_id = repository.member_by_id_hash(db, id_hash)
    contact = repository.find_contact(db, member_id) if member_id else None
    if member_id is None or contact is None:
        raise CodeRefused("invalid_code")  # the same answer as a wrong code (BR-023)
    result = repository.consume_code(
        db, phone=contact.phone, purpose=rules.RECOVERY, code_hash=one_time_code_hash(code, jwt_secret)
    )
    db.commit()
    if result != "ok":
        raise CodeRefused("too_many_attempts" if result == "too_many_attempts" else "invalid_code")
    version = repository.session_version(db, member_id)
    assert version is not None
    return reset_tokens.sign(member_id, version, jwt_secret)


def reset_password(db: Session, sms: SmsSender, token: str, new_password: str, ip: str, jwt_secret: str) -> None:
    claims = reset_tokens.read(token, jwt_secret)
    # A token from before any later reset or sign-out no longer matches: single use.
    if repository.session_version(db, claims.member_id) != claims.session_version:
        raise reset_tokens.InvalidResetToken()
    problems = registration_rules.check_password(new_password, "")
    if problems:
        raise PasswordRefused(problems)

    repository.set_password(db, claims.member_id, hash_password(new_password))
    auth_repository.revoke_member_sessions(db, claims.member_id, "password_reset")
    audit.record(
        db,
        actor_id=claims.member_id,
        action="identity.password.reset",
        target_type="member",
        target_id=str(claims.member_id),
        details={"memberId": str(claims.member_id), "via": "recovery_code"},
        ip=ip,
    )
    db.commit()
    contact = repository.find_contact(db, claims.member_id)
    if contact is not None:
        _notify(sms, contact.phone, rules.PASSWORD_CHANGED_MESSAGE)  # FR-AUTH-016


# --- Assisted recovery (FR-AUTH-017) ------------------------------------------------------------------


@dataclass(frozen=True)
class AssistedForm:
    id_hash: str | None
    contact_method: str
    contact_value: str | None
    message: str | None


def request_assisted(db: Session, form: AssistedForm, ip: str) -> str:
    """Record the request and return its reference, whether or not the ID number matched an account."""
    if repository.assisted_requests_from(db, ip) >= rules.MAX_ASSISTED_REQUESTS_PER_IP_PER_HOUR:
        raise TooManyRequests(3600)
    member_id = repository.member_by_id_hash(db, form.id_hash) if form.id_hash else None
    area = access_repository.member_area_path(db, member_id) if member_id else (PLATFORM,)
    request = repository.insert_assisted(
        db,
        member_id=member_id,
        contact_method=form.contact_method,
        contact_value=form.contact_value,
        message=form.message,
        area_path=[a.key for a in area],
        ip=ip,
    )
    audit.record(
        db,
        actor_id=None,
        action="identity.recovery.requested",
        target_type="assisted_recovery",
        target_id=str(request.id),
        area_path=area,
        details={"reference": request.reference, "matchedAccount": member_id is not None},
        ip=ip,
    )
    db.commit()
    return request.reference


def assisted_queue(db: Session, staff: Staff, *, states: list[str], limit: int) -> list[AssistedRequest]:
    return repository.assisted_queue(
        db, visible_areas=access.visible_areas(staff, rules.HANDLE_ASSISTED), states=states, limit=limit
    )


def _load_assisted(db: Session, staff: Staff, request_id: uuid.UUID, ip: str, *, lock: bool = False) -> AssistedRequest:
    request = repository.find_assisted(db, request_id, for_update=lock)
    if request is None:
        raise RequestNotFound()
    area_path = tuple(area_from_key(key) for key in request.area_path)
    target = ("assisted_recovery", str(request.id))
    if request.member_id is not None:
        access.check_record_scope(
            db, staff, rules.HANDLE_ASSISTED, member_id=request.member_id, area_path=area_path, target=target, ip=ip
        )
    elif not access.has_platform_permission(staff, rules.HANDLE_ASSISTED):
        # A request that matched no account has no area: only platform scope may see it.
        access.refuse(db, staff, rules.HANDLE_ASSISTED, "outside_your_area", ip, target=target, area_path=area_path)
    return request


def assisted_request(db: Session, staff: Staff, request_id: uuid.UUID, ip: str) -> AssistedRequest:
    return _load_assisted(db, staff, request_id, ip)


def resolve_assisted(
    db: Session,
    sms: SmsSender,
    staff: Staff,
    request_id: uuid.UUID,
    *,
    outcome: str,
    new_phone: str | None,
    note: str,
    ip: str,
) -> AssistedRequest:
    """Replace the recovery contact after checking the person's identity, or decline with a note."""
    request = _load_assisted(db, staff, request_id, ip, lock=True)
    if request.state != "open":
        raise ResolutionRefused("not_open")

    previous = None
    if outcome == "contact_replaced":
        if request.member_id is None:
            raise ResolutionRefused("no_matching_account")
        phone = rules.normalise_phone(new_phone or "")
        if phone is None:
            raise InvalidPhone()
        if repository.phone_in_use(db, phone, request.member_id):
            raise PhoneUnavailable()
        previous = repository.find_contact(db, request.member_id)
        repository.set_contact(db, request.member_id, phone, confirmed_by=staff.member_id)
    repository.resolve_assisted(db, request.id, state=outcome, resolved_by=staff.member_id, note=note)
    audit.record(
        db,
        actor_id=staff.member_id,
        action=f"identity.recovery.{outcome}",
        target_type="assisted_recovery",
        target_id=str(request.id),
        area_path=tuple(area_from_key(key) for key in request.area_path),
        details={"reference": request.reference, "memberId": str(request.member_id) if request.member_id else None},
        ip=ip,
    )
    db.commit()
    if outcome == "contact_replaced" and previous is not None:
        _notify(sms, previous.phone, rules.CONTACT_CHANGED_MESSAGE)
    resolved = repository.find_assisted(db, request.id)
    assert resolved is not None
    return resolved

