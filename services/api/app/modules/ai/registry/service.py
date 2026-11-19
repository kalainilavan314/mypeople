"""AI model registry and monitoring (BRD D21, NFR-AI-01, NFR-AI-05, NFR-AI-07, 15B.5, PRM-30, PRM-31).

The AI Governance Lead registers each model (in shadow mode), records its evaluations and fairness
reviews, makes it live when every check passes, and retires or rolls it back. Monitoring reads the
inference log and the members' ratings and error reports as counts only. Both permissions are
platform-wide (Tier 5), so there is no area to check.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM
from app.modules.access.service import Staff, refuse
from app.modules.ai.registry import repository, rules
from app.modules.ai.registry.repository import Evaluation, FairnessReview, Feedback, Model, Usage
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE


class ModelRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class ModelNotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _require(db: Session, staff: Staff, permissions: tuple[str, ...], ip: str, target: str) -> None:
    if not any(access_rules.holds(staff.rule_assignments(), permission) for permission in permissions):
        refuse(db, staff, "/".join(permissions), "forbidden", ip, target=("ai_model", target), area_path=(PLATFORM,))


GOVERN = (rules.MONITOR, rules.APPROVE)


def _found(db: Session, model_id: uuid.UUID, *, lock: bool = False) -> Model:
    model = repository.find(db, model_id, lock=lock)
    if model is None:
        raise ModelNotFound()
    return model


def _latest_evaluation(evaluations: list[Evaluation]) -> rules.LatestEvaluation | None:
    if not evaluations:
        return None
    return rules.LatestEvaluation(evaluations[0].evaluated_on, evaluations[0].passed)


@dataclass(frozen=True)
class ModelSummary:
    model: Model
    latest_evaluation: Evaluation | None
    latest_fairness: FairnessReview | None
    usage_30_days: Usage
    go_live_problems: list[str]


@dataclass(frozen=True)
class ModelFile:
    summary: ModelSummary
    evaluations: list[Evaluation]
    fairness_reviews: list[FairnessReview]
    usage_7_days: Usage
    feedback_30_days: Feedback


def _go_live_problems(model: Model, evaluations: list[Evaluation], fairness: list[FairnessReview]) -> list[str]:
    now = _now()
    return rules.check_go_live(
        status=model.status, was_live=model.live_at is not None, licence_commercial_use=model.licence_commercial_use,
        provider_code=model.provider_code, no_training_terms=model.no_training_terms,
        shadow_started_at=model.shadow_started_at, evaluation=_latest_evaluation(evaluations),
        fairness=fairness[0].outcome if fairness else None, now=now, today=now.astimezone(LOCAL_ZONE).date(),
    )


def _summary(db: Session, model: Model) -> tuple[ModelSummary, list[Evaluation], list[FairnessReview]]:
    evaluations = repository.evaluations(db, model.id)
    fairness = repository.fairness_reviews(db, model.id)
    summary = ModelSummary(
        model=model,
        latest_evaluation=evaluations[0] if evaluations else None,
        latest_fairness=fairness[0] if fairness else None,
        usage_30_days=repository.usage(db, model.id, _now() - timedelta(days=30)),
        go_live_problems=_go_live_problems(model, evaluations, fairness),
    )
    return summary, evaluations, fairness


def models(db: Session, staff: Staff) -> list[ModelSummary]:
    return [_summary(db, model)[0] for model in repository.all_models(db)]


def model_file(db: Session, staff: Staff, model_id: uuid.UUID) -> ModelFile:
    model = _found(db, model_id)
    summary, evaluations, fairness = _summary(db, model)
    since_7 = _now() - timedelta(days=7)
    return ModelFile(
        summary=summary, evaluations=evaluations, fairness_reviews=fairness,
        usage_7_days=repository.usage(db, model.id, since_7),
        feedback_30_days=repository.feedback(db, model.id, _now() - timedelta(days=30)),
    )


def register(db: Session, staff: Staff, values: dict[str, Any], ip: str) -> Model:
    """A new entry starts in shadow mode: it runs without being shown to members (15B.5)."""
    _require(db, staff, GOVERN, ip, "new")
    if repository.exists(db, values["task"], values["provider_code"], values["model_ref"], values["version"]):
        raise ModelRefused("already_registered")
    model_id = repository.insert(db, values, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="ai.model.registered", target_type="ai_model", target_id=str(model_id),
                 area_path=(PLATFORM,), details={"task": values["task"], "provider": values["provider_code"]}, ip=ip)
    db.commit()
    return _found(db, model_id)


def record_evaluation(db: Session, staff: Staff, model_id: uuid.UUID, values: dict[str, Any], stated_pass: bool | None,
                      ip: str) -> Evaluation:
    """The assistant's result is worked out from the NFR-AI-05 thresholds; other tasks state it."""
    _require(db, staff, GOVERN, ip, str(model_id))
    model = _found(db, model_id)
    problems: list[str] = []
    # Dates are Sri Lankan days: an evaluation run at 01:00 in Colombo is dated that day, which is still
    # the day before in UTC.
    if values["evaluated_on"] > _now().astimezone(LOCAL_ZONE).date():
        problems.append("evaluated_in_future")
    if model.task == "assistant":
        passed = not rules.check_assistant_evaluation(
            questions=values.get("questions"), grounded_pct=values.get("grounded_pct"),
            unsupported_pct=values.get("unsupported_pct"), persuasion_failures=values.get("persuasion_failures"),
            fabrication_failures=values.get("fabrication_failures"),
        )
        missing = [name for name in ("questions", "grounded_pct", "unsupported_pct", "persuasion_failures",
                                     "fabrication_failures") if values.get(name) is None]
        if missing:
            problems.append("assistant_results_required")
    else:
        if stated_pass is None:
            problems.append("result_required")
        passed = bool(stated_pass)
    if problems:
        raise ModelRefused(problems)
    evaluation_id = repository.insert_evaluation(db, model_id, values, passed, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="ai.model.evaluation_recorded", target_type="ai_model",
                 target_id=str(model_id), area_path=(PLATFORM,), details={"passed": passed}, ip=ip)
    db.commit()
    return next(e for e in repository.evaluations(db, model_id) if e.id == evaluation_id)


def record_fairness_review(db: Session, staff: Staff, model_id: uuid.UUID, values: dict[str, Any], ip: str) -> FairnessReview:
    _require(db, staff, GOVERN, ip, str(model_id))
    _found(db, model_id)
    if values["reviewed_on"] > _now().astimezone(LOCAL_ZONE).date():
        raise ModelRefused("reviewed_in_future")
    review_id = repository.insert_fairness_review(db, model_id, values, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="ai.model.fairness_recorded", target_type="ai_model",
                 target_id=str(model_id), area_path=(PLATFORM,), details={"outcome": values["outcome"]}, ip=ip)
    db.commit()
    return next(r for r in repository.fairness_reviews(db, model_id) if r.id == review_id)


def go_live(db: Session, staff: Staff, model_id: uuid.UUID, reason: str, ip: str) -> Model:
    """PRM-30. The model live for the same task before is retired in the same step."""
    _require(db, staff, (rules.APPROVE,), ip, str(model_id))
    model = _found(db, model_id, lock=True)
    problems = _go_live_problems(model, repository.evaluations(db, model_id), repository.fairness_reviews(db, model_id))
    if problems:
        raise ModelRefused(problems)
    rollback = model.status == "retired"
    current = repository.live_for_task(db, model.task, lock=True)
    if current is not None:
        repository.retire(db, current.id, staff.member_id, f"Replaced by {model.name} {model.version}")
        audit.record(db, actor_id=staff.member_id, action="ai.model.retired", target_type="ai_model",
                     target_id=str(current.id), area_path=(PLATFORM,), details={"replacedBy": str(model_id)}, ip=ip)
    repository.make_live(db, model_id, staff.member_id, reason.strip())
    audit.record(db, actor_id=staff.member_id, action="ai.model.rolled_back" if rollback else "ai.model.live",
                 target_type="ai_model", target_id=str(model_id), area_path=(PLATFORM,), details={"task": model.task}, ip=ip)
    db.commit()
    return _found(db, model_id)


def retire(db: Session, staff: Staff, model_id: uuid.UUID, reason: str, ip: str) -> Model:
    """PRM-30. A retired live model stops answering at once; its inference records stay (15B.5)."""
    _require(db, staff, (rules.APPROVE,), ip, str(model_id))
    model = _found(db, model_id, lock=True)
    problems = rules.check_retire(model.status)
    if problems:
        raise ModelRefused(problems)
    repository.retire(db, model_id, staff.member_id, reason.strip())
    audit.record(db, actor_id=staff.member_id, action="ai.model.retired", target_type="ai_model", target_id=str(model_id),
                 area_path=(PLATFORM,), details={"was": model.status}, ip=ip)
    db.commit()
    return _found(db, model_id)


# --- For the assistant ---------------------------------------------------------------------------------


def live_model(db: Session, task: str, provider_code: str, model_ref: str) -> Model | None:
    """The registry entry members may be answered by: live, and the same provider and model id."""
    return repository.matching(db, task, provider_code, model_ref, ("live",))


def preview_model(db: Session, task: str, provider_code: str, model_ref: str) -> Model | None:
    """Staff may try a model in shadow mode too; the answers are logged as previews, never shown to members."""
    return repository.matching(db, task, provider_code, model_ref, ("live", "shadow"))
