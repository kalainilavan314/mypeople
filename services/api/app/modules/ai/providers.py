"""Where the assistant's answers are written (BRD INT-17, OD-42, 15B.8 "Third-party models").

[ASSUMPTION] OD-42 (AI provider and hosting) is open, so AI_PROVIDER defaults to "none": nothing is
sent anywhere and the assistant says it is not available yet. "anthropic" uses Anthropic's API with
the model named in AI_ASSISTANT_MODEL, and only when ANTHROPIC_API_KEY is set. What is sent is the
redacted question, a little of the redacted conversation and approved source excerpts; never the
member's identity, area or any other record. Anthropic's commercial terms do not train on API data;
the registry entry records that (no-training terms) and where the data is processed before the AI
Governance Lead can make the model live.

Refusal fallbacks to another model are deliberately not used: an answer from a model that is not
live in the registry would break 15B.5. A refusal is shown as "cannot answer" with human help.
"""

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from app.core.config import Settings
from app.modules.ai.assistant.prompt import ANSWER_SCHEMA, SYSTEM_PROMPT

logger = logging.getLogger("mypeople.ai")

ProviderCode = Literal["anthropic"]
Stop = Literal["done", "refused", "failed"]

# Opus 5.5's own default, set explicitly: enough reasoning to keep to the sources and the rules.
EFFORT = "medium"
MAX_TOKENS = 16000
TIMEOUT_SECONDS = 60.0


@dataclass(frozen=True)
class ProviderReply:
    stop: Stop
    data: dict[str, Any] | None
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None


class AnswerProvider(Protocol):
    code: ProviderCode
    model_ref: str

    def answer(self, content: str) -> ProviderReply: ...


class AnthropicProvider:
    code: ProviderCode = "anthropic"

    def __init__(self, client: Any, model_ref: str) -> None:
        self._client = client
        self.model_ref = model_ref

    def answer(self, content: str) -> ProviderReply:
        import anthropic

        started = time.monotonic()

        def elapsed() -> int:
            return int((time.monotonic() - started) * 1000)

        try:
            response = self._client.messages.create(
                model=self.model_ref,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": content}],
                output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
            )
        except anthropic.RateLimitError:
            logger.warning("assistant provider rate limited")
            return ProviderReply("failed", None, elapsed())
        except anthropic.APIStatusError as error:
            # Status and request id only: the request held the member's question.
            logger.warning("assistant provider refused the request: status %s request %s", error.status_code,
                           getattr(error, "request_id", None))
            return ProviderReply("failed", None, elapsed())
        except anthropic.APIConnectionError:
            logger.warning("assistant provider unreachable")
            return ProviderReply("failed", None, elapsed())

        usage = getattr(response, "usage", None)
        tokens = {
            "input_tokens": getattr(usage, "input_tokens", None),
            "output_tokens": getattr(usage, "output_tokens", None),
        }
        if response.stop_reason == "refusal":
            return ProviderReply("refused", None, elapsed(), **tokens)
        if response.stop_reason != "end_turn":
            logger.warning("assistant answer stopped early: %s", response.stop_reason)
            return ProviderReply("failed", None, elapsed(), **tokens)
        text = next((block.text for block in response.content if block.type == "text"), None)
        try:
            data = json.loads(text) if text else None
        except json.JSONDecodeError:
            data = None
        if not isinstance(data, dict):
            return ProviderReply("failed", None, elapsed(), **tokens)
        return ProviderReply("done", data, elapsed(), **tokens)


def build_provider(settings: Settings) -> AnswerProvider | None:
    """None when no provider is configured (the default): the assistant then fails closed."""
    if settings.ai_provider != "anthropic" or settings.anthropic_api_key is None:
        return None
    import anthropic

    client = anthropic.Anthropic(
        api_key=settings.anthropic_api_key.get_secret_value(), timeout=TIMEOUT_SECONDS, max_retries=1
    )
    return AnthropicProvider(client, settings.ai_assistant_model.strip())
