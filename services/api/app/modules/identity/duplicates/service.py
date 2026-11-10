"""Duplicate identity investigations (BRD FR-IDV-010, FR-WEB-012, BR-094, PRM-28, D04).

A case opens automatically when a review is submitted and another active
account has the same name and date of birth, or when a reviewer reports a
suspected duplicate. A holder of idv.duplicate.investigate over both
accounts' areas claims it, can open both accounts' evidence while holding
it, and records whether the accounts belong to one person, with a reason.
Both accounts keep their states throughout (BR-094).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import AreaPath, area_from_key
from app.modules.access.service import Staff, load_staff
from app.modules.audit import service as audit
from app.modules.identity.documents import repository as documents_repository
from app.modules.identity.duplicates import repository, rules
from app.modules.identity.duplicates.repository import StoredCase
from app.modules.identity.duplicates.rules import INVESTIGATE, REPORT, Outcome
from app.modules.identity.reviews import repository as reviews_repository
from app.modules.identity.reviews.repository import ReviewMember


class CaseNotFound(Exception):
    pass


class ReportRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class CaseConflict(Exception):
    """not_open, claimed_by_another or not_claimed_by_you."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class CaseMember:
    member: ReviewMember
    membership_state: str
    documents: list[documents_repository.StoredDocument]


@dataclass(frozen=True)
class CaseFile:
    case: StoredCase
    members: list[CaseMember]


def _area_path(case: StoredCase) -> AreaPath:
    return tuple(area_from_key(key) for key in case.area_path)


def _combined_area(db: Session, first: uuid.UUID, second: uuid.UUID) -> list[str]:
    keys: list[str] = []
    for member_id in (first, second):
        for area in access_repository.member_area_path(db, member_id):
            if area.key not in keys:
                keys.append(area.key)
    return keys


def _record(db: Session, actor_id: uuid.UUID | None, action: str, case: StoredCase, ip: str | None, **details: object) -> None:
    audit.record(
        db,
        actor_id=actor_id,
        action=action,
        target_type="duplicate_case",
        target_id=str(case.id),
        area_path=_area_path(case),
        details={"caseRef": case.case_ref, "memberIds": [str(case.member_a), str(case.member_b)], **details},
        ip=ip,
    )


def open_profile_matches(db: Session, member_id: uuid.UUID) -> list[StoredCase]:
    """Open a case for each other account with the same name and date of birth. Runs inside the
    caller's transaction (a review submission); pairs that already have a case are left alone."""
    opened = []
    for other_id in repository.same_name_and_birth_date(db, member_id):
        member_a, member_b = rules.ordered_pair(member_id, other_id)
        if repository.find_pair(db, member_a, member_b) is not None:
            continue
        case = repository.insert_case(
            db,
            member_a=member_a,
            member_b=member_b,
            signal="profile_match",
            opened_by=None,
            opened_reason=None,
            area_path=_combined_area(db, member_a, member_b),
        )
        _record(db, None, "identity.duplicate.opened", case, None, signal="profile_match")
        opened.append(case)
    return opened


def report(
    db: Session, staff: Staff, member_id: uuid.UUID, other_member_id: uuid.UUID, reason: str, ip: str
) -> StoredCase:
    """A reviewer reports that the member whose review they hold may hold another account.

    Only from inside that open review (PRM-03): otherwise a report could name any two members
    and open a case on them. The reporter never investigates the case (see claim).
    """
    if access_repository.find_member_status(db, member_id) is None:
        raise CaseNotFound()
    if access_repository.find_member_status(db, other_member_id) is None:
        raise CaseNotFound()
    area_path = access_repository.member_area_path(db, member_id)
    target = ("member", str(member_id))
    access.check_record_scope(db, staff, REPORT, member_id=member_id, area_path=area_path, target=target, ip=ip)
    if not reviews_repository.has_open_review_claimed_by(db, member_id, staff.member_id):
        access.refuse(db, staff, REPORT, "no_open_review", ip, target=target, area_path=area_path)
    problems = rules.check_report(staff.member_id, member_id, other_member_id)
    if problems:
        raise ReportRefused(problems)

    member_a, member_b = rules.ordered_pair(member_id, other_member_id)
    existing = repository.find_pair(db, member_a, member_b)
    if existing is not None:
        return existing
    case = repository.insert_case(
        db,
        member_a=member_a,
        member_b=member_b,
        signal="reported",
        opened_by=staff.member_id,
        opened_reason=reason,
        area_path=_combined_area(db, member_a, member_b),
    )
    _record(db, staff.member_id, "identity.duplicate.opened", case, ip, signal="reported")
    db.commit()
    return case


def _load_for_investigator(db: Session, staff: Staff, case_id: uuid.UUID, ip: str, *, lock: bool = False) -> StoredCase:
    """The investigator needs the permission over both accounts' areas, and is neither account (BR-085)."""
    case = repository.find_case(db, case_id, for_update=lock)
    if case is None:
        raise CaseNotFound()
    for member_id in case.members():
        access.check_record_scope(
            db,
            staff,
            INVESTIGATE,
            member_id=member_id,
            area_path=access_repository.member_area_path(db, member_id),
            target=("duplicate_case", str(case.id)),
            ip=ip,
        )
    return case


def queue(db: Session, staff: Staff, *, states: list[str], mine: bool, limit: int, offset: int = 0) -> list[StoredCase]:
    return repository.queue(
        db,
        visible_areas=access.visible_areas(staff, INVESTIGATE),
        states=states,
        claimed_by=staff.member_id if mine else None,
        limit=limit,
        offset=offset,
    )


def case_file(db: Session, staff: Staff, case_id: uuid.UUID, ip: str) -> CaseFile:
    case = _load_for_investigator(db, staff, case_id, ip)
    members = []
    for member_id in case.members():
        member = reviews_repository.find_member(db, member_id)
        status = access_repository.find_member_status(db, member_id)
        assert member is not None and status is not None
        members.append(
            CaseMember(
                member=member,
                membership_state=status.membership_state,
                documents=documents_repository.current_documents(db, member_id),
            )
        )
    return CaseFile(case=case, members=members)


def claim(db: Session, staff: Staff, case_id: uuid.UUID, ip: str) -> StoredCase:
    case = _load_for_investigator(db, staff, case_id, ip, lock=True)
    claimant_still_authorised = case.claimed_by is not None and all(
        access.has_permission_over(load_staff(db, case.claimed_by), INVESTIGATE, access_repository.member_area_path(db, m))
        for m in case.members()
    )
    problem = rules.check_claim(
        case.state, case.claimed_by, staff.member_id, claimant_still_authorised, opened_by=case.opened_by  # type: ignore[arg-type]
    )
    if problem:
        raise CaseConflict(problem)
    if case.claimed_by == staff.member_id:
        return case
    repository.claim(db, case.id, staff.member_id)
    taken_over = {"takenOverFrom": str(case.claimed_by)} if case.claimed_by else {}
    _record(db, staff.member_id, "identity.duplicate.claimed", case, ip, **taken_over)
    db.commit()
    reloaded = repository.find_case(db, case.id)
    assert reloaded is not None
    return reloaded


def release(db: Session, staff: Staff, case_id: uuid.UUID, ip: str) -> StoredCase:
    case = _load_for_investigator(db, staff, case_id, ip, lock=True)
    if case.state != "in_review":
        raise CaseConflict("not_open")
    if case.claimed_by != staff.member_id:
        raise CaseConflict("not_claimed_by_you")
    repository.release(db, case.id)
    _record(db, staff.member_id, "identity.duplicate.released", case, ip)
    db.commit()
    reloaded = repository.find_case(db, case.id)
    assert reloaded is not None
    return reloaded


def decide(db: Session, staff: Staff, case_id: uuid.UUID, outcome: Outcome, reason: str, ip: str) -> StoredCase:
    """Record the finding. It changes neither account; any action on them is a separate,
    authorised membership change with its own reason (BR-015, BR-094)."""
    case = _load_for_investigator(db, staff, case_id, ip, lock=True)
    if case.state != "in_review":
        raise CaseConflict("not_open")
    if case.claimed_by != staff.member_id:
        raise CaseConflict("not_claimed_by_you")
    repository.decide(db, case.id, outcome=outcome, decided_by=staff.member_id, reason=reason)
    _record(db, staff.member_id, "identity.duplicate.decided", case, ip, outcome=outcome)
    db.commit()
    reloaded = repository.find_case(db, case.id)
    assert reloaded is not None
    return reloaded


def flags_for_member(db: Session, member_id: uuid.UUID) -> list[StoredCase]:
    return repository.cases_for_member(db, member_id)
