# ai module

Dispatching inference to `services/ai-worker`, model registry links, and the assistant's retrieval and guardrails. Results are advice for people, never decisions (BR-091).

**Status: assistant, knowledge base and model registry built** (Phase 3; `ai_assistant`, migration 0052):
`assistant/` (M28: retrieval over approved sources, identifier removal, refusal rules, 30-day retention
[ASSUMPTION] OD-48, hand-over to a person), `knowledge/` (D20) and `registry/` (D21). Answers need
`AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` and a model made live in the registry; the default
`none` sends nothing anywhere (OD-42). Identity screening still waits on OD-28 and OD-29.

BRD v1.1: FR-IDV-001 to 017 (screening), FR-AIA-001 to 010; `/v1/assistant`; §15B.
