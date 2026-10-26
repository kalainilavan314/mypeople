# Roadmap for the remaining requirements

BRD v1.1 has 466 functional requirements. About 140 are built so far, nearly all in the API (see [README.md](README.md)); the screens for them come in batches 21 to 24. The BRD plans the rest in phases with a vendor team (§20.2): Phase 0 governance (about 3 months), Phase 1 secure core (about 6), Phase 2 community and accountability (about 9), Phase 3 advanced participation and AI (9 to 12). This file is the order of batches, one tested module at a time, and what each is waiting on.

A batch builds the API module first (rules, service, endpoints, tests, audit), then the screens that use it. Anything that needs a decision, a vendor or legal approval is built behind an interface with a clear "not configured" answer, never a pretend success.

## Phase 1: secure core

| Batch | Scope | BRD | Waiting on |
|---|---|---|---|
| 11 (done) | Membership states and activation; staff need Active membership | FR-ADM-003, PRM-05, BR-014, BR-015, BR-097, FR-REG-024, FR-CARD-014 | OD-02 (auto-activation stays off until decided) |
| 12 (done) | Duplicate identities by keyed hash, investigations | FR-IDV-005, 006, 010, FR-WEB-012, BR-007, BR-094, PRM-28, D04 | KMS for the key (OD-20) |
| 13 (done) | Registration in FastAPI: route, consent, profile, area, referral, survey, progress, passport sign-in, area lists | FR-AUTH-005, 009 to 013, FR-REG-001, 003, 008, 009, 017, 026, 027, 029 to 033 | OD-15 (minimum age), POL-01 (notices) |
| 14 (done) | Recovery number with SMS one-time codes behind an interface, recovery, assisted recovery, registration rate limits | FR-REG-028, FR-AUTH-014 to 017, 023 (part), 026 | SMS vendor (INT-01) |
| 14b (done) | Sessions list and revoke, idle expiry, new-device notices, staff TOTP | FR-AUTH-019 to 021, 025 (part), FR-STF-001 (part), NFR-SEC-04, NFR-SEC-11 | — |
| 14c | Step-up codes, suspicious sign-ins, refresh rotation, passkeys, lost-device wipe, quarterly access reviews | FR-AUTH-018, 022, 025, 027, FR-STF-010 | Push (INT-02), staff identity provider (INT-09) |
| 15 (done) | Member card: rotating signed QR, scanning, revocation | FR-CARD-001 to 015, FR-ADM-001, 002, FR-STF-005 | Wallet passes (INT-03), OD-08 |
| 15b (done) | Security fixes from the 25 October review: authenticator lockout per factor, Express honours ended sessions, no phone-number probing, duplicate reports only from an open review, staff actions ranked by tier | NFR-SEC-04, NFR-SEC-11, FR-STF-001, FR-REG-028, PRM-03, RB-03 | Lockout figures (sponsor) |
| 15c (done) | The review's low findings: sign-in attempts counted before the password check under a lock both APIs share, repeated refusals tallied, a daily upload cap, sign-out only from a working session, code limits per purpose, recovery SMS after the answer | NFR-SEC, FR-ARCH-002, FR-AUTH-014, BR-023 | Upload cap figure (sponsor) |
| 16 (done) | Events foundation: listing, RSVP with history and waitlist, event passes, check-in, roster, event console | FR-EVT-001 to 003, 005, 007, 009 to 017, FR-ADM-004, FR-STF-006 (API) | OD-12 (pass eligibility, volunteer scanning); reminders need scheduled tasks |
| 17 (done) | Home (layout, one next step, locks with reasons, hub) and gallery (albums, photo processing, removal requests, media console, 24-hour queue) | FR-HOME-001 to 008, 012, 013, FR-GAL-001 to 005, 007, FR-ADM-005, 006 (API) | Feature policy for pending members and the approver rule (sponsor); notifications for FR-HOME-009 to 011 and the 18-hour alert |
| 18 (done) | Profile (locked legal details, display name, My Activity, survey answers, identity-data notice), GN area change with proof, password change, data-subject requests and the DPO register | FR-PROF-001 to 006, 009, 010, 014, 017 to 019 (API) | FR-PROF-008 (versioned identity change), 012 (messaging); the DPO permission and the statutory period (DPO) |
| 19 (done) | Notifications: in-app inbox with Action needed, outbox notices from decisions, channel choices and quiet hours, push behind an interface, staff broadcasts with approval, the dispatcher (also the 18-hour removal alert) | FR-REG-021, FR-ADM-007, FR-STF-009, FR-HOME-009 to 011, FR-PROF-012, FR-MSG-004, 007, 008 (API) | Push credentials (INT-02); SMS and WhatsApp vendors (INT-01, INT-14) for FR-MSG-001 to 003, 006 |
| 20 (done) | Feature flags with recorded phase gates; election periods with silence windows (publishing refused, announcements held), the member banner and labelled notices; manual event check-in by member ID | FR-ARCH-011, NFR-ELC-01, 03, 05, 06, 08, FR-ELX-001, 004, 008, 010, FR-VOI-007 (API) | POL-12 (what counts as campaign content); NFR-ELC-02 is an operating procedure and NFR-ELC-04 waits for the finance module |
| 21–24 | Screens: member app (A, H01–H04, E, C, G, P), dashboard (W01, W02, W09, D03–D06), staff app core (S01–S04, S08–S10, S13, S14) | — | UX approval of new screens (Phase 0) |
| 25 | Capture quality and OCR | FR-IDV-001 to 004 | OD-42 for server-side OCR |

## Phase 2: community service and accountability

Community issues and the case workflow (FR-RPT, FR-WEB-014 to 029); volunteering (FR-VOL); ideas and development proposals (FR-IDEA, FR-DEV); Community Support and households with row-level security (FR-AST, FR-HH); Promise Tracker and scorecards (FR-PRM, FR-ACS); town halls (FR-THL); election information (FR-ELX, legal approval); official content and fact-checking (FR-AUT); staff field visits (FR-FLD); bank-transfer fund, surveys, learning, referrals (FR-FUND, FR-SRV, FR-LRN, FR-REF); official alerts (FR-DIS); WhatsApp (FR-MSG). Waiting on: POL-05 to POL-09, POL-12, POL-13, the WhatsApp provider, DEP-19 legal opinions.

## Phase 3: advanced participation and AI

Tamil AI assistant (FR-AIA, OD-42); participatory budgeting (FR-PBG); payment gateway (FR-PAY, OD-27, OD-40); diaspora (FR-DSP); wings and committees (FR-COM); voice (FR-VOI); livelihood guide (FR-LIV); blood donors (FR-BLD); disaster relief (FR-DIS); liveness and face comparison only if OD-28 approves (FR-IDV-007 to 009); advanced analytics; Eastern Province.

## Decisions only the sponsor can make

The G0 open decisions (BRD §22) block parts of every phase: OD-01 reviewers, OD-02 activation, OD-03 retention, OD-04 assisted verification, OD-07 and OD-27 payments, OD-20 hosting, OD-28 and OD-29 biometrics, OD-42 AI provider. The code records each assumption it makes in their place, so it can be changed when they are decided.
