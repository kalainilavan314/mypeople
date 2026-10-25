"""Identity verification: members submit their images for team review; a reviewer
holding members.verify claims the review, inspects the evidence and decides
(BRD §9.3, W01, W02, FR-REG-019 to 025, FR-WEB-001 to 013, BR-011 to 014,
BR-080 to 086).

Each change and its audit entry are saved in one transaction. Approval
confirms identity only: membership stays a separate decision (BR-014, OD-02).
npm.member.verification_status is kept in step for the live member app.

Appeals against a decision are in app/modules/verification_appeals. Not
built yet: automated screening and overrides (FR-IDV-011, 012), duplicate flags
(FR-WEB-012), member notifications (FR-REG-021), consent records (BR-008)
and declared relatives (BR-085).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import AreaPath, area_from_key
from app.modules.access.service import Staff, load_staff
from app.modules.audit import service as audit
from app.modules.identity import repository as identity_repository
from app.modules.identity.service import VIEWED
from app.modules.verification import repository, rules
from app.modules.verification.repository import ReviewMember, StoredDecision, StoredReview
from app.modules.verification.rules import VERIFY, Decision, Route
from app.modules.verification_appeals import repository as appeals_repository
from app.modules.verification_appeals.repository import StoredAppeal


class ReviewNotFound(Exception):
    pass


class SubmissionRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class DecisionRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class ReviewConflict(Exception):
    """The review is not in a state that allows the action: not_open, claimed_by_another, not_claimed_by_you."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class DecisionInput:
    decision: Decision
    checklist: list[str]
    items: list[str]
    reason_category: str | None
    note: str | None


@dataclass(frozen=True)
class ReviewFile:
    """Everything W02 shows about one review, apart from the images themselves."""

    review: StoredReview
    member: ReviewMember
    documents: list[identity_repository.StoredDocument]
    decisions: list[StoredDecision]
    appeals: list[StoredAppeal]


def _area_path(review: StoredReview) -> AreaPath:
    return tuple(area_from_key(key) for key in review.area_path)


def _record(db: Session, actor_id: uuid.UUID, action: str, review: StoredReview, ip: str, **details: object) -> None:
    audit.record(
        db,
        actor_id=actor_id,
        action=action,
        target_type="identity_review",
        target_id=str(review.id),
        area_path=_area_path(review),
        details={"memberId": str(review.member_id), "reviewRef": review.review_ref, **details},
        ip=ip,
    )


def _reload(db: Session, review_id: uuid.UUID) -> StoredReview:
    review = repository.find_review(db, review_id)
    assert review is not None
    return review


# --- The member's side ----------------------------------------------------------------


def submit(db: Session, member_id: uuid.UUID, route: Route, ip: str) -> StoredReview:
    """Send the images for team review (FR-REG-019), or a correction back to the same review (FR-REG-023).

    Repeating a submit while the review is open returns that review, so a
    double tap never creates a second VR reference.
    """
    repository.lock_member(db, member_id)
    current = {d.kind: str(d.id) for d in identity_repository.current_documents(db, member_id)}
    review = repository.latest_review(db, member_id)

    if review is not None and review.state in ("submitted", "in_review"):
        return review
    if review is not None and appeals_repository.has_pending_appeal(db, review.id):
        # The appeal decides what happens next; a new submission would overtake it.
        raise SubmissionRefused(["appeal_pending"])

    if review is not None and review.state == "needs_update":
        last = repository.decisions(db, review.id)[-1]
        problems = rules.check_correction(route, review.route, last.requested_items, last.document_ids(), current)  # type: ignore[arg-type]
        if problems:
            raise SubmissionRefused(problems)
        repository.resubmit(db, review.id)
        _record(db, member_id, "identity.review.resubmitted", review, ip)
        db.commit()
        return _reload(db, review.id)

    member = repository.find_member(db, member_id)
    assert member is not None
    problems = rules.check_new_submission(route, set(current), member.verification_status == "identity_confirmed")
    if problems:
        raise SubmissionRefused(problems)
    area_path = access_repository.member_area_path(db, member_id)
    review = repository.insert_review(db, member_id=member_id, route=route, area_path=[a.key for a in area_path])
    repository.set_express_status(
        db, member_id=member_id, status="review_pending", changed_by=member_id, review_ref=review.review_ref
    )
    _record(db, member_id, "identity.review.submitted", review, ip, route=route)
    db.commit()
    return review


def my_review(
    db: Session, member_id: uuid.UUID
) -> tuple[StoredReview, list[StoredDecision], list[StoredAppeal]] | None:
    review = repository.latest_review(db, member_id)
    if review is None:
        return None
    return review, repository.decisions(db, review.id), appeals_repository.appeals_for_review(db, review.id)


# --- The reviewer's side ----------------------------------------------------------------


def _load_for_reviewer(db: Session, staff: Staff, review_id: uuid.UUID, ip: str, *, lock: bool = False) -> StoredReview:
    review = repository.find_review(db, review_id, for_update=lock)
    if review is None:
        raise ReviewNotFound()
    access.check_record_scope(
        db,
        staff,
        VERIFY,
        member_id=review.member_id,
        area_path=_area_path(review),
        target=("identity_review", str(review.id)),
        ip=ip,
    )
    return review


def queue(
    db: Session, staff: Staff, *, states: list[str], mine: bool, review_ref: str | None, limit: int
) -> list[StoredReview]:
    """W01: reviews in the areas where the person holds members.verify (FR-WEB-001, 002)."""
    return repository.queue(
        db,
        visible_areas=access.visible_areas(staff, VERIFY),
        states=states,
        claimed_by=staff.member_id if mine else None,
        review_ref=review_ref,
        limit=limit,
    )


def queue_counts(db: Session, staff: Staff) -> repository.QueueCounts:
    return repository.queue_counts(db, visible_areas=access.visible_areas(staff, VERIFY), reviewer_id=staff.member_id)


def review_file(db: Session, staff: Staff, review_id: uuid.UUID, ip: str) -> ReviewFile:
    review = _load_for_reviewer(db, staff, review_id, ip)
    member = repository.find_member(db, review.member_id)
    assert member is not None
    return ReviewFile(
        review=review,
        member=member,
        documents=identity_repository.current_documents(db, review.member_id),
        decisions=repository.decisions(db, review.id),
        appeals=appeals_repository.appeals_for_review(db, review.id),
    )


def claim(db: Session, staff: Staff, review_id: uuid.UUID, ip: str) -> StoredReview:
    """Take a review, so nobody else works on it at the same time (FR-WEB-003). Opens its evidence to this reviewer."""
    review = _load_for_reviewer(db, staff, review_id, ip, lock=True)
    claimant_still_authorised = review.claimed_by is not None and access.has_permission_over(
        load_staff(db, review.claimed_by), VERIFY, _area_path(review)
    )
    problem = rules.check_claim(
        review.state,  # type: ignore[arg-type]
        review.claimed_by,
        staff.member_id,
        claimant_still_authorised,
        overturned_on_appeal=staff.member_id in appeals_repository.overturned_reviewers(db, review.id),
    )
    if problem:
        raise ReviewConflict(problem)
    if review.claimed_by == staff.member_id:
        return review

    repository.claim(db, review.id, staff.member_id)
    taken_over = {"takenOverFrom": str(review.claimed_by)} if review.claimed_by else {}
    _record(db, staff.member_id, "identity.review.claimed", review, ip, **taken_over)
    db.commit()
    return _reload(db, review.id)


def release(db: Session, staff: Staff, review_id: uuid.UUID, ip: str) -> StoredReview:
    """Give a claimed review back to the queue."""
    review = _load_for_reviewer(db, staff, review_id, ip, lock=True)
    if review.state != "in_review":
        raise ReviewConflict("not_open")
    if review.claimed_by != staff.member_id:
        raise ReviewConflict("not_claimed_by_you")
    repository.release(db, review.id)
    _record(db, staff.member_id, "identity.review.released", review, ip)
    db.commit()
    return _reload(db, review.id)


def _unviewed_documents(
    db: Session, reviewer_id: uuid.UUID, review: StoredReview, documents: list[identity_repository.StoredDocument]
) -> list[str]:
    """Required images this reviewer has not opened in their current version."""
    viewed = {
        (entry.details.get("kind"), entry.details.get("version"))
        for entry in audit.entries_about_member(db, action=VIEWED, member_id=review.member_id)
        if entry.actor_id == reviewer_id
    }
    current = {d.kind: d.version for d in documents}
    return [
        kind
        for kind in rules.REQUIRED_DOCUMENTS[review.route]  # type: ignore[index]
        if (kind, current.get(kind)) not in viewed
    ]


def decide(db: Session, staff: Staff, review_id: uuid.UUID, decision: DecisionInput, ip: str) -> StoredReview:
    """Record one of the three decisions (FR-WEB-008), immutably, with the evidence versions (BR-082).

    Only the reviewer holding the claim can decide; there is no bulk decision (FR-WEB-004).
    """
    review = _load_for_reviewer(db, staff, review_id, ip, lock=True)
    if review.state != "in_review":
        raise ReviewConflict("not_open")
    if review.claimed_by != staff.member_id:
        raise ReviewConflict("not_claimed_by_you")

    documents = identity_repository.current_documents(db, review.member_id)
    problems = rules.check_decision(
        decision=decision.decision,
        route=review.route,  # type: ignore[arg-type]
        checklist=decision.checklist,
        items=decision.items,
        reason_category=decision.reason_category,
        unviewed_documents=_unviewed_documents(db, staff.member_id, review, documents)
        if decision.decision == "approve"
        else [],
    )
    if problems:
        raise DecisionRefused(problems)

    tier = rules.reviewer_tier(staff.rule_assignments(), _area_path(review))
    assert tier is not None  # check_record_scope has confirmed members.verify over the area
    repository.insert_decision(
        db,
        review_id=review.id,
        decision=decision.decision,
        reviewer_id=staff.member_id,
        reviewer_tier=tier,
        checklist=sorted(decision.checklist),
        requested_items=decision.items,
        reason_category=decision.reason_category,
        note=decision.note,
        evidence={d.kind: {"id": str(d.id), "version": d.version} for d in documents},
    )
    repository.set_state_after_decision(db, review.id, rules.STATE_AFTER[decision.decision])

    if decision.decision == "approve":
        express_status = "identity_confirmed"
    elif decision.decision == "unable_to_verify":
        # Express has no refused state: the member returns to what was checked before review.
        express_status = "nic_format" if repository.has_nic_hash(db, review.member_id) else "unverified"
    else:
        express_status = None  # a correction keeps the member in review
    if express_status:
        repository.set_express_status(
            db, member_id=review.member_id, status=express_status, changed_by=staff.member_id, review_ref=review.review_ref
        )

    # The note to the member stays in the decision record; the audit entry holds codes only.
    _record(
        db,
        staff.member_id,
        "identity.review.decided",
        review,
        ip,
        decision=decision.decision,
        reasonCategory=decision.reason_category,
        requestedItems=decision.items,
    )
    db.commit()
    return _reload(db, review.id)
