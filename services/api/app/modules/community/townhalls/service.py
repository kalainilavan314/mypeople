"""Ask the Leader / Live Town Hall (BRD M21 to M23, D18, FR-THL-001 to 009, BR-118 to 120).

Producers (townhall.produce) schedule sessions for an area; none may be scheduled or go live inside
an election silence window, and one in an election period needs a recorded legal review, checked
again when it goes live. Verified and Active members ask by text; moderators (townhall.moderate)
approve, merge or reject with a reason before anyone else sees a question; each such member votes
once per approved question while the session is upcoming or live, and only totals are shown. A
cancelled session is announced to everyone who asked for a reminder. After the session every
approved question is answered live (with the time in the recording) or in writing, and outcomes may
link to published promises or existing cases.

Not built: the video player's stream itself (OD-44, DEP-20 streaming provider), voice questions with
Tamil speech-to-text (AI-11, OD-42) and AI transcript summaries (AI-08).
"""

import uuid
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues import repository as issues_repository
from app.modules.community.issues import service as issues_service
from app.modules.community.promises import repository as promises_repository
from app.modules.community.townhalls import repository
from app.modules.community.townhalls.repository import Question, TownHall
from app.modules.election import repository as election_repository
from app.modules.election import service as election
from app.modules.messaging.notifications import service as notifications

PRODUCE = "townhall.produce"  # PRM-43
MODERATE = "townhall.moderate"  # PRM-44
QUESTIONS_PER_SESSION = 3  # [ASSUMPTION] per member, so one person cannot crowd the queue


class TownHallRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class TownHallNotFound(Exception):
    pass


def _path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(k) for k in keys)


# --- Members (M21 to M23) --------------------------------------------------------------------------------


def _member_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    return [a.key for a in access_repository.member_area_path(db, member_id)]


def sessions(db: Session, member_id: uuid.UUID) -> list[TownHall]:
    return repository.for_member(db, _member_keys(db, member_id))


@dataclass(frozen=True)
class SessionView:
    townhall: TownHall
    questions: list[Question]  # approved ones, and the member's own in any state
    reminded: bool


def view(db: Session, member_id: uuid.UUID, townhall_id: uuid.UUID, query: str | None = None) -> SessionView:
    found = repository.find(db, townhall_id)
    keys = _member_keys(db, member_id)
    if found is None or found.state in ("draft", "cancelled") or not (found.area_key == "platform" or found.area_key in keys):
        raise TownHallNotFound()
    shown = [q for q in repository.questions(db, townhall_id, member_id, query=query)
             if q.state == "approved" or q.member_id == member_id]
    found = replace(found, outcomes=[_member_outcome(db, member_id, outcome) for outcome in found.outcomes])
    return SessionView(found, shown, repository.reminded(db, townhall_id, member_id))


def _member_outcome(db: Session, member_id: uuid.UUID, outcome: dict[str, Any]) -> dict[str, Any]:
    """M23: an outcome links to its case only when this member may open the case (their own report,
    or a public one in their GN division); otherwise the case number is shown without a link."""
    case_id = None
    number = outcome.get("caseNumber")
    issue = issues_repository.find_by_number(db, number) if isinstance(number, str) and number else None
    if issue is not None:
        try:
            issues_service.detail(db, member_id, issue.id)
            case_id = str(issue.id)
        except issues_service.IssueNotFound:
            case_id = None
    return {**outcome, "caseId": case_id}


def _may_take_part(db: Session, member_id: uuid.UUID) -> None:
    """Asking and voting both need a Verified identity and an Active membership."""
    status = access_repository.find_member_status(db, member_id)
    if status is None or not (status.identity_verified and status.membership_active):
        raise TownHallRefused("membership_not_active")


def ask(db: Session, member_id: uuid.UUID, townhall_id: uuid.UUID, body: str, ip: str) -> Question:
    """FR-THL-003: shown to others only after moderation."""
    current = view(db, member_id, townhall_id)
    if current.townhall.state not in ("scheduled", "live"):
        raise TownHallRefused("session_closed")
    _may_take_part(db, member_id)
    if repository.count_member_questions(db, townhall_id, member_id) >= QUESTIONS_PER_SESSION:
        raise TownHallRefused("too_many_questions")
    question_id = repository.insert_question(db, townhall_id, member_id, body.strip())
    audit.record(db, actor_id=member_id, action="townhall.question.asked", target_type="townhall",
                 target_id=str(townhall_id), ip=ip)
    db.commit()
    found = repository.find_question(db, question_id, member_id)
    assert found is not None
    return found


def vote(db: Session, member_id: uuid.UUID, question_id: uuid.UUID) -> Question:
    """FR-THL-004: one vote per member per approved question, while the session is upcoming or live;
    a second vote is ignored."""
    question = repository.find_question(db, question_id, member_id)
    if question is None or question.state != "approved":
        raise TownHallNotFound()
    current = view(db, member_id, question.townhall_id)
    if current.townhall.state not in ("scheduled", "live"):
        raise TownHallRefused("session_closed")
    _may_take_part(db, member_id)
    if question.member_id == member_id:
        raise TownHallRefused("own_question")
    repository.vote(db, question_id, member_id)
    db.commit()
    found = repository.find_question(db, question_id, member_id)
    assert found is not None
    return found


def set_reminder(db: Session, member_id: uuid.UUID, townhall_id: uuid.UUID, on: bool) -> SessionView:
    view(db, member_id, townhall_id)
    repository.set_reminder(db, townhall_id, member_id, on)
    db.commit()
    return view(db, member_id, townhall_id)


# --- Producers and moderators (D18) ---------------------------------------------------------------------


def _require(db: Session, staff: Staff, permission: str, keys: list[str], ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), permission, _path(keys)):
        refuse(db, staff, permission, "outside_your_area", ip, target=("townhall", target), area_path=_path(keys))


def managed(db: Session, staff: Staff) -> list[TownHall]:
    keys: set[str] = set()
    for permission in (PRODUCE, MODERATE):
        areas = visible_areas(staff, permission)
        if areas is None:
            return repository.managed(db, None)
        keys.update(areas)
    if not keys:
        raise AccessRefused("forbidden")
    return repository.managed(db, sorted(keys))


def _check_schedule(db: Session, staff: Staff, keys: list[str], values: dict[str, Any], target: str, ip: str) -> None:
    if values["ends_at"] <= values["starts_at"]:
        raise TownHallRefused("ends_before_start")
    # FR-THL-008: never in a silence window; in an election period only with a recorded legal review.
    election.refuse_if_silent(db, staff, action="townhall.scheduled", target=("townhall", target), area_path=keys,
                              spans=[(values["starts_at"], values["ends_at"])], ip=ip)
    periods = election_repository.overlapping(db, keys, values["starts_at"], values["ends_at"])
    if periods and not (values.get("legal_review_ref") or "").strip():
        raise TownHallRefused("legal_review_required")


def create(db: Session, staff: Staff, values: dict[str, Any], area: Area, ip: str) -> TownHall:
    path = access_repository.area_path(db, area)
    if path is None:
        raise TownHallRefused("unknown_area")
    keys = [a.key for a in path]
    _require(db, staff, PRODUCE, keys, ip, "new")
    townhall_id = repository.insert(db, values, area.key, keys, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="townhall.drafted", target_type="townhall", target_id=str(townhall_id),
                 area_path=path, ip=ip)
    db.commit()
    found = repository.find(db, townhall_id)
    assert found is not None
    return found


def update(db: Session, staff: Staff, townhall_id: uuid.UUID, values: dict[str, Any], ip: str) -> TownHall:
    found = repository.find(db, townhall_id, lock=True)
    if found is None:
        raise TownHallNotFound()
    _require(db, staff, PRODUCE, found.area_path, ip, str(townhall_id))
    if found.state not in ("draft", "scheduled"):
        raise TownHallRefused(f"not_allowed_from:{found.state}")
    if found.state == "scheduled":
        _check_schedule(db, staff, found.area_path, {**values}, str(townhall_id), ip)
    repository.update(db, townhall_id, {k: values.get(k) for k in repository.FIELDS})
    audit.record(db, actor_id=staff.member_id, action="townhall.updated", target_type="townhall", target_id=str(townhall_id),
                 area_path=_path(found.area_path), ip=ip)
    db.commit()
    updated = repository.find(db, townhall_id)
    assert updated is not None
    return updated


MOVES = {"draft": {"scheduled", "cancelled"}, "scheduled": {"live", "cancelled"}, "live": {"ended"}}


def move(db: Session, staff: Staff, townhall_id: uuid.UUID, state: str, reason: str | None, ip: str) -> TownHall:
    found = repository.find(db, townhall_id, lock=True)
    if found is None:
        raise TownHallNotFound()
    _require(db, staff, PRODUCE, found.area_path, ip, str(townhall_id))
    if state not in MOVES.get(found.state, set()):
        raise TownHallRefused(f"not_allowed_from:{found.state}")
    values: dict[str, Any] = {"state": state}
    if state == "scheduled":
        _check_schedule(db, staff, found.area_path, {"starts_at": found.starts_at, "ends_at": found.ends_at,
                                                     "legal_review_ref": found.legal_review_ref}, str(townhall_id), ip)
    if state == "live":
        now = datetime.now(UTC)
        election.refuse_if_silent(db, staff, action="townhall.live", target=("townhall", str(townhall_id)),
                                  area_path=found.area_path, spans=[(now, found.ends_at)], ip=ip)
        # FR-THL-008: an election period may have been declared since the session was scheduled.
        periods = election_repository.overlapping(db, found.area_path, now, max(now, found.ends_at))
        if periods and not (found.legal_review_ref or "").strip():
            raise TownHallRefused("legal_review_required")
    if state == "cancelled":
        if not (reason and reason.strip()):
            raise TownHallRefused("reason_required")
        values["cancel_reason"] = reason.strip()
        for member_id in repository.reminder_members(db, townhall_id):
            notifications.notify(db, member_id, "townhall_cancelled", townhall_id)
    repository.update(db, townhall_id, values)
    audit.record(db, actor_id=staff.member_id, action=f"townhall.{state}", target_type="townhall", target_id=str(townhall_id),
                 area_path=_path(found.area_path), ip=ip)
    db.commit()
    moved = repository.find(db, townhall_id)
    assert moved is not None
    return moved


def staff_questions(db: Session, staff: Staff, townhall_id: uuid.UUID, ip: str) -> tuple[TownHall, list[Question]]:
    found = repository.find(db, townhall_id)
    if found is None:
        raise TownHallNotFound()
    if not any(access_rules.holds(staff.rule_assignments(), p, _path(found.area_path)) for p in (PRODUCE, MODERATE)):
        refuse(db, staff, MODERATE, "outside_your_area", ip, target=("townhall", str(townhall_id)), area_path=_path(found.area_path))
    return found, repository.questions(db, townhall_id, staff.member_id)


def moderate(db: Session, staff: Staff, question_id: uuid.UUID, decision: str, reason: str | None,
             merge_into: uuid.UUID | None, ip: str) -> Question:
    """FR-THL-005: approve, merge or reject with a reason; the author sees the reason."""
    question = repository.find_question(db, question_id, staff.member_id)
    if question is None:
        raise TownHallNotFound()
    found = repository.find(db, question.townhall_id)
    assert found is not None
    _require(db, staff, MODERATE, found.area_path, ip, str(found.id))
    if question.member_id == staff.member_id:
        refuse(db, staff, MODERATE, "own_record", ip, target=("townhall", str(found.id)), area_path=_path(found.area_path))
    if question.state != "pending":
        raise TownHallRefused("already_moderated")
    values: dict[str, Any] = {"state": {"approve": "approved", "reject": "rejected", "merge": "merged"}[decision],
                              "moderated_by": staff.member_id}
    if decision in ("reject", "merge"):
        if not (reason and reason.strip()):
            raise TownHallRefused("reason_required")
        values["moderation_reason"] = reason.strip()
    if decision == "merge":
        target = repository.find_question(db, merge_into, staff.member_id) if merge_into else None
        if target is None or target.townhall_id != question.townhall_id or target.state != "approved":
            raise TownHallRefused("merge_target_not_approved")
        values["merged_into_id"] = target.id
    repository.update_question(db, question_id, values)
    if decision != "approve":
        notifications.notify(db, question.member_id, "townhall_question_not_shown", found.id)
    audit.record(db, actor_id=staff.member_id, action=f"townhall.question.{values['state']}", target_type="townhall",
                 target_id=str(found.id), area_path=_path(found.area_path), ip=ip)
    db.commit()
    moderated = repository.find_question(db, question_id, staff.member_id)
    assert moderated is not None
    return moderated


def answer(db: Session, staff: Staff, question_id: uuid.UUID, mode: str, at_second: int | None, answer_en: str | None,
           answer_ta: str | None, ip: str) -> Question:
    """FR-THL-006: answered live (with the time in the recording) or in writing afterwards."""
    question = repository.find_question(db, question_id, staff.member_id)
    if question is None:
        raise TownHallNotFound()
    found = repository.find(db, question.townhall_id)
    assert found is not None
    _require(db, staff, PRODUCE, found.area_path, ip, str(found.id))
    if question.state != "approved":
        raise TownHallRefused("question_not_approved")
    if mode == "live" and at_second is None:
        raise TownHallRefused("time_required")
    if mode == "written" and not ((answer_en or "").strip() and (answer_ta or "").strip()):
        raise TownHallRefused("bilingual_answer_required")
    repository.update_question(db, question_id, {
        "answer_mode": mode, "answered_at_second": at_second if mode == "live" else None,
        "answer_en": (answer_en or "").strip() or None, "answer_ta": (answer_ta or "").strip() or None,
        "answered_at": datetime.now(UTC),
    })
    notifications.notify(db, question.member_id, "townhall_question_answered", found.id)
    audit.record(db, actor_id=staff.member_id, action="townhall.question.answered", target_type="townhall",
                 target_id=str(found.id), area_path=_path(found.area_path), details={"mode": mode}, ip=ip)
    db.commit()
    answered = repository.find_question(db, question_id, staff.member_id)
    assert answered is not None
    return answered


def archive(db: Session, staff: Staff, townhall_id: uuid.UUID, values: dict[str, Any], ip: str) -> TownHall:
    """FR-THL-007, 009: recording, Tamil and English transcripts, and outcomes linked to promises or cases."""
    found = repository.find(db, townhall_id, lock=True)
    if found is None:
        raise TownHallNotFound()
    _require(db, staff, PRODUCE, found.area_path, ip, str(townhall_id))
    if found.state != "ended":
        raise TownHallRefused(f"not_allowed_from:{found.state}")
    problems = _outcome_problems(db, values.get("outcomes") or [])
    if problems:
        raise TownHallRefused(problems)
    repository.update(db, townhall_id, values)
    audit.record(db, actor_id=staff.member_id, action="townhall.archived", target_type="townhall", target_id=str(townhall_id),
                 area_path=_path(found.area_path), ip=ip)
    db.commit()
    archived = repository.find(db, townhall_id)
    assert archived is not None
    return archived


def _outcome_problems(db: Session, outcomes: list[dict[str, Any]]) -> list[str]:
    """M23: an outcome links only to a published promise or an existing case; numbered from 1."""
    problems = []
    for position, outcome in enumerate(outcomes, start=1):
        promise_id = outcome.get("promiseId")
        if promise_id:
            promise = promises_repository.find(db, uuid.UUID(str(promise_id)))
            if promise is None or promise.publication != "published":
                problems.append(f"outcome_promise_not_published:{position}")
        number = outcome.get("caseNumber")
        if number and issues_repository.find_by_number(db, str(number)) is None:
            problems.append(f"outcome_case_not_found:{position}")
    return problems


def remind(db: Session, now: datetime) -> int:
    """Run by the notifications task: members who asked are told 24 hours and 15 minutes before."""
    sent = 0
    for column, window, key in (("reminded_day_at", 24 * 3600, "townhall_tomorrow"), ("reminded_soon_at", 15 * 60, "townhall_soon")):
        for townhall_id, members in repository.due_reminders(db, column, window, now):
            for member_id in members:
                notifications.notify(db, member_id, key, townhall_id)
                sent += 1
            repository.update(db, townhall_id, {column: now})
    db.commit()
    return sent
