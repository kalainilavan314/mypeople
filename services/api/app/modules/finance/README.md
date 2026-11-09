# finance module

Contributions, payment intents, gateway events, ledgers and political-finance returns.

**Status: schema and pure finance rules in progress (M1.4). No FastAPI contribution routes or screens are live.** Alembic 0022 creates a private finance domain with contribution states, encrypted-slip storage fields, append-only review/approval events and a lockable receipt counter for later transactional issuance. Live Express still records contributions under `/api/donations`; these records are not migrated or cross-joined.

Before any route is exposed: approve the donor/source, retention, finance role and bank-statement policies; implement a separate finance encryption key, safe upload validation and malware scanning, explicit reviewer and approver grants, idempotent submission and reconciliation, auditable refunds and exports, and member/admin UI. Payment gateways remain out of scope until provider and legal approval. A submission reference must never be labelled as an official CN receipt.

BRD v1.1: FR-FUND-001 to 011, FR-PAY-001 to 014, FR-ADM-008; `/v1/finance`, `/v1/payments`, `/webhooks/payments/{provider}`; CMP-02, OD-07, OD-27.
