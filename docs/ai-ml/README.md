# AI and machine learning

How the BRD (§15B) allows AI to be used in My People, and where each use will live. **No model is in use yet**: identity review today is entirely human, and `services/ai-worker` holds only folder READMEs.

## Rules that apply to every use

- **AI advises; people decide.** No identity is approved, rejected or refused on a model's result alone (BR-091, PRH-07). Every identity outcome is decided by a holder of `members.verify` (FR-IDV-012).
- **Shown after the evidence.** A reviewer sees screening results only after inspecting the images, to limit automation bias; disagreeing with a result needs a reason (an override), reported per model version (FR-IDV-017).
- **Isolated inference.** The worker runs on a private network with no internet access and deletes inputs after processing (FR-ARCH-008, NFR-AI-04). Inference records keep references and outputs, never raw images or full prompts.
- **Biometrics only if approved.** Liveness and face comparison exist only if OD-28 approves them. Embeddings and liveness frames are discarded after the session unless OD-29 approves keeping them (BR-096, PRH-04). Face similarity is never presented as proof of identity (BR-092).
- **No training on member data** (identity images, cases, households, ballots, conversations) without explicit, separate consent and a DPIA (§15B.8).
- **Members are told** where AI assists: capture guidance, OCR prefill, the assistant and voice.

## Use-case register (§15B.1)

| ID | Use | Output | Oversight | Phase | Folder |
|---|---|---|---|---|---|
| AI-01 | Capture quality (edges, blur, glare) | Retake guidance | Member; reviewer sees result | 1 | `ai-worker/app/document_ocr` |
| AI-02 | NIC number OCR | Prefill to confirm; reviewer flag | Member confirms; reviewer decides | 1–2 | `document_ocr` |
| AI-03 | NIC format and birth-date consistency | Reviewer flag | Reviewer | 1 | `document_ocr` |
| AI-04 | Presentation-attack detection | Score band, reason codes | Reviewer; OD-28 | 2 | `liveness` |
| AI-05 | Document photo vs selfie (1:1) | Similarity band, "Not proof of identity" | Reviewer; OD-28 | 2 | `face_comparison` |
| AI-06 | Duplicate identity detection | Investigation trigger | Duplicate investigator | 1 | API (keyed hash, no model) |
| AI-07 | Proposal topics and duplicates | Suggestion | Moderator | 2 | `issue_classification` |
| AI-08 | Bilingual summaries | Labelled "AI summary" | Editor approves | 2–3 | `translation` |
| AI-09 | Semantic search | Ranked results | — | 2 | `knowledge_assistant` |
| AI-10 | Tamil AI assistant | Cited answers | Guardrails, human escalation | 3 | `knowledge_assistant` |
| AI-11 | Tamil speech-to-text and text-to-speech | Editable transcript | Member edits before sending | 2–3 | `translation` |
| AI-12 | Misinformation triage | Queue priority | Fact-checker decides | 2 | `issue_classification` |

## Identity screening pipeline (§15B.2)

Capture quality → OCR → format and consistency rules → entered vs extracted number → duplicate lookup (keyed hash) → liveness and face comparison (only if OD-28) → a summary for the reviewer's screening panel (D03). If the worker is unavailable, submission continues and the review goes ahead without screening.

## Release gates (§15B.3, §15B.5)

A model is released only after an evaluation against these thresholds, a licence check, approval by the AI Governance Lead (PRM-30), at least 4 weeks in shadow mode and a one-district rollout:

| Metric | Threshold |
|---|---|
| OCR exact match | ≥ 95% |
| OCR character error rate | ≤ 1% |
| False acceptance rate (face) | ≤ 0.1% |
| False rejection rate (face) | ≤ 5% |
| Presentation-attack errors (APCER, BPCER) | ≤ 5% each |
| Demographic differential | ≤ 2 percentage points FRR across groups |
| Appeal reversal rate | Investigate if > 10% |

Rollback to the previous version within 1 hour; incident report within 5 working days.

## Open decisions

| Decision | Blocks |
|---|---|
| OD-28 Acceptable biometric processing | AI-04, AI-05 |
| OD-29 Biometric retention | Keeping any embedding or liveness frame |
| OD-42 AI provider and hosting | The assistant, summaries, speech, `services/ai-worker` deployment |
| OD-20 Hosting location and cross-border transfer | Where inference runs |
