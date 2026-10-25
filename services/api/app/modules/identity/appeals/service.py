"""Appeals against identity decisions (BRD FR-IDV-013, PRM-29, M04, D05, §15B.4).

A member may appeal a Request-update or Unable-to-verify decision once. A
holder of idv.appeal.decide over the member's area, never the original
reviewer, claims the appeal, can open the evidence while holding it, and
upholds or overturns the decision with a reason the member sees. While an
appeal is open the member cannot submit again (see identity/reviews/service.py).

Not built yet: the 10-working-day target is not tracked, and the member is
not notified (FR-REG-021).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import service as access
from app.modules.access.rules import AreaPath, area_from_key, highest_tier
from app.modules.access.service import Staff, load_staff
from app.modules.audit import service as audit
from app.modules.identity.documents import repository as identity_repository
from app.modules.identity.reviews import repository as verification_repository
from app.modules.identity.reviews.repository import ReviewMember, StoredDecision, StoredReview
from app.modules.identity.appeals import repository, rules
from app.modules.identity.appeals.repository import StoredAppeal
from app.modules.identity.appeals.rules import APPEAL_DECIDE, Outcome


class AppealNotFound(Exception):
    pass


class AppealRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class AppealConflict(Exception):
    """not_open, original_reviewer, claimed_by_another or not_claimed_by_you."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class AppealFile:
    """Everything D05 shows about one appeal, apart from the images themselves."""

    appeal: StoredAppeal
    review: StoredReview
    decision: StoredDecision
    member: ReviewMember
    documents: list[identity_repository.StoredDocument]


def _area_path(appeal: StoredAppeal) -> AreaPath:
    return tuple(area_from_key(key) for key in appeal.area_path)


def _record(db: Session, actor_id: uuid.UUID, action: str, appeal: StoredAppeal, ip: str, **details: object) -> None:
    audit.record(
        db,
        actor_id=actor_id,
        action=action,
        target_type="review_appeal",
        target_id=str(appeal.id),
        area_path=_area_path(appeal),
        details={
            "memberId": str(appeal.member_id),
            "reviewRef": appeal.review_ref,
            "appealRef": appeal.appeal_ref,
            **details,
        },
        ip=ip,
    )


def _reload(db: Session, appeal_id: uuid.UUID) -> StoredAppeal:
    appeal = repository.find_appeal(db, appeal_id)
    assert appeal is not None
    return appeal


# --- The member's side (M04) ------------------------------------------------------------


def submit(db: Session, member_id: uuid.UUID, statement: str, ip: str) -> StoredAppeal:
    """Appeal the latest decision on the member's latest review. The statement stays in
    the appeal record, visible to the member and the deciders only; the audit log holds ids."""
    verification_repository.lock_member(db, member_id)
    review = verification_repository.latest_review(db, member_id)
    decisions = verification_repository.decisions(db, review.id) if review else []
    last = decisions[-1] if decisions else None
    already_appealed = last is not None and repository.find_by_decision(db, last.id) is not None
    problems = rules.check_appeal(review.state if review else None, already_appealed)
    if problems:
        raise AppealRefused(problems)
    assert review is not None and last is not None

    appeal = repository.insert_appeal(
        db,
        decision_id=last.id,
        review_id=review.id,
        member_id=member_id,
        area_path=review.area_path,
        statement=statement,
    )
    _record(db, member_id, "identity.appeal.submitted", appeal, ip, appealedDecision=last.decision)
    db.commit()
    return appeal


# --- The decider's side (D05) -------------------------------------------------------------


def _load_for_decider(db: Session, staff: Staff, appeal_id: uuid.UUID, ip: str, *, lock: bool = False) -> StoredAppeal:
    appeal = repository.find_appeal(db, appeal_id, for_update=lock)
    if appeal is None:
        raise AppealNotFound()
    access.check_record_scope(
        db,
        staff,
        APPEAL_DECIDE,
        member_id=appeal.member_id,
        area_path=_area_path(appeal),
        target=("review_appeal", str(appeal.id)),
        ip=ip,
    )
    return appeal


def queue(db: Session, staff: Staff, *, states: list[str], mine: bool, limit: int) -> list[StoredAppeal]:
    """D05: appeals in the areas where the person holds idv.appeal.decide, oldest first."""
    return repository.queue(
        db,
        visible_areas=access.visible_areas(staff, APPEAL_DECIDE),
        states=states,
        claimed_by=staff.member_id if mine else None,
        limit=limit,
    )


def appeal_file(db: Session, staff: Staff, appeal_id: uuid.UUID, ip: str) -> AppealFile:
    appeal = _load_for_decider(db, staff, appeal_id, ip)
    review = verification_repository.find_review(db, appeal.review_id)
    member = verification_repository.find_member(db, appeal.member_id)
    assert review is not None and member is not None
    [decision] = [d for d in verification_repository.decisions(db, review.id) if d.id == appeal.decision_id]
    return AppealFile(
        appeal=appeal,
        review=review,
        decision=decision,
        member=member,
        documents=identity_repository.current_documents(db, appeal.member_id),
    )


def claim(db: Session, staff: Staff, appeal_id: uuid.UUID, ip: str) -> StoredAppeal:
    """Take the appeal; while held, its evidence opens to the decider (PRM-03)."""
    appeal = _load_for_decider(db, staff, appeal_id, ip, lock=True)
    claimant_still_authorised = appeal.claimed_by is not None and access.has_permission_over(
        load_staff(db, appeal.claimed_by), APPEAL_DECIDE, _area_path(appeal)
    )
    problem = rules.check_claim(
        appeal.state,  # type: ignore[arg-type]
        appeal.claimed_by,
        staff.member_id,
        appeal.original_reviewer_id,
        claimant_still_authorised,
    )
    if problem:
        raise AppealConflict(problem)
    if appeal.claimed_by == staff.member_id:
        return appeal

    repository.claim(db, appeal.id, staff.member_id)
    taken_over = {"takenOverFrom": str(appeal.claimed_by)} if appeal.claimed_by else {}
    _record(db, staff.member_id, "identity.appeal.claimed", appeal, ip, **taken_over)
    db.commit()
    return _reload(db, appeal.id)


def release(db: Session, staff: Staff, appeal_id: uuid.UUID, ip: str) -> StoredAppeal:
    appeal = _load_for_decider(db, staff, appeal_id, ip, lock=True)
    if appeal.state != "in_review":
        raise AppealConflict("not_open")
    if appeal.claimed_by != staff.member_id:
        raise AppealConflict("not_claimed_by_you")
    repository.release(db, appeal.id)
    _record(db, staff.member_id, "identity.appeal.released", appeal, ip)
    db.commit()
    return _reload(db, appeal.id)


def decide(db: Session, staff: Staff, appeal_id: uuid.UUID, outcome: Outcome, reason: str, ip: str) -> StoredAppeal:
    """Uphold the decision, or overturn it so the review is decided afresh by someone else.
    The outcome and the reason are final and shown to the member."""
    appeal = _load_for_decider(db, staff, appeal_id, ip, lock=True)
    if appeal.state != "in_review":
        raise AppealConflict("not_open")
    if appeal.claimed_by != staff.member_id:
        raise AppealConflict("not_claimed_by_you")
    if appeal.original_reviewer_id == staff.member_id:
        raise AppealConflict("original_reviewer")

    tier = highest_tier(staff.rule_assignments(), APPEAL_DECIDE, _area_path(appeal))
    assert tier is not None  # check_record_scope has confirmed idv.appeal.decide over the area
    repository.decide(
        db, appeal.id, state=rules.STATE_AFTER[outcome], decided_by=staff.member_id, decider_tier=tier, reason=reason
    )
    if outcome == "overturn":
        review = verification_repository.find_review(db, appeal.review_id, for_update=True)
        assert review is not None
        verification_repository.reopen_after_appeal(db, review.id)
        if review.state == "unable_to_verify":
            # The member is back in review in the live member app too.
            verification_repository.set_express_status(
                db, member_id=review.member_id, status="review_pending", changed_by=staff.member_id, review_ref=review.review_ref
            )
    _record(db, staff.member_id, "identity.appeal.decided", appeal, ip, outcome=outcome)
    db.commit()
    return _reload(db, appeal.id)
