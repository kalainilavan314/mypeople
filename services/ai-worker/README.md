# AI worker (planned)

This folder will hold the private AI inference worker described in BRD v1.1 §15B. **No code exists yet, on purpose:** the BRD places AI features in Phase 3, and the decisions they depend on are still open (OD-28 biometric processing, OD-29 face data retention, OD-42 AI provider and hosting).

## What it will do

| Use | BRD | Rule |
|---|---|---|
| Document OCR and NIC format checks | FR-IDV | Advisory: results go to a human reviewer |
| Face comparison and liveness | FR-IDV, OD-28 | Only if OD-28 approves it; 1:N face search is excluded |
| Issue classification and translation | §15B.6 | Suggestions that staff can accept or change |
| Tamil knowledge assistant (retrieval) | FR-AIA | Answers only from approved content; escalates to a person |

## Constraints it must be built under

- **Advisory only.** No model approves an identity, an assistance case, a moderation decision or a fact-check. A person with the right permission decides (BR-091, AP-04).
- **Private network, no internet egress** for inference workers; no public ingress (FR-ARCH-008).
- **No identity images or biometric data in this repository, in images or in logs.** Inputs arrive through short-lived signed links from private storage and are not kept.
- **Jobs come from the API's queue** (Redis and Celery, FR-ARCH-004): idempotent, retried, dead-lettered after three failures.
- **Every model version is registered and approved** before use, with its evaluation report (§15B.5, NFR-AI-01). Model weights live in the registry, not in Git.
- **No political profiling** from any input, ever (§16.9).

Planned layout when work starts: `app/worker.py` plus one folder per task (`document_ocr`, `face_comparison`, `liveness`, `issue_classification`, `translation`, `knowledge_assistant`), `tests/`, `pyproject.toml` and `Dockerfile`.
