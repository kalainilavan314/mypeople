"""SQL for the AI model registry, evaluations, fairness reviews and the inference log (D21)."""

import json
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Model:
    id: uuid.UUID
    task: str
    name: str
    provider: str
    provider_code: str
    model_ref: str
    version: str
    licence: str
    licence_commercial_use: bool
    no_training_terms: bool
    data_location: str
    training_data_summary: str
    artefact_hash: str | None
    notes: str | None
    status: str
    shadow_started_at: datetime
    live_at: datetime | None
    retired_at: datetime | None
    status_reason: str | None
    created_at: datetime


_MODEL = """
    SELECT id, task, name, provider, provider_code, model_ref, version, licence, licence_commercial_use,
           no_training_terms, data_location, training_data_summary, artefact_hash, notes, status, shadow_started_at,
           live_at, retired_at, status_reason, created_at
    FROM ai.model
"""
FIELDS = (
    "task", "name", "provider", "provider_code", "model_ref", "version", "licence", "licence_commercial_use",
    "no_training_terms", "data_location", "training_data_summary", "artefact_hash", "notes",
)


def find(db: Session, model_id: uuid.UUID, *, lock: bool = False) -> Model | None:
    row = db.execute(text(f"{_MODEL} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": model_id}).mappings().one_or_none()
    return Model(**row) if row else None


def all_models(db: Session) -> list[Model]:
    rows = db.execute(text(f"{_MODEL} ORDER BY (status = 'live') DESC, (status = 'shadow') DESC, task, created_at DESC"))
    return [Model(**row) for row in rows.mappings()]


def matching(db: Session, task: str, provider_code: str, model_ref: str, statuses: tuple[str, ...]) -> Model | None:
    """The newest entry for a provider's model in one of the statuses."""
    row = db.execute(
        text(
            f"""{_MODEL} WHERE task = :task AND provider_code = :provider AND model_ref = :ref
                AND status = ANY(:statuses) ORDER BY (status = 'live') DESC, created_at DESC LIMIT 1"""
        ),
        {"task": task, "provider": provider_code, "ref": model_ref, "statuses": list(statuses)},
    ).mappings().one_or_none()
    return Model(**row) if row else None


def live_for_task(db: Session, task: str, *, lock: bool = False) -> Model | None:
    row = db.execute(
        text(f"{_MODEL} WHERE task = :task AND status = 'live'{' FOR UPDATE' if lock else ''}"), {"task": task}
    ).mappings().one_or_none()
    return Model(**row) if row else None


def exists(db: Session, task: str, provider_code: str, model_ref: str, version: str) -> bool:
    return bool(db.scalar(
        text("SELECT 1 FROM ai.model WHERE task = :task AND provider_code = :p AND model_ref = :r AND version = :v"),
        {"task": task, "p": provider_code, "r": model_ref, "v": version},
    ))


def insert(db: Session, values: dict[str, Any], registered_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(FIELDS)
    params = ", ".join(f":{name}" for name in FIELDS)
    return db.scalar(
        text(f"INSERT INTO ai.model ({columns}, registered_by) VALUES ({params}, :registered_by) RETURNING id"),
        {**{name: values.get(name) for name in FIELDS}, "registered_by": registered_by},
    )


def make_live(db: Session, model_id: uuid.UUID, approved_by: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """UPDATE ai.model SET status = 'live', approved_by = :by, live_at = clock_timestamp(), retired_by = NULL,
                      retired_at = NULL, status_reason = :reason WHERE id = :id"""
        ),
        {"id": model_id, "by": approved_by, "reason": reason},
    )


def retire(db: Session, model_id: uuid.UUID, retired_by: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """UPDATE ai.model SET status = 'retired', retired_by = :by, retired_at = clock_timestamp(),
                      status_reason = :reason WHERE id = :id"""
        ),
        {"id": model_id, "by": retired_by, "reason": reason},
    )


@dataclass(frozen=True)
class Evaluation:
    id: uuid.UUID
    model_id: uuid.UUID
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


_EVALUATION = """
    SELECT id, model_id, evaluated_on, questions, grounded_pct, unsupported_pct, persuasion_failures,
           fabrication_failures, summary, report_ref, passed, created_at
    FROM ai.model_evaluation
"""


def evaluations(db: Session, model_id: uuid.UUID) -> list[Evaluation]:
    rows = db.execute(text(f"{_EVALUATION} WHERE model_id = :id ORDER BY evaluated_on DESC, created_at DESC"), {"id": model_id})
    return [Evaluation(**row) for row in rows.mappings()]


def insert_evaluation(db: Session, model_id: uuid.UUID, values: dict[str, Any], passed: bool, recorded_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO ai.model_evaluation (model_id, evaluated_on, questions, grounded_pct, unsupported_pct,
                   persuasion_failures, fabrication_failures, summary, report_ref, passed, recorded_by)
               VALUES (:model_id, :evaluated_on, :questions, :grounded_pct, :unsupported_pct, :persuasion_failures,
                   :fabrication_failures, :summary, :report_ref, :passed, :recorded_by) RETURNING id"""
        ),
        {"model_id": model_id, **values, "passed": passed, "recorded_by": recorded_by},
    )


@dataclass(frozen=True)
class FairnessReview:
    id: uuid.UUID
    model_id: uuid.UUID
    reviewed_on: date
    groups: str
    findings: str
    outcome: str
    created_at: datetime


def fairness_reviews(db: Session, model_id: uuid.UUID) -> list[FairnessReview]:
    rows = db.execute(
        text(
            """SELECT id, model_id, reviewed_on, groups, findings, outcome, created_at FROM ai.fairness_review
               WHERE model_id = :id ORDER BY reviewed_on DESC, created_at DESC"""
        ),
        {"id": model_id},
    )
    return [FairnessReview(**row) for row in rows.mappings()]


def insert_fairness_review(db: Session, model_id: uuid.UUID, values: dict[str, Any], reviewed_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO ai.fairness_review (model_id, reviewed_on, groups, findings, outcome, reviewed_by)
               VALUES (:model_id, :reviewed_on, :groups, :findings, :outcome, :reviewed_by) RETURNING id"""
        ),
        {"model_id": model_id, **values, "reviewed_by": reviewed_by},
    )


# --- The inference log (NFR-AI-01) and monitoring ------------------------------------------------------


def log_inference(db: Session, *, model_id: uuid.UUID, task: str, purpose: str, outcome: str, refusal: str | None,
                  cited: list[dict[str, Any]], message_id: uuid.UUID | None, latency_ms: int, input_tokens: int | None,
                  output_tokens: int | None) -> None:
    db.execute(
        text(
            """INSERT INTO ai.inference (model_id, task, purpose, outcome, refusal, cited, message_id, latency_ms,
                   input_tokens, output_tokens)
               VALUES (:model_id, :task, :purpose, :outcome, :refusal, CAST(:cited AS jsonb), :message_id, :latency_ms,
                   :input_tokens, :output_tokens)"""
        ),
        {"model_id": model_id, "task": task, "purpose": purpose, "outcome": outcome, "refusal": refusal,
         "cited": json.dumps(cited), "message_id": message_id, "latency_ms": latency_ms, "input_tokens": input_tokens,
         "output_tokens": output_tokens},
    )


@dataclass(frozen=True)
class Usage:
    answers: int
    answered: int
    no_source: int
    refused: int
    failed: int
    previews: int
    average_latency_ms: int | None
    p90_latency_ms: int | None
    input_tokens: int
    output_tokens: int


def usage(db: Session, model_id: uuid.UUID, since: datetime) -> Usage:
    row = db.execute(
        text(
            """
            SELECT count(*) FILTER (WHERE purpose = 'member') AS answers,
                   count(*) FILTER (WHERE purpose = 'member' AND outcome = 'answered') AS answered,
                   count(*) FILTER (WHERE purpose = 'member' AND outcome = 'no_source') AS no_source,
                   count(*) FILTER (WHERE purpose = 'member' AND outcome = 'refused') AS refused,
                   count(*) FILTER (WHERE purpose = 'member' AND outcome = 'failed') AS failed,
                   count(*) FILTER (WHERE purpose = 'staff_preview') AS previews,
                   round(avg(latency_ms))::int AS average_latency_ms,
                   round(percentile_cont(0.9) WITHIN GROUP (ORDER BY latency_ms))::int AS p90_latency_ms,
                   COALESCE(sum(input_tokens), 0)::int AS input_tokens,
                   COALESCE(sum(output_tokens), 0)::int AS output_tokens
            FROM ai.inference WHERE model_id = :id AND created_at >= :since
            """
        ),
        {"id": model_id, "since": since},
    ).mappings().one()
    return Usage(**row)


@dataclass(frozen=True)
class Feedback:
    helpful: int
    not_helpful: int
    error_reports: int


def feedback(db: Session, model_id: uuid.UUID, since: datetime) -> Feedback:
    """Ratings and error reports on this model's answers. Conversations sit behind the ai firewall;
    only counts leave this function."""
    db.execute(text("SELECT set_config('ai.firewall', 'open', true)"))
    row = db.execute(
        text(
            """
            SELECT (SELECT count(*) FROM ai.message WHERE model_id = :id AND rating = 'helpful' AND rated_at >= :since) AS helpful,
                   (SELECT count(*) FROM ai.message WHERE model_id = :id AND rating = 'not_helpful' AND rated_at >= :since) AS not_helpful,
                   (SELECT count(*) FROM ai.error_report WHERE model_id = :id AND created_at >= :since) AS error_reports
            """
        ),
        {"id": model_id, "since": since},
    ).mappings().one()
    return Feedback(**row)
