"""Surveys (BRD H14, H21, FR-SRV-001 to 006, BR-045, BR-046, BR-090).

A survey reaches the members of its target area, who answer once (or edit, when the survey allows
it). A survey claims anonymity only when it is stored anonymously: then nothing links the answers
to the member, and editing is impossible. Results are counts in which any group of 1 to 9 is
hidden. Survey managers hold surveys.manage over the survey's area.
"""

import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, area_from_key
from app.modules.access.service import Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.surveys import repository, rules
from app.modules.community.surveys.repository import Participation, Survey


class SurveyRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class SurveyNotFound(Exception):
    pass


@dataclass(frozen=True)
class SurveyView:
    survey: Survey
    questions: list[dict[str, Any]]
    receipt: Participation | None
    my_answers: dict[str, Any] | None
    can_answer: bool


def _member_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    return [a.key for a in access_repository.member_area_path(db, member_id)]


def open_surveys(db: Session, member_id: uuid.UUID) -> list[tuple[Survey, Participation | None]]:
    return [(s, repository.participation(db, s.id, member_id)) for s in repository.open_for(db, _member_keys(db, member_id))]


def view(db: Session, member_id: uuid.UUID, survey_id: uuid.UUID) -> SurveyView:
    survey = repository.find(db, survey_id)
    receipt = repository.participation(db, survey_id, member_id) if survey else None
    in_area = survey is not None and (survey.area_key == "platform" or survey.area_key in _member_keys(db, member_id))
    if survey is None or survey.state == "draft" or (not in_area and receipt is None):
        raise SurveyNotFound()
    still_open = survey.state == "open"
    return SurveyView(
        survey=survey,
        questions=repository.questions(db, survey_id),
        receipt=receipt,
        my_answers=repository.own_answers(db, survey_id, member_id) if receipt and not survey.anonymous else None,
        # FR-SRV-005: one response, unless the survey allows edits; the receipt shows instead of the form.
        can_answer=still_open and in_area and (receipt is None or survey.allow_edits),
    )


def respond(db: Session, member_id: uuid.UUID, survey_id: uuid.UUID, answers: dict[str, Any], ip: str) -> SurveyView:
    current = view(db, member_id, survey_id)
    if not current.can_answer:
        raise SurveyRefused("already_answered" if current.receipt else "survey_closed")
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    if not status.identity_verified:
        raise SurveyRefused("identity_not_verified")
    problems = rules.check_answers(current.questions, answers)
    if problems:
        raise SurveyRefused(problems)
    cleaned = {key: value.strip() if isinstance(value, str) else value for key, value in answers.items()}
    if current.receipt is not None:
        repository.replace_response(db, survey_id, member_id, cleaned)
    elif not repository.record_participation(db, survey_id, member_id):
        db.rollback()
        raise SurveyRefused("already_answered")  # a second send that raced the first
    elif not current.survey.anonymous:
        repository.record_answers(db, survey_id, member_id, cleaned)
    # The audit entry records that the member took part, never what they answered.
    audit.record(db, actor_id=member_id, action="survey.responded", target_type="survey", target_id=str(survey_id), ip=ip)
    db.commit()
    if current.receipt is None and current.survey.anonymous:
        _record_anonymous_answers(db, survey_id, member_id, cleaned, ip)
    return view(db, member_id, survey_id)


def _record_anonymous_answers(db: Session, survey_id: uuid.UUID, member_id: uuid.UUID, answers: dict[str, Any],
                              ip: str) -> None:
    """FR-SRV-003: an anonymous survey's answers are written in their own transaction, after the
    participation row is committed. Rows written in one transaction share its id (xmin), which
    would let anyone with database access tie the answers back to the member.

    If the answers cannot be saved, the participation is taken back, so the member is never left
    marked as answered with no answer, and may send again."""
    try:
        repository.record_answers(db, survey_id, None, answers)
        db.commit()
    except Exception:
        db.rollback()
        repository.remove_participation(db, survey_id, member_id)
        audit.record(db, actor_id=member_id, action="survey.response_undone", target_type="survey",
                     target_id=str(survey_id), ip=ip)
        db.commit()
        raise


# --- Managers ------------------------------------------------------------------------------------------


def _require(db: Session, staff: Staff, area_path: list[str], ip: str, target: str) -> None:
    path = tuple(area_from_key(key) for key in area_path)
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION, path):
        refuse(db, staff, rules.PERMISSION, "outside_your_area", ip, target=("survey", target), area_path=path)


def managed(db: Session, staff: Staff) -> list[Survey]:
    return repository.managed(db, visible_areas(staff, rules.PERMISSION), 100)


def _clean_questions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{**item, "options": [dict(option) for option in item.get("options", [])]} for item in items]


def create(db: Session, staff: Staff, values: dict[str, Any], questions: list[dict[str, Any]], area: Area, ip: str) -> Survey:
    path = access_repository.area_path(db, area)
    if path is None:
        raise SurveyRefused("unknown_area")
    keys = [a.key for a in path]
    _require(db, staff, keys, ip, "new")
    if values["anonymous"] and values["allow_edits"]:
        raise SurveyRefused("anonymous_surveys_cannot_be_edited")
    survey_id = repository.insert(db, values, area.key, keys, staff.member_id)
    repository.replace_questions(db, survey_id, _clean_questions(questions))
    audit.record(db, actor_id=staff.member_id, action="survey.created", target_type="survey", target_id=str(survey_id),
                 area_path=path, ip=ip)
    db.commit()
    found = repository.find(db, survey_id)
    assert found is not None
    return found


def managed_survey(db: Session, staff: Staff, survey_id: uuid.UUID, ip: str) -> tuple[Survey, list[dict[str, Any]]]:
    """The survey with every text and question, for its editor."""
    survey = repository.find(db, survey_id)
    if survey is None:
        raise SurveyNotFound()
    _require(db, staff, survey.area_path, ip, str(survey_id))
    return survey, repository.questions(db, survey_id)


def update_draft(db: Session, staff: Staff, survey_id: uuid.UUID, values: dict[str, Any], questions: list[dict[str, Any]],
                 ip: str) -> Survey:
    survey = repository.find(db, survey_id, lock=True)
    if survey is None:
        raise SurveyNotFound()
    _require(db, staff, survey.area_path, ip, str(survey_id))
    if survey.state != "draft":
        raise SurveyRefused("only_drafts_change")
    if values["anonymous"] and values["allow_edits"]:
        raise SurveyRefused("anonymous_surveys_cannot_be_edited")
    repository.update(db, survey_id, values)
    repository.replace_questions(db, survey_id, _clean_questions(questions))
    audit.record(db, actor_id=staff.member_id, action="survey.updated", target_type="survey", target_id=str(survey_id), ip=ip)
    db.commit()
    found = repository.find(db, survey_id)
    assert found is not None
    return found


def move(db: Session, staff: Staff, survey_id: uuid.UUID, state: str, ip: str) -> Survey:
    survey = repository.find(db, survey_id, lock=True)
    if survey is None:
        raise SurveyNotFound()
    _require(db, staff, survey.area_path, ip, str(survey_id))
    allowed = {"draft": {"open"}, "open": {"closed"}, "closed": set()}
    if state not in allowed[survey.state]:
        raise SurveyRefused(f"not_allowed_from:{survey.state}")
    if state == "open":
        problems = rules.check_questions(repository.questions(db, survey_id))
        if problems:
            raise SurveyRefused(problems)
    repository.update(db, survey_id, {"state": state})
    audit.record(db, actor_id=staff.member_id, action=f"survey.{state}", target_type="survey", target_id=str(survey_id), ip=ip)
    db.commit()
    found = repository.find(db, survey_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class QuestionResult:
    question: dict[str, Any]
    counts: dict[str, int | None]  # option key (or scale value) to count; None means 1 to 9
    answered: int | None


@dataclass(frozen=True)
class Results:
    survey: Survey
    responses: int | None
    questions: list[QuestionResult]


def results(db: Session, staff: Staff, survey_id: uuid.UUID, ip: str) -> Results:
    """Counts only, with small groups hidden; free-text answers are counted, never shown here."""
    survey = repository.find(db, survey_id)
    if survey is None:
        raise SurveyNotFound()
    _require(db, staff, survey.area_path, ip, str(survey_id))
    answers = repository.all_answers(db, survey_id)
    out = []
    for question in repository.questions(db, survey_id):
        key = str(question["id"])
        tally: Counter[str] = Counter()
        answered = 0
        for answer in answers:
            value = answer.get(key)
            if value in (None, "", []):
                continue
            answered += 1
            for item in value if isinstance(value, list) else [value]:
                tally["text" if question["kind"] == "text" and item != rules.PREFER_NOT_TO_SAY else str(item)] += 1
        out.append(QuestionResult(question, {k: rules.hide_small(v) for k, v in tally.items()}, rules.hide_small(answered)))
    audit.record(db, actor_id=staff.member_id, action="survey.results.viewed", target_type="survey",
                 target_id=str(survey_id), ip=ip)
    db.commit()
    return Results(survey=survey, responses=rules.hide_small(len(answers)), questions=out)
