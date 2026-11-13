"""Promise Tracker (BRD M18, M19, D16, FR-PRM-001 to 010).

Every public promise with its source, responsible office, measurable target, due date and status,
labelled a party commitment or a government responsibility (BR-113). The Promise Office drafts;
a second authorised person approves publication and each status change. Updates and corrections
are never overwritten. A published promise past its due date becomes Delayed and the office is
asked for an update within 10 working days; when none is approved in time, the publishers over the
promise's area are told once. Members read every published promise and may leave moderated
feedback; the office replies.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE, add_working_days
from app.modules.community.promises import repository, rules
from app.modules.community.promises.repository import Feedback, Milestone, Promise, Update
from app.modules.messaging.notifications import service as notifications

MODERATE = "content.moderate"


class PromiseRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class PromiseNotFound(Exception):
    pass


def _path(promise: Promise) -> AreaPath:
    return tuple(area_from_key(key) for key in promise.area_path)


@dataclass(frozen=True)
class PromiseView:
    promise: Promise
    milestones: list[Milestone]
    updates: list[Update]
    feedback: list[Feedback]


# --- Members (M18, M19) ----------------------------------------------------------------------------------


def published(db: Session, status: str | None, theme: str | None, area_key: str | None) -> list[Promise]:
    return repository.search(db, published_only=True, areas=None, status=status, theme=theme, area_key=area_key)


def public_view(db: Session, promise_id: uuid.UUID) -> PromiseView:
    promise = repository.find(db, promise_id)
    if promise is None or promise.publication != "published":
        raise PromiseNotFound()
    shown = [u for u in repository.updates(db, promise_id) if u.decision in ("approved", "system")]
    return PromiseView(promise, repository.milestones(db, promise_id), shown,
                       repository.feedback(db, promise_id, published_only=True))


def give_feedback(db: Session, member_id: uuid.UUID, promise_id: uuid.UUID, body: str, ip: str) -> Feedback:
    public_view(db, promise_id)
    status = access_repository.find_member_status(db, member_id)
    if status is None or not (status.identity_verified and status.membership_active):
        raise PromiseRefused("membership_not_active")
    feedback_id = repository.insert_feedback(db, promise_id, member_id, body.strip())
    audit.record(db, actor_id=member_id, action="promise.feedback.given", target_type="promise", target_id=str(promise_id), ip=ip)
    db.commit()
    found = repository.find_feedback(db, feedback_id)
    assert found is not None
    return found


# --- Promise Office (D16) --------------------------------------------------------------------------------


def _require(db: Session, staff: Staff, permission: str, path: AreaPath, ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), permission, path):
        refuse(db, staff, permission, "outside_your_area", ip, target=("promise", target), area_path=path)


def _today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()


def _staff_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in (rules.EDIT, rules.PUBLISH, MODERATE):
        areas = visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


def managed(db: Session, staff: Staff, status: str | None, theme: str | None) -> list[Promise]:
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in (rules.EDIT, rules.PUBLISH, MODERATE)):
        raise AccessRefused("forbidden")
    return repository.search(db, published_only=False, areas=_staff_areas(staff), status=status, theme=theme, area_key=None)


def staff_view(db: Session, staff: Staff, promise_id: uuid.UUID) -> PromiseView:
    promise = repository.find(db, promise_id)
    if promise is None or not any(
        access_rules.holds(staff.rule_assignments(), p, _path(promise)) for p in (rules.EDIT, rules.PUBLISH, MODERATE)
    ):
        raise PromiseNotFound()
    return PromiseView(promise, repository.milestones(db, promise_id), repository.updates(db, promise_id),
                       repository.feedback(db, promise_id, published_only=False))


def save_draft(db: Session, staff: Staff, promise_id: uuid.UUID | None, values: dict[str, Any], area: Area | None,
               milestones: list[dict[str, Any]], ip: str) -> Promise:
    if promise_id is None:
        assert area is not None
        path = access_repository.area_path(db, area)
        if path is None:
            raise PromiseRefused("unknown_area")
        _require(db, staff, rules.EDIT, path, ip, "new")
        if values["due_date"] < values["planned_start"]:
            raise PromiseRefused("due_before_start")
        promise_id = repository.insert(db, values, area.key, [a.key for a in path], staff.member_id)
        action = "promise.drafted"
    else:
        promise = repository.find(db, promise_id, lock=True)
        if promise is None:
            raise PromiseNotFound()
        _require(db, staff, rules.EDIT, _path(promise), ip, str(promise_id))
        if promise.publication == "published":
            raise PromiseRefused("published_promises_change_by_update")
        if values["due_date"] < values["planned_start"]:
            raise PromiseRefused("due_before_start")
        repository.update(db, promise_id, {**{k: values.get(k) for k in repository.FIELDS}, "publication": "draft",
                                           "publication_requested_by": None})
        action = "promise.draft_updated"
    repository.replace_milestones(db, promise_id, milestones)
    audit.record(db, actor_id=staff.member_id, action=action, target_type="promise", target_id=str(promise_id), ip=ip)
    db.commit()
    found = repository.find(db, promise_id)
    assert found is not None
    return found


def request_publication(db: Session, staff: Staff, promise_id: uuid.UUID, ip: str) -> Promise:
    promise = repository.find(db, promise_id, lock=True)
    if promise is None:
        raise PromiseNotFound()
    _require(db, staff, rules.EDIT, _path(promise), ip, str(promise_id))
    if promise.publication != "draft":
        raise PromiseRefused(f"not_allowed_from:{promise.publication}")
    problems = rules.check_publishable(milestones=len(repository.milestones(db, promise_id)),
                                       planned_start=promise.planned_start, due_date=promise.due_date)
    if problems:
        raise PromiseRefused(problems)
    repository.update(db, promise_id, {"publication": "awaiting_approval", "publication_requested_by": staff.member_id})
    for holder in repository.holders(db, rules.PUBLISH, promise.area_path):
        if holder != staff.member_id:
            notifications.notify(db, holder, "promise_approval_needed", promise_id)
    audit.record(db, actor_id=staff.member_id, action="promise.publication_requested", target_type="promise",
                 target_id=str(promise_id), area_path=_path(promise), ip=ip)
    db.commit()
    found = repository.find(db, promise_id)
    assert found is not None
    return found


def decide_publication(db: Session, staff: Staff, promise_id: uuid.UUID, approve: bool, reason: str | None, ip: str) -> Promise:
    """FR-PRM-003: a second authorised person approves; the drafter cannot."""
    promise = repository.find(db, promise_id, lock=True)
    if promise is None:
        raise PromiseNotFound()
    _require(db, staff, rules.PUBLISH, _path(promise), ip, str(promise_id))
    if promise.publication != "awaiting_approval":
        raise PromiseRefused(f"not_allowed_from:{promise.publication}")
    if rules.check_second_person(promise.drafted_by, staff.member_id, promise.publication_requested_by):
        refuse(db, staff, rules.PUBLISH, "own_draft", ip, target=("promise", str(promise_id)), area_path=_path(promise))
    if approve:
        now = datetime.now(UTC)
        repository.update(db, promise_id, {"publication": "published", "published_by": staff.member_id, "published_at": now,
                                           "last_verified_at": now})
    else:
        if not (reason and reason.strip()):
            raise PromiseRefused("reason_required")
        repository.update(db, promise_id, {"publication": "draft", "publication_requested_by": None})
    notifications.complete_action(db, "promise", promise_id)
    audit.record(db, actor_id=staff.member_id, action="promise.published" if approve else "promise.publication_returned",
                 target_type="promise", target_id=str(promise_id), area_path=_path(promise),
                 details={"reason": reason} if reason else None, ip=ip)
    db.commit()
    found = repository.find(db, promise_id)
    assert found is not None
    return found


def draft_update(db: Session, staff: Staff, promise_id: uuid.UUID, *, new_status: str | None, note_en: str, note_ta: str,
                 evidence_refs: list[str], corrects_id: uuid.UUID | None, ip: str) -> Update:
    promise = repository.find(db, promise_id, lock=True)
    if promise is None:
        raise PromiseNotFound()
    _require(db, staff, rules.EDIT, _path(promise), ip, str(promise_id))
    if promise.publication != "published":
        raise PromiseRefused("not_published")
    problems = rules.check_update(current=promise.status, new_status=new_status, evidence_refs=evidence_refs, note=note_en,
                                  note_ta=note_ta, overdue=rules.past_due(promise.due_date, _today()))
    if corrects_id is not None:
        corrected = repository.find_update(db, corrects_id)
        if corrected is None or corrected.promise_id != promise_id:
            problems.append("corrected_update_not_found")
    if problems:
        raise PromiseRefused(problems)
    update_id = repository.insert_update(
        db, promise_id, new_status=new_status, note_en=note_en.strip(), note_ta=note_ta.strip(),
        evidence_refs=[r.strip() for r in evidence_refs if r.strip()], corrects_id=corrects_id, drafted_by=staff.member_id,
    )
    for holder in repository.holders(db, rules.PUBLISH, promise.area_path):
        if holder != staff.member_id:
            notifications.notify(db, holder, "promise_approval_needed", promise_id)
    audit.record(db, actor_id=staff.member_id, action="promise.update_drafted", target_type="promise",
                 target_id=str(promise_id), area_path=_path(promise), details={"newStatus": new_status}, ip=ip)
    db.commit()
    found = repository.find_update(db, update_id)
    assert found is not None
    return found


def decide_update(db: Session, staff: Staff, update_id: uuid.UUID, approve: bool, reason: str | None, ip: str) -> Update:
    update = repository.find_update(db, update_id)
    if update is None:
        raise PromiseNotFound()
    promise = repository.find(db, update.promise_id, lock=True)
    assert promise is not None
    _require(db, staff, rules.PUBLISH, _path(promise), ip, str(promise.id))
    if update.decision != "pending":
        raise PromiseRefused("already_decided")
    if rules.check_second_person(update.drafted_by, staff.member_id):
        refuse(db, staff, rules.PUBLISH, "own_draft", ip, target=("promise", str(promise.id)), area_path=_path(promise))
    if not approve and not (reason and reason.strip()):
        raise PromiseRefused("reason_required")
    if approve:
        # Re-checked at approval, in case the promise moved on (or its due date passed) since the draft.
        problems = rules.check_update(current=promise.status, new_status=update.new_status,
                                      evidence_refs=update.evidence_refs, note=update.note_en, note_ta=update.note_ta,
                                      overdue=rules.past_due(promise.due_date, _today()))
        if problems:
            raise PromiseRefused(problems)
        values: dict[str, Any] = {"last_verified_at": datetime.now(UTC), "update_due_at": None,
                                  "update_missed_alerted_at": None}
        if update.new_status:
            with_reason = update.new_status in ("withdrawn", "blocked")
            values["status"] = update.new_status
            values["status_reason"] = update.note_en if with_reason else None
            values["status_reason_ta"] = update.note_ta if with_reason else None
        repository.update(db, promise.id, values)
    repository.decide_update(db, update.id, approve, staff.member_id, reason.strip() if reason else None)
    notifications.complete_action(db, "promise", promise.id)
    audit.record(db, actor_id=staff.member_id, action="promise.update_approved" if approve else "promise.update_rejected",
                 target_type="promise", target_id=str(promise.id), area_path=_path(promise), ip=ip)
    db.commit()
    found = repository.find_update(db, update.id)
    assert found is not None
    return found


@dataclass(frozen=True)
class PendingWork:
    publications: list[Promise]  # promises waiting for a second person to approve publication (D16)
    updates: list[Update]
    feedback: list[Feedback]


def pending_work(db: Session, staff: Staff) -> PendingWork:
    areas = _staff_areas(staff)
    publisher = access_rules.holds(staff.rule_assignments(), rules.PUBLISH)
    return PendingWork(
        publications=repository.awaiting_publication(db, areas) if publisher else [],
        updates=repository.pending_updates(db, areas) if publisher else [],
        feedback=repository.pending_feedback(db, areas) if access_rules.holds(staff.rule_assignments(), MODERATE) else [],
    )


def moderate_feedback(db: Session, staff: Staff, feedback_id: uuid.UUID, publish: bool, reason: str | None, ip: str) -> Feedback:
    item = repository.find_feedback(db, feedback_id)
    if item is None:
        raise PromiseNotFound()
    promise = repository.find(db, item.promise_id)
    assert promise is not None
    _require(db, staff, MODERATE, _path(promise), ip, str(promise.id))
    if item.state != "pending":
        raise PromiseRefused("already_moderated")
    if not publish and not (reason and reason.strip()):
        raise PromiseRefused("reason_required")
    repository.set_feedback(db, feedback_id, {"state": "published" if publish else "rejected",
                                              "moderation_reason": reason.strip() if reason else None,
                                              "moderated_by": staff.member_id})
    if not publish:
        notifications.notify(db, item.member_id, "promise_feedback_rejected", promise.id)
    audit.record(db, actor_id=staff.member_id, action="promise.feedback.moderated", target_type="promise",
                 target_id=str(promise.id), area_path=_path(promise), details={"published": publish}, ip=ip)
    db.commit()
    found = repository.find_feedback(db, feedback_id)
    assert found is not None
    return found


def reply_to_feedback(db: Session, staff: Staff, feedback_id: uuid.UUID, reply_en: str, reply_ta: str, ip: str) -> Feedback:
    item = repository.find_feedback(db, feedback_id)
    if item is None:
        raise PromiseNotFound()
    promise = repository.find(db, item.promise_id)
    assert promise is not None
    _require(db, staff, rules.EDIT, _path(promise), ip, str(promise.id))
    if item.state != "published":
        raise PromiseRefused("feedback_not_published")
    repository.set_feedback(db, feedback_id, {"reply_en": reply_en.strip(), "reply_ta": reply_ta.strip(),
                                              "replied_by": staff.member_id, "replied_at": datetime.now(UTC)})
    notifications.notify(db, item.member_id, "promise_feedback_answered", promise.id)
    audit.record(db, actor_id=staff.member_id, action="promise.feedback.replied", target_type="promise",
                 target_id=str(promise.id), area_path=_path(promise), ip=ip)
    db.commit()
    found = repository.find_feedback(db, feedback_id)
    assert found is not None
    return found


def report(db: Session, staff: Staff) -> list[tuple[str, str, str, str, int]]:
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in (rules.EDIT, rules.PUBLISH)):
        raise AccessRefused("forbidden")
    return repository.report(db, _staff_areas(staff))


def mark_delayed(db: Session, now: datetime) -> int:
    """FR-PRM-009: run by the notifications task. Past the due date, a published promise that is not
    finished becomes Delayed; the Promise Office is asked for an update within 10 working days."""
    today = _today(now)
    count = 0
    for promise in repository.overdue(db, today):
        due = add_working_days(now, rules.UPDATE_WITHIN_WORKING_DAYS)
        repository.update(db, promise.id, {"status": "delayed", "update_due_at": due, "update_missed_alerted_at": None})
        repository.insert_update(
            db, promise.id, new_status="delayed",
            note_en=f"The due date {promise.due_date.isoformat()} passed before completion.",
            note_ta=f"நிறைவடைவதற்கு முன் இறுதித் திகதி {promise.due_date.isoformat()} கடந்துவிட்டது.",
            evidence_refs=[], corrects_id=None, drafted_by=None,
        )
        for holder in repository.holders(db, rules.EDIT, promise.area_path):
            notifications.notify(db, holder, "promise_update_due", promise.id)
        count += 1
    db.commit()
    return count


def escalate_missed_updates(db: Session, now: datetime) -> int:
    """Run by the notifications task: a Delayed promise whose 10 working days passed without an
    approved update is raised once with the publishers over its area."""
    count = 0
    for promise in repository.missed_updates(db, now):
        for holder in repository.holders(db, rules.PUBLISH, promise.area_path):
            notifications.notify(db, holder, "promise_update_missed", promise.id)
        repository.update(db, promise.id, {"update_missed_alerted_at": now})
        audit.record(db, actor_id=None, action="promise.update_missed", target_type="promise", target_id=str(promise.id),
                     area_path=_path(promise))
        count += 1
    db.commit()
    return count
