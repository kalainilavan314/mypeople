"""Policy decision workflow with evidence-backed, auditable approvals."""

import uuid
from dataclasses import dataclass
from datetime import date
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.access.rules import PLATFORM
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.policy_decisions import repository, rules


class UnknownDecision(Exception):
    pass


class DecisionRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class DecisionView:
    definition: rules.DecisionDefinition
    revision: repository.Revision | None
    reviews: tuple[repository.Review, ...]

    @property
    def approved_roles(self) -> tuple[str, ...]:
        return tuple(review.role for review in self.reviews if review.outcome == "approve")

    @property
    def missing_roles(self) -> tuple[str, ...]:
        approved = set(self.approved_roles)
        return tuple(role for role in self.definition.required_roles if role not in approved)


def _definition(key: str) -> rules.DecisionDefinition:
    item = rules.definition(key)
    if item is None:
        raise UnknownDecision()
    return item


def _view(db: Session, definition: rules.DecisionDefinition, revision: repository.Revision | None) -> DecisionView:
    evidence = tuple(repository.reviews(db, revision.id)) if revision else ()
    return DecisionView(definition, revision, evidence)


def list_decisions(db: Session) -> list[DecisionView]:
    latest = repository.latest_revisions(db)
    return [_view(db, item, latest.get(item.key)) for item in rules.DECISIONS.values()]


def get_decision(db: Session, key: str) -> DecisionView:
    item = _definition(key)
    return next(view for view in list_decisions(db) if view.definition.key == item.key)


def create_revision(
    db: Session,
    staff: Staff,
    key: str,
    decision_text: str,
    rationale: str,
    effective_from: date | None,
    ip: str,
) -> DecisionView:
    item = _definition(key)
    repository.lock_key(db, key)
    current = repository.latest_revisions(db).get(key)
    if current and current.status in {"draft", "in_review"}:
        raise DecisionRefused("active_revision_exists")
    revision = repository.create_revision(
        db,
        decision_key=key,
        decision_text=decision_text,
        rationale=rationale,
        effective_from=effective_from,
        actor_id=staff.member_id,
    )
    audit.record(
        db,
        actor_id=staff.member_id,
        action="policy_decisions.revision_created",
        target_type="policy_decision",
        target_id=key,
        area_path=(PLATFORM,),
        details={"decisionKey": key, "revision": revision.revision},
        ip=ip,
    )
    db.commit()
    return _view(db, item, revision)


def update_draft(
    db: Session,
    staff: Staff,
    key: str,
    revision_id: uuid.UUID,
    decision_text: str,
    rationale: str,
    effective_from: date | None,
    ip: str,
) -> DecisionView:
    item = _definition(key)
    revision = repository.get_revision(db, revision_id, lock=True)
    if revision is None or revision.decision_key != key:
        raise UnknownDecision()
    if revision.status != "draft":
        raise DecisionRefused("revision_not_draft")
    revision = repository.update_draft(
        db,
        revision_id=revision_id,
        decision_text=decision_text,
        rationale=rationale,
        effective_from=effective_from,
        actor_id=staff.member_id,
    )
    audit.record(
        db,
        actor_id=staff.member_id,
        action="policy_decisions.draft_updated",
        target_type="policy_decision",
        target_id=key,
        area_path=(PLATFORM,),
        details={"decisionKey": key, "revision": revision.revision},
        ip=ip,
    )
    db.commit()
    return _view(db, item, revision)


def submit_revision(
    db: Session, staff: Staff, key: str, revision_id: uuid.UUID, reason: str, ip: str
) -> DecisionView:
    item = _definition(key)
    revision = repository.get_revision(db, revision_id, lock=True)
    if revision is None or revision.decision_key != key:
        raise UnknownDecision()
    if revision.status != "draft":
        raise DecisionRefused("revision_not_draft")
    if not revision.decision_text.strip() or not revision.rationale.strip():
        raise DecisionRefused("decision_content_incomplete")
    revision = repository.submit(db, revision_id, staff.member_id)
    audit.record(
        db,
        actor_id=staff.member_id,
        action="policy_decisions.submitted",
        target_type="policy_decision",
        target_id=key,
        area_path=(PLATFORM,),
        details={"decisionKey": key, "revision": revision.revision, "reasonLength": len(reason)},
        ip=ip,
    )
    db.commit()
    return _view(db, item, revision)


def record_review(
    db: Session,
    staff: Staff,
    key: str,
    revision_id: uuid.UUID,
    *,
    role: str,
    outcome: str,
    reviewer_name: str,
    reviewer_title: str,
    evidence_ref: str,
    comment: str,
    reviewed_at: date,
    ip: str,
) -> DecisionView:
    item = _definition(key)
    revision = repository.get_revision(db, revision_id, lock=True)
    if revision is None or revision.decision_key != key:
        raise UnknownDecision()
    if revision.status != "in_review":
        raise DecisionRefused("revision_not_in_review")
    if role not in item.required_roles:
        raise DecisionRefused("review_role_not_required")
    if reviewed_at > datetime_now_colombo():
        raise DecisionRefused("review_date_in_future")
    try:
        repository.add_review(
            db,
            revision_id=revision_id,
            role=role,
            outcome=outcome,
            reviewer_name=reviewer_name,
            reviewer_title=reviewer_title,
            evidence_ref=evidence_ref,
            comment=comment,
            reviewed_at=reviewed_at,
            actor_id=staff.member_id,
        )
    except IntegrityError as error:
        db.rollback()
        raise DecisionRefused("review_role_already_recorded") from error

    evidence = repository.reviews(db, revision_id)
    if outcome == "reject":
        repository.resolve(db, revision_id, "rejected", staff.member_id)
    elif set(item.required_roles) <= {review.role for review in evidence if review.outcome == "approve"}:
        repository.resolve(db, revision_id, "approved", staff.member_id)

    audit.record(
        db,
        actor_id=staff.member_id,
        action=f"policy_decisions.{outcome}",
        target_type="policy_decision",
        target_id=key,
        area_path=(PLATFORM,),
        details={"decisionKey": key, "revision": revision.revision, "role": role, "outcome": outcome},
        ip=ip,
    )
    db.commit()
    return get_decision(db, key)


def missing_feature_decisions(db: Session, feature_key: str) -> tuple[str, ...]:
    required = rules.required_for_feature(feature_key)
    approved = repository.approved_keys(db, required)
    return tuple(key for key in required if key not in approved)


def datetime_now_colombo() -> date:
    """The policy register records the signer's civil date in Sri Lanka."""
    from datetime import datetime

    return datetime.now(ZoneInfo("Asia/Colombo")).date()
