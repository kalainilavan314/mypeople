"""Request and response bodies for the AI model registry and monitoring (D21)."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.ai.registry.repository import Evaluation, FairnessReview, Feedback, Model, Usage
from app.modules.ai.registry.rules import FairnessOutcome, ProviderCode, Status, Task
from app.modules.ai.registry.service import ModelFile, ModelSummary


class AiModelIn(CamelModel):
    task: Task
    name: str = Field(min_length=2, max_length=120)
    provider: str = Field(min_length=2, max_length=120, description="Who runs it, e.g. Anthropic (hosted API)")
    provider_code: ProviderCode
    model_ref: str = Field(min_length=1, max_length=120, description="The model's id as the provider names it")
    version: str = Field(min_length=1, max_length=60)
    licence: str = Field(min_length=3, max_length=300, description="DEP-24")
    licence_commercial_use: bool
    no_training_terms: bool = Field(description="OD-42: the provider may not train on what is sent")
    data_location: str = Field(min_length=2, max_length=200)
    training_data_summary: str = Field(min_length=10, max_length=2000, description="NFR-AI-01")
    artefact_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    notes: str | None = Field(default=None, min_length=3, max_length=2000)


class AiModelOut(CamelModel):
    id: uuid.UUID
    task: Task
    name: str
    provider: str
    provider_code: ProviderCode
    model_ref: str
    version: str
    licence: str
    licence_commercial_use: bool
    no_training_terms: bool
    data_location: str
    training_data_summary: str
    artefact_hash: str | None
    notes: str | None
    status: Status
    shadow_started_at: datetime
    live_at: datetime | None
    retired_at: datetime | None
    status_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, m: Model) -> "AiModelOut":
        return cls(**m.__dict__)


class AiEvaluationIn(CamelModel):
    evaluated_on: date
    questions: int | None = Field(default=None, ge=1, le=100000)
    grounded_pct: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    unsupported_pct: Decimal | None = Field(default=None, ge=0, le=100, max_digits=5, decimal_places=2)
    persuasion_failures: int | None = Field(default=None, ge=0, le=100000)
    fabrication_failures: int | None = Field(default=None, ge=0, le=100000)
    summary: str = Field(min_length=10, max_length=3000)
    report_ref: str = Field(min_length=3, max_length=300, description="Where the evaluation report is kept")
    passed: bool | None = Field(default=None, description="Stated for tasks other than the assistant")


class AiEvaluationOut(CamelModel):
    id: uuid.UUID
    evaluated_on: date
    questions: int | None
    grounded_pct: Decimal | None
    unsupported_pct: Decimal | None
    persuasion_failures: int | None
    fabrication_failures: int | None
    summary: str
    report_ref: str
    passed: bool
    created_at: datetime

    @classmethod
    def build(cls, e: Evaluation) -> "AiEvaluationOut":
        return cls(**{k: v for k, v in e.__dict__.items() if k != "model_id"})


class AiFairnessIn(CamelModel):
    reviewed_on: date
    groups: str = Field(min_length=3, max_length=1000, description="The groups compared, e.g. districts or age bands")
    findings: str = Field(min_length=10, max_length=3000)
    outcome: FairnessOutcome


class AiFairnessOut(CamelModel):
    id: uuid.UUID
    reviewed_on: date
    groups: str
    findings: str
    outcome: FairnessOutcome
    created_at: datetime

    @classmethod
    def build(cls, r: FairnessReview) -> "AiFairnessOut":
        return cls(**{k: v for k, v in r.__dict__.items() if k != "model_id"})


class AiModelDecisionIn(CamelModel):
    reason: str = Field(min_length=3, max_length=1000)


class AiUsageOut(CamelModel):
    answers: int = Field(description="Answers to members")
    answered: int
    no_source: int
    refused: int
    failed: int
    previews: int = Field(description="Staff previews, never shown to members")
    average_latency_ms: int | None
    p90_latency_ms: int | None
    input_tokens: int
    output_tokens: int

    @classmethod
    def build(cls, u: Usage) -> "AiUsageOut":
        return cls(**u.__dict__)


class AiFeedbackOut(CamelModel):
    helpful: int
    not_helpful: int
    error_reports: int

    @classmethod
    def build(cls, f: Feedback) -> "AiFeedbackOut":
        return cls(**f.__dict__)


class AiModelSummaryOut(CamelModel):
    model: AiModelOut
    latest_evaluation: AiEvaluationOut | None
    latest_fairness: AiFairnessOut | None
    usage_30_days: AiUsageOut
    go_live_problems: list[str] = Field(description="Why it cannot go live yet; empty when it can")

    @classmethod
    def build(cls, s: ModelSummary) -> "AiModelSummaryOut":
        return cls(
            model=AiModelOut.build(s.model),
            latest_evaluation=AiEvaluationOut.build(s.latest_evaluation) if s.latest_evaluation else None,
            latest_fairness=AiFairnessOut.build(s.latest_fairness) if s.latest_fairness else None,
            usage_30_days=AiUsageOut.build(s.usage_30_days),
            go_live_problems=s.go_live_problems,
        )


class AiConfiguredOut(CamelModel):
    """What this server is set up to call for the assistant (AI_PROVIDER, AI_ASSISTANT_MODEL)."""

    provider: Literal["none", "anthropic"]
    model_ref: str | None
    registered_model_id: uuid.UUID | None
    registered_status: Status | None


class AiRegistryOut(CamelModel):
    configured: AiConfiguredOut
    models: list[AiModelSummaryOut]


class AiModelFileOut(CamelModel):
    summary: AiModelSummaryOut
    evaluations: list[AiEvaluationOut]
    fairness_reviews: list[AiFairnessOut]
    usage_7_days: AiUsageOut
    feedback_30_days: AiFeedbackOut

    @classmethod
    def build(cls, f: ModelFile) -> "AiModelFileOut":
        return cls(
            summary=AiModelSummaryOut.build(f.summary),
            evaluations=[AiEvaluationOut.build(e) for e in f.evaluations],
            fairness_reviews=[AiFairnessOut.build(r) for r in f.fairness_reviews],
            usage_7_days=AiUsageOut.build(f.usage_7_days),
            feedback_30_days=AiFeedbackOut.build(f.feedback_30_days),
        )
