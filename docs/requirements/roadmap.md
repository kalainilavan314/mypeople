# Roadmap for the remaining requirements

BRD v1.1 has 466 functional requirements. About 35 are built so far, mostly in the API (see [README.md](README.md)). The BRD plans the rest in phases with a vendor team (§20.2): Phase 0 governance (about 3 months), Phase 1 secure core (about 6), Phase 2 community and accountability (about 9), Phase 3 advanced participation and AI (9 to 12). This file is the order of batches, one tested module at a time, and what each is waiting on.

A batch builds the API module first (rules, service, endpoints, tests, audit), then the screens that use it. Anything that needs a decision, a vendor or legal approval is built behind an interface with a clear "not configured" answer, never a pretend success.

## Phase 1: secure core

| Batch | Scope | BRD | Waiting on |
|---|---|---|---|
| 11 (done) | Membership states and activation; staff need Active membership | FR-ADM-003, PRM-05, BR-014, BR-015, BR-097, FR-REG-024, FR-CARD-014 | OD-02 (auto-activation stays off until decided) |
| 12 (done) | Duplicate identities by keyed hash, investigations | FR-IDV-005, 006, 010, FR-WEB-012, BR-007, BR-094, PRM-28, D04 | KMS for the key (OD-20) |
| 13 | Registration in FastAPI: route, consent, profile, area, referral, survey; SMS one-time codes behind an interface | FR-AUTH-001 to 017, FR-REG remaining, BR-001 to BR-019 | SMS vendor (INT-01) |
| 14 | Account security: staff MFA, sessions list and revoke, step-up, recovery delay, access reviews | FR-AUTH-018 to 027, FR-STF-010 | Staff identity provider (INT-09) |
| 15 | Member card: rotating signed QR, scanning, revocation | FR-CARD-001 to 015, FR-ADM-001, 002, FR-STF-005 | Wallet passes (INT-03), OD-08 |
| 16 | Events foundation | FR-EVT-001 to 018, FR-ADM-004, FR-STF-006 | — |
| 17 | Home and gallery | FR-HOME-001 to 014, FR-GAL-001 to 007, FR-ADM-005, 006 | — |
| 18 | Profile and data-subject rights | FR-PROF remaining | — |
| 19 | Notifications (in-app first, push behind an interface) | FR-REG-021, FR-ADM-007, FR-STF-009 | Push credentials (INT-02) |
| 20 | Election silence period, feature flags, manual alternatives | NFR-ELC-01 to 04, FR-ARCH-011, FR-VOI-007 | POL-12 |
| 21–24 | Screens: member app (A, H01–H04, E, C, G, P), dashboard (W01, W02, W09, D03–D06), staff app core (S01–S04, S08–S10, S13, S14) | — | UX approval of new screens (Phase 0) |
| 25 | Capture quality and OCR | FR-IDV-001 to 004 | OD-42 for server-side OCR |

## Phase 2: community service and accountability

Community issues and the case workflow (FR-RPT, FR-WEB-014 to 029); volunteering (FR-VOL); ideas and development proposals (FR-IDEA, FR-DEV); Community Support and households with row-level security (FR-AST, FR-HH); Promise Tracker and scorecards (FR-PRM, FR-ACS); town halls (FR-THL); election information (FR-ELX, legal approval); official content and fact-checking (FR-AUT); staff field visits (FR-FLD); bank-transfer fund, surveys, learning, referrals (FR-FUND, FR-SRV, FR-LRN, FR-REF); official alerts (FR-DIS); WhatsApp (FR-MSG). Waiting on: POL-05 to POL-09, POL-12, POL-13, the WhatsApp provider, DEP-19 legal opinions.

## Phase 3: advanced participation and AI

Tamil AI assistant (FR-AIA, OD-42); participatory budgeting (FR-PBG); payment gateway (FR-PAY, OD-27, OD-40); diaspora (FR-DSP); wings and committees (FR-COM); voice (FR-VOI); livelihood guide (FR-LIV); blood donors (FR-BLD); disaster relief (FR-DIS); liveness and face comparison only if OD-28 approves (FR-IDV-007 to 009); advanced analytics; Eastern Province.

## Decisions only the sponsor can make

The G0 open decisions (BRD §22) block parts of every phase: OD-01 reviewers, OD-02 activation, OD-03 retention, OD-04 assisted verification, OD-07 and OD-27 payments, OD-20 hosting, OD-28 and OD-29 biometrics, OD-42 AI provider. The code records each assumption it makes in their place, so it can be changed when they are decided.
