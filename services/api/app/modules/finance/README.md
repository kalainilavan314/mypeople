# finance module

Contributions, payment intents, gateway events, ledgers, and political-finance reconciliation.

**Status: Milestone 1.4 (Community Finance via Bank Transfer Slips) — Fully Built and Verified.**

## Architectural Overview

The finance module implements manual bank-transfer intake and two-person verified reconciliation according to BRD v1.1 and milestone M1.4 specifications:
1. **Intake & Drafts (`/v1/fund/`)**:
   - `GET /v1/fund/config`: Returns the configured official bank details, including the transferable account number, instructions, and configuration status. Fails closed when disabled.
   - `POST /v1/fund/contributions`: Requires an `Idempotency-Key`, then creates or returns a contribution draft with amount, date, bank reference, mandatory voluntary/no-privilege and accuracy declarations, and the member's self-payment indicator.
   - `PUT /v1/fund/contributions/{id}/slip`: Scans for malware, re-encodes, encrypts via AES-256-GCM (associated data bound to `id:version`), and appends to `finance.contribution_slip`.
   - `POST /v1/fund/contributions/{id}/submit`: Transitions draft from `DRAFT`/`NEEDS_CORRECTION` to `SUBMITTED`, evaluates risk flags (duplicate reference, enhanced review threshold, third-party payment), and notifies staff queue.
   - `GET /v1/fund/contributions/mine` and `GET /v1/fund/contributions/{id}`: Donor status tracking and sanitized timeline.
   - `GET /v1/fund/contributions/{id}/receipt`: Official `CN-XXXXX` receipt card (only available once independently verified).

2. **Operations & Reconciliation (`/v1/finance/`)**:
   - Gated by RBAC permissions (`finance.review`, `finance.approve`, `finance.export`, `finance.audit_read`) and feature gate G1 (`community_finance`).
   - `GET /v1/finance/contributions`: Staff operational queue with status, month, risk flag, reference search, and bounded pagination.
   - `GET /v1/finance/contributions/{id}`: Detailed review view with donor code, declarations, risk flags, and audit history.
   - `POST /v1/finance/contributions/{id}/claim`: Claim assignment for reviewer.
   - `POST /v1/finance/contributions/{id}/slip-view` and `GET /v1/finance/slips/{token}`: Single-use, 5-minute viewer-bound tokens streaming encrypted slips with `Cache-Control: no-store, private` and strict CSP.
   - `POST /v1/finance/contributions/{id}/reconcile`: Step 1 bank statement reconciliation requiring a statement line reference and a valid workflow transition.
   - `POST /v1/finance/contributions/{id}/approve`: Step 2 independent second-person approval (separated from reviewer and donor), issuing transactional sequential `CN-XXXXX` receipt codes from locked singleton counter.
   - `GET /v1/finance/ledger.csv`: Monthly reconciliation ledger export sanitized against CSV formula injection.

## Security & Separation of Duties
- Separate dedicated AES-256-GCM key (`FINANCE_KEY` / `EVIDENCE_ENCRYPTION_KEY`).
- Mandatory two-person rule: The staff member who reconciles a case cannot approve it (`same_person_approval_forbidden`).
- Donors cannot review or approve their own contributions (`own_record`).
- Related-party conflicts prevent approval (`conflict_of_interest`).
- Live intake fails closed when `FINANCE_INTAKE_ENABLED=false` or bank details are missing.
- Outside development, enabled intake requires `FINANCE_MALWARE_SCANNER=clamav`; clamd is contacted through the bounded `INSTREAM` protocol and any timeout, malformed response, or unavailable daemon fails closed.

BRD v1.1: FR-FUND-001 to 011, FR-ADM-008; `/v1/fund`, `/v1/finance`; CMP-02, OD-07, OD-27, RB-12.
