"""Certificates (BRD M34, D25, INT-22, FR-RNW-004 to 008, BR-137).

A member asks for a certificate in the app (M34); staff holding certificate.issue_revoke over the
member's area issue, revoke and reissue them with a reason (D25). Each certificate names the holder
and what it certifies, never an NIC or passport number. Asking again for a certificate whose facts
have not changed returns the same one; when they have changed (more completed assignments, a
corrected name), the new one supersedes the old. A membership certificate is revoked automatically
when the membership is suspended or becomes inactive, including a lapse at renewal.

Anyone may check a certificate by its token (INT-22): the answer is only the type, the holder's
name, the issue date and the status, at most 30 checks an hour from one address.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import AreaPath
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE
from app.modules.membership import repository as membership_repository
from app.modules.membership.certificates import repository, rules, tokens
from app.modules.membership.certificates.repository import AttendedEvent, Certificate, ListedCertificate
from app.modules.membership.certificates.rules import ISSUE_REVOKE, Kind
from app.modules.messaging.notifications import service as notifications

SUPERSEDED_BY_MEMBER = "Replaced by a newer copy with updated details"
REVOKED_REASONS = {
    "suspended": "Membership suspended",
    "inactive": "Membership no longer active",
}


class CertificateRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class CertificateNotFound(Exception):
    pass


class TooManyChecks(Exception):
    pass


def _today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()


def _local_date(moment: datetime) -> str:
    return moment.astimezone(LOCAL_ZONE).date().isoformat()


def _facts(db: Session, member_id: uuid.UUID, kind: Kind, event_id: uuid.UUID | None,
           now: datetime) -> tuple[str, dict[str, Any], list[str]]:
    """(source_ref, details, problems) for a certificate of this kind, from the records as they are now."""
    status = access_repository.find_member_status(db, member_id)
    if status is None:
        raise CertificateNotFound()
    events: list[AttendedEvent] = []
    assignments: list[repository.CompletedAssignment] = []
    if kind == "event_participation":
        if event_id is None:
            return "", {}, ["event_required"]
        events = repository.attended_events(db, member_id, event_id)
    elif kind == "volunteer_service":
        assignments = repository.completed_assignments(db, member_id, now)
    problems = rules.check_issue(
        kind,
        identity_verified=status.identity_verified,
        membership_active=status.membership_active,
        attended_event=bool(events),
        completed_assignments=len(assignments),
    )
    if problems:
        return "", {}, problems
    if kind == "membership":
        since = repository.member_since(db, member_id)
        return "", {"memberSince": since.isoformat() if since else None}, []
    if kind == "event_participation":
        event = events[0]
        return str(event.event_id), {
            "eventRef": event.event_ref, "eventTitleEn": event.title_en, "eventTitleTa": event.title_ta,
            "eventDate": _local_date(event.starts_at),
        }, []
    listed = [
        {"ref": a.opportunity_ref, "titleEn": a.title_en, "titleTa": a.title_ta, "roleEn": a.role_en, "roleTa": a.role_ta,
         "date": _local_date(a.ends_at)}
        for a in assignments[: rules.LISTED_ASSIGNMENTS]
    ]
    return "", {"assignmentCount": len(assignments), "assignments": listed}, []


def _create(db: Session, member_id: uuid.UUID, kind: Kind, source_ref: str, details: dict[str, Any],
            issued_by: uuid.UUID | None, secret: str, now: datetime) -> Certificate:
    holder = repository.holder_name(db, member_id)
    if holder is None:
        raise CertificateNotFound()
    certificate_id = uuid.uuid4()
    return repository.insert(
        db, certificate_id=certificate_id, member_id=member_id, kind=kind, source_ref=source_ref, holder_name=holder,
        details=details, issued_on=_today(now), issued_by=issued_by,
        token_hash=tokens.token_hash(tokens.token_for(certificate_id, secret)),
    )


def _audit(db: Session, actor_id: uuid.UUID | None, action: str, certificate: Certificate, ip: str | None,
           area_path: AreaPath | None = None, **details: object) -> None:
    audit.record(
        db, actor_id=actor_id, action=action, target_type="certificate", target_id=str(certificate.id),
        area_path=area_path or access_repository.member_area_path(db, certificate.member_id),
        details={"memberId": str(certificate.member_id), "certificateRef": certificate.certificate_ref,
                 "kind": certificate.kind, **details},
        ip=ip,
    )


def _replace(db: Session, old: Certificate, details: dict[str, Any], issued_by: uuid.UUID | None, reason: str,
             changed_by: uuid.UUID | None, secret: str, now: datetime) -> Certificate:
    """A new certificate for the same thing; the old one then verifies as Superseded (FR-RNW-008).
    The old one leaves the valid slot first, so the new one can take it, all in one transaction."""
    repository.release_valid(db, old.id, reason, changed_by)
    created = _create(db, old.member_id, old.kind, old.source_ref, details, issued_by, secret, now)  # type: ignore[arg-type]
    repository.supersede(db, old.id, created.id)
    return created


def token(certificate: Certificate, secret: str) -> str:
    return tokens.token_for(certificate.id, secret)


# --- The member (M34) -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class EventChoice:
    event: AttendedEvent
    has_certificate: bool


@dataclass(frozen=True)
class MyCertificates:
    certificates: list[Certificate]
    superseded_refs: dict[uuid.UUID, str]
    membership_problems: list[str]
    events: list[EventChoice]
    completed_assignments: int


def my_certificates(db: Session, member_id: uuid.UUID, secret: str, now: datetime | None = None) -> MyCertificates:
    moment = now or datetime.now(UTC)
    certificates = repository.of_member(db, member_id)
    # After JWT_SECRET is rotated the stored hash no longer matches the token the app would show;
    # the current token takes its place, so the next download verifies (old printouts do not).
    refreshed = False
    for certificate in certificates:
        current = tokens.token_hash(token(certificate, secret))
        if certificate.token_hash != current:
            repository.set_token_hash(db, certificate.id, current)
            refreshed = True
    if refreshed:
        db.commit()
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    valid_events = {c.source_ref for c in certificates if c.kind == "event_participation" and c.status == "valid"}
    return MyCertificates(
        certificates=certificates,
        superseded_refs=repository.refs(db, [c.superseded_by for c in certificates if c.superseded_by]),
        membership_problems=rules.check_issue(
            "membership", identity_verified=status.identity_verified, membership_active=status.membership_active,
            attended_event=False, completed_assignments=0,
        ),
        events=[EventChoice(e, str(e.event_id) in valid_events) for e in repository.attended_events(db, member_id)],
        completed_assignments=len(repository.completed_assignments(db, member_id, moment)),
    )


def request_certificate(db: Session, member_id: uuid.UUID, kind: Kind, event_id: uuid.UUID | None, secret: str,
                        ip: str, now: datetime | None = None) -> Certificate:
    """FR-RNW-004 to 006: the member's own certificate. The same one again when nothing changed."""
    moment = now or datetime.now(UTC)
    repository.lock_member(db, member_id)
    source_ref, details, problems = _facts(db, member_id, kind, event_id, moment)
    if problems:
        raise CertificateRefused(problems)
    existing = repository.find_valid(db, member_id, kind, source_ref)
    if existing is not None and existing.details == details and existing.holder_name == repository.holder_name(db, member_id):
        return existing
    if existing is None:
        created = _create(db, member_id, kind, source_ref, details, None, secret, moment)
    else:
        created = _replace(db, existing, details, None, SUPERSEDED_BY_MEMBER, None, secret, moment)
    _audit(db, member_id, "certificate.issued", created, ip)
    db.commit()
    found = repository.find(db, created.id)
    assert found is not None
    return found


# --- Staff (D25, PRM-52) ----------------------------------------------------------------------------------------


def _scope(db: Session, staff: Staff, member_id: uuid.UUID, target: str, ip: str) -> AreaPath:
    """Never one's own certificate (BR-085), and certificate.issue_revoke over the member's area."""
    path = access_repository.member_area_path(db, member_id)
    access.check_record_scope(db, staff, ISSUE_REVOKE, member_id=member_id, area_path=path,
                              target=("certificate", target), ip=ip)
    return path


def search(db: Session, staff: Staff, *, status: str | None, kind: str | None, ref: str | None,
           limit: int) -> list[ListedCertificate]:
    return repository.search(db, areas=access.visible_areas(staff, ISSUE_REVOKE), status=status, kind=kind,
                             ref=ref.strip() if ref else None, limit=limit)


def superseded_refs(db: Session, certificates: list[Certificate]) -> dict[uuid.UUID, str]:
    """The reference of each certificate that replaced one of these."""
    return repository.refs(db, [c.superseded_by for c in certificates if c.superseded_by])


def staff_issue(db: Session, staff: Staff, member_code: str, kind: Kind, event_id: uuid.UUID | None, secret: str,
                ip: str, now: datetime | None = None) -> Certificate:
    moment = now or datetime.now(UTC)
    found = membership_repository.lookup_member(db, member_code.strip())
    if found is None:
        raise CertificateNotFound()
    path = _scope(db, staff, found.id, "new", ip)
    repository.lock_member(db, found.id)
    source_ref, details, problems = _facts(db, found.id, kind, event_id, moment)
    if problems:
        raise CertificateRefused(problems)
    if repository.find_valid(db, found.id, kind, source_ref) is not None:
        raise CertificateRefused("already_issued")  # D25 reissues it instead, with a reason
    created = _create(db, found.id, kind, source_ref, details, staff.member_id, secret, moment)
    _audit(db, staff.member_id, "certificate.issued", created, ip, path)
    db.commit()
    return created


def revoke(db: Session, staff: Staff, certificate_id: uuid.UUID, reason: str, ip: str) -> Certificate:
    certificate = repository.find(db, certificate_id, lock=True)
    if certificate is None:
        raise CertificateNotFound()
    path = _scope(db, staff, certificate.member_id, str(certificate_id), ip)
    problems = rules.check_status_change(certificate.status, reason)
    if problems:
        raise CertificateRefused(problems)
    repository.change_status(db, certificate.id, status="revoked", reason=reason.strip(), changed_by=staff.member_id)
    notifications.notify(db, certificate.member_id, "certificate_revoked", certificate.id)
    # The reason stays with the certificate; the audit entry holds codes only.
    _audit(db, staff.member_id, "certificate.revoked", certificate, ip, path)
    db.commit()
    found = repository.find(db, certificate.id)
    assert found is not None
    return found


def reissue(db: Session, staff: Staff, certificate_id: uuid.UUID, reason: str, secret: str, ip: str,
            now: datetime | None = None) -> Certificate:
    """FR-RNW-008: a new certificate from the records as they are now; the old one verifies as Superseded."""
    moment = now or datetime.now(UTC)
    certificate = repository.find(db, certificate_id, lock=True)
    if certificate is None:
        raise CertificateNotFound()
    path = _scope(db, staff, certificate.member_id, str(certificate_id), ip)
    problems = rules.check_status_change(certificate.status, reason)
    if problems:
        raise CertificateRefused(problems)
    event_id = uuid.UUID(certificate.source_ref) if certificate.kind == "event_participation" else None
    _, details, problems = _facts(db, certificate.member_id, certificate.kind, event_id, moment)  # type: ignore[arg-type]
    if problems:
        raise CertificateRefused(problems)
    created = _replace(db, certificate, details, staff.member_id, reason.strip(), staff.member_id, secret, moment)
    notifications.notify(db, certificate.member_id, "certificate_reissued", created.id)
    _audit(db, staff.member_id, "certificate.reissued", created, ip, path, replaces=certificate.certificate_ref)
    db.commit()
    return created


def revoke_membership_certificates(db: Session, member_id: uuid.UUID, membership_state: str) -> None:
    """A membership certificate stops verifying as valid when the membership is suspended or becomes
    inactive (BR-137); called inside the change's transaction, which the caller commits."""
    reason = REVOKED_REASONS.get(membership_state)
    if reason is None:
        return
    for certificate in repository.valid_of_kind(db, member_id, "membership"):
        repository.change_status(db, certificate.id, status="revoked", reason=reason, changed_by=None)
        _audit(db, None, "certificate.revoked", certificate, None, membershipState=membership_state)


# --- The public check (INT-22, FR-RNW-007) -------------------------------------------------------------------------


@dataclass(frozen=True)
class PublicCheck:
    kind: str
    holder_name: str
    issued_on: date
    status: str


def check(db: Session, token_value: str, ip: str, secret: str) -> PublicCheck:
    caller = tokens.caller_hash(ip, secret)
    if rules.check_rate(repository.recent_checks(db, caller)):
        raise TooManyChecks()
    repository.record_check(db, caller)
    db.commit()
    certificate = repository.find_by_token_hash(db, tokens.token_hash(token_value))
    if certificate is None:
        raise CertificateNotFound()
    return PublicCheck(certificate.kind, certificate.holder_name, certificate.issued_on, certificate.status)


def purge_checks(db: Session) -> int:
    """Run by the notifications task: rate-limit rows older than the window are removed."""
    count = repository.purge_checks(db)
    db.commit()
    return count
