"""AI model registry and monitoring (BRD D21, PRM-30, PRM-31): /v1/ai-models.

Not behind a module switch: models are registered, evaluated and watched in shadow mode before
any AI feature opens to members (15B.5).
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.ai.registry import rules, service
from app.modules.ai.registry.schemas import (
    AiConfiguredOut,
    AiEvaluationIn,
    AiEvaluationOut,
    AiFairnessIn,
    AiFairnessOut,
    AiModelDecisionIn,
    AiModelFileOut,
    AiModelIn,
    AiModelOut,
    AiModelSummaryOut,
    AiRegistryOut,
)

Db = Annotated[Session, Depends(get_db)]
Governance = Annotated[Staff, Depends(require_permission(rules.MONITOR, rules.APPROVE))]
Approver = Annotated[Staff, Depends(require_permission(rules.APPROVE))]

router = APIRouter(prefix="/v1/ai-models", tags=["ai-models"])

REFUSED = {
    403: {"description": "forbidden"},
    404: {"description": "not_found"},
    422: {"description": "model_refused with problems"},
}


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.ModelNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.ModelRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "model_refused", "problems": error.problems}
        ) from None


@router.get("", response_model=AiRegistryOut)
def list_models(staff: Governance, request: Request, db: Db) -> AiRegistryOut:
    """Every model with its latest evaluation and fairness review, 30 days of use, and what this server
    is set up to call for the assistant."""
    settings = request.app.state.settings
    summaries = service.models(db, staff)
    configured_ref = settings.ai_assistant_model.strip() if settings.ai_provider != "none" else None
    registered = (
        next((s.model for s in summaries if s.model.task == "assistant" and s.model.provider_code == settings.ai_provider
              and s.model.model_ref == configured_ref and s.model.status != "retired"), None)
        if configured_ref else None
    )
    return AiRegistryOut(
        configured=AiConfiguredOut(
            provider=settings.ai_provider, model_ref=configured_ref,
            registered_model_id=registered.id if registered else None,
            registered_status=registered.status if registered else None,  # type: ignore[arg-type]
        ),
        models=[AiModelSummaryOut.build(s) for s in summaries],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=AiModelOut, responses=REFUSED)
def register_model(body: AiModelIn, staff: Governance, request: Request, db: Db) -> AiModelOut:
    """A new entry starts in shadow mode (15B.5)."""
    with _answers():
        return AiModelOut.build(service.register(db, staff, body.model_dump(), client_ip(request)))


@router.get("/{model_id}", response_model=AiModelFileOut, responses=REFUSED)
def read_model(model_id: uuid.UUID, staff: Governance, db: Db) -> AiModelFileOut:
    with _answers():
        return AiModelFileOut.build(service.model_file(db, staff, model_id))


@router.post("/{model_id}/evaluations", status_code=status.HTTP_201_CREATED, response_model=AiEvaluationOut, responses=REFUSED)
def record_evaluation(model_id: uuid.UUID, body: AiEvaluationIn, staff: Governance, request: Request, db: Db) -> AiEvaluationOut:
    """For the assistant, pass or fail is worked out from NFR-AI-05: at least 200 questions, 95% or more
    grounded, 2% or fewer unsupported, and no persuasion or fabrication failures."""
    values = body.model_dump(exclude={"passed"})
    with _answers():
        return AiEvaluationOut.build(service.record_evaluation(db, staff, model_id, values, body.passed, client_ip(request)))


@router.post("/{model_id}/fairness-reviews", status_code=status.HTTP_201_CREATED, response_model=AiFairnessOut,
             responses=REFUSED)
def record_fairness_review(model_id: uuid.UUID, body: AiFairnessIn, staff: Governance, request: Request, db: Db) -> AiFairnessOut:
    with _answers():
        return AiFairnessOut.build(service.record_fairness_review(db, staff, model_id, body.model_dump(), client_ip(request)))


@router.post("/{model_id}/go-live", response_model=AiModelOut, responses=REFUSED)
def go_live(model_id: uuid.UUID, body: AiModelDecisionIn, staff: Approver, request: Request, db: Db) -> AiModelOut:
    """PRM-30. Problems: licence_not_for_commercial_use, no_training_terms_missing, evaluation_missing,
    evaluation_failed, evaluation_out_of_date, fairness_review_missing, fairness_review_not_passed,
    shadow_period_running, already_live, retired_before_going_live. A version that was live before goes
    live again at once (rollback, NFR-AI-07)."""
    with _answers():
        return AiModelOut.build(service.go_live(db, staff, model_id, body.reason, client_ip(request)))


@router.post("/{model_id}/retire", response_model=AiModelOut, responses=REFUSED)
def retire(model_id: uuid.UUID, body: AiModelDecisionIn, staff: Approver, request: Request, db: Db) -> AiModelOut:
    with _answers():
        return AiModelOut.build(service.retire(db, staff, model_id, body.reason, client_ip(request)))
