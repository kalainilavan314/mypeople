# Delivery plan

How the rest of BRD v1.1 gets built, in what order, and what "done" means. The screens and where each one goes are in [screen-map.md](screen-map.md); what is built so far is in [README.md](README.md). The BRD commits no dates or team size (§20.2), so this plan sets the order, the size in batches and the gates, not a calendar.

## Where we stand (27 October 2026)

| | Built | Of | Share |
|---|---|---|---|
| Functional requirements | 154 (3 in part) | 466 | 33% |
| Business rules | 30 | 160 | 19% |
| Non-functional requirements (recorded by ID) | 11 | 91 | 12% |
| Screens | 54 | 174 | 31% |

The built work is in the FastAPI service, the Expo member and staff apps and the Next.js dashboard. **None of it is live yet**: members use the PWA and Express API (`app/`, `server/`). Until the new stack goes live, every member-facing fix is made twice.

## How every batch is done

One module at a time, as a vertical slice, never screens without the rules behind them (`CLAUDE.md`: no screen that pretends a feature works):

1. **Rules first.** The module's functional requirements, business rules and the non-functional ones it touches, in the API: rules as plain functions, permission and area checks on the server, audit entries, migrations. Tests against a real database.
2. **Then its screens**, in the app and place [screen-map.md](screen-map.md) gives, from the shared components (`packages/mobile-ui`, the dashboard's components), with every state the API can return: loading, empty, refused, error, offline.
3. **Accessibility (NFR-ACC-05, WCAG 2.2 AA)** on every new screen: text contrast 4.5:1, status never by colour alone, touch targets at least 44 px, visible focus that is never hidden behind a bar (2.4.11), no drag-only actions (2.5.7), help in the same place on every screen (3.2.6), no re-entering what the member already gave (3.3.7), sign-in without memory tests (3.3.8), text readable and unclipped at 200%, Tamil and English labels, checked with TalkBack and VoiceOver on a phone.
4. **Checks that must pass**: API tests and the fresh-database run; typecheck, lint and build of every app touched; Android export of the Expo apps; the automated accessibility checks.
5. **Records**: the screen map's status, the coverage counts in [README.md](README.md), the API reference and the A–H report, in the same commit. Tamil text is marked for native review.

A screen whose decision is not taken stays "Blocked" in the screen map with the decision named. Nothing is built as a placeholder.

## Milestones

### M0: Foundations (3 batches, before more screens)

| Batch | Work | Done when |
|---|---|---|
| F1 (done) | Screen placement: the screen map; the README-only folders `assistance`, `household`, `ideas`, `issues`, `promises` moved into `apps/member-mobile/app/(member)` and `field-visits` into `apps/staff-mobile/app/(staff)`, so new screens sit behind sign-in; `identity-reviews` moved as `(staff)/assisted-verification`, narrowed to S04, because the BRD keeps the verification queue on the dashboard (W01, W02); the four overlaps below settled | Every screen has one place; no folder outside the signed-in groups |
| F2 (part done) | Accessibility kit: the WCAG 2.2 AA checklist above as a document; lint rules for accessibility in the dashboard and both Expo apps, and automated page checks on the dashboard in CI; shared components meet the checklist; audit and fix the 54 built screens. Done: the checklist (`docs/development/accessibility-checklist.md`), the dashboard's accessibility lint, contract checks for the shared components and a scan of every member and staff screen (`scripts/accessibility/`, run by `npm run test:packages` in CI), which found and fixed two unnamed logos. Left: automated page checks on the dashboard; a TalkBack and VoiceOver pass on a phone | The audit's findings are fixed or listed with a reason |
| F3 | Go-live plan for the new stack: FastAPI beside Express on the same database (the strangler plan), its storage and keys, the notifications timer, the member app on an internal test track, the dashboard behind Nginx | The plan is approved and the decisions it needs are taken (see the table below) |

Overlaps in the BRD, settled on 27 October 2026 by the project owner so no screen is built twice:

| Screens | One place |
|---|---|
| H13 Community ideas, M15–M17 Development ideas | One Ideas area with two kinds of entry, `(member)/ideas` (the sponsor can still ask for two) |
| H07 Report a concern, M43 Voice report | Voice is an input option inside H07, `(member)/issues` |
| P05 Account settings, M45 Messages and channels | M45 is added to the P05 settings screen, `(member)/profile/settings.tsx`; no second settings screen |
| H12 My assignment, M30 Duty roster | Election duties appear in the same assignments list, `(member)/volunteer` |

### M1: Finish Phase 1, then Gate G1

| Batch | Work | Screens |
|---|---|---|
| 1.1 (done) | Screens whose API is already built and tested. A15, A18, C02, M04, D01, D07, D08, D09, D34 (Puvi branch); A17, C03, M45 SMS part, D22, D35 (Batch 1.1) | A15, A17, A18, C02, C03, M04, M45 (SMS part), D01 (queue counts), D07, D08, D09, D22, D34, D35 |
| 1.2 (part done) | Rest of account security: step-up codes for new devices (FR-AUTH-022), passkeys, lost-device wipe (FR-STF-010). Done: staff "Devices and sessions" screen, so a lost phone is signed out from another device and wipes its tokens on its next contact. Left: step-up codes (they reach the member by SMS, so they wait on INT-01 to work in production), passkeys, and signing out another person's device from D31 (needs a permission the BRD does not name) | Additions to M49/M50 and D31 |
| 1.3 (part done) | Capture quality and OCR confirmation (FR-IDV-001 to 004). Done: M01 capture advice on the server (blur, darkness, glare, size). Left: edge visibility, tuning on consented test photos (DEP-16), and M02 OCR, which waits on OD-42 | M01, M02 |
| 1.4 (part done) | Remaining Phase 1 requirements: registration, identity, web review, administration, architecture, staff app, card sharing and progress. Done: C04 share, C05 (Puvi branch). S10 moves to 2.2: a coordinator's offer needs the volunteer's side (H10 to H12) to be seen and answered, so building it alone would send offers nobody receives | C04 (share; wallet waits on INT-03), C05, S10 |
| 1.5 | Assisted verification | M05, S04 |
| Go-live | Run the F3 plan: the new API, member app and dashboard live; then the BRD's one-month pilot in selected GN divisions | — |

**Gate G1** (BRD §20.2): the phase's Must requirements pass user acceptance testing; WCAG 2.2 AA on the new screens; an independent penetration test with no open critical or high findings; a privileged-access review (built: D31); a key-management audit; the pilot reaches at least 70% registration completion and at least 90% of reviews within 5 working days. Sign-off: Sponsor, Tier 5, DPO, vendor.

The [G1 evidence procedure](gate-g1.md) records the verification and pilot results. Its validator cannot grant approval or replace the external reviews.

After a successful pilot the PWA takes fixes only, members move to the new apps, and Express is retired once FastAPI covers everything it serves.

### M2: Phase 2, community service and accountability, then Gate G2

In dependency order: issues come first because scorecards are computed from them.

| Batch | Module | Screens |
|---|---|---|
| 2.1 | Community issues and the case workflow (FR-RPT, FR-WEB-014 to 029) | H05–H09, W03–W08 |
| 2.2 | Volunteering, surveys, learning, referrals | H10–H16, H19–H21, S10 |
| 2.3 | Ideas and development proposals (one Ideas area) | H13, M15–M17, D15 |
| 2.4 | Promise Tracker and accountability scorecards | M18–M20, D16, D17 |
| 2.5 | My Household and Community Support (DPIA update, row-level security) | M06–M14, S11, S12, D02, D13, D14 |
| 2.6 | Town hall and election mode | M21–M23, D18, M29, M30, S15 |
| 2.7 | Official content and fact-checks | M47, M48, D12, D30 |
| 2.8 | Field operations with offline sync | S05–S07, D24 |
| 2.9 | Party fund by bank transfer, WhatsApp, official alert relay, renewal | H17, H18, D10, M45 (WhatsApp), M35, M33, M34, D25 |

**Gate G2**: the neutrality audit design and the scorecard publication policy approved; DPIA updated for assistance, household and field data; row-level security tests; a penetration test of the new modules; the signing-key ceremony for official content; assistance piloted in one district with partner NGOs; scorecards published internally for one quarter first.

### M3: Phase 3, advanced participation and AI, then Gate G3

| Batch | Module | Screens |
|---|---|---|
| 3.1 | Tamil AI assistant, knowledge base and model registry | M28, D20, D21 |
| 3.2 | Participatory budgeting | M24–M27, D19 |
| 3.3 | Payment gateway beside bank transfer | M51, M52, D11 |
| 3.4 | Wings and committees | M31, M32, S18, D23 |
| 3.5 | Meet your representative | M41, M42, S17, D29 |
| 3.6 | Disaster relief, blood donors, livelihood guide | M36, S16, D26, M37–M40, D27, D28 |
| 3.7 | Voice, data saver, diaspora | M43 (in H07), M44, M46 |
| 3.8 | Liveness and face comparison, only if OD-28 approves; analytics; Eastern Province rollout | M03, D32 |

**Gate G3**: each feature meets its evaluation thresholds (BRD §15B.3); model shadow-mode and fairness reviews; PCI scoping; app-store pre-clearance for payments; pilots in one district and selected Eastern Province GN divisions.

## Decisions needed, and by when

| Decision | Blocks | Needed before |
|---|---|---|
| OD-20 Hosting | The new stack going live | F3 |
| OD-19 Member ID format (BRD: `MP-NNNNN`; live: `WTL-26-…`) | Go-live, cards | F3 |
| OD-03 Retention of identity images | Identity uploads in production | F3 |
| INT-01 SMS vendor | Codes, recovery and alerts in production | F3 |
| INT-02 Push, INT-09 staff identity provider | Step-up codes, lost-device wipe, staff sign-in at scale | 1.2 |
| OD-42 OCR and AI provider | M02, the AI assistant | 1.3, 3.1 |
| OD-04 Assisted verification | M05, S04 | 1.5 |
| INT-03 Wallet passes | C04 wallet | 1.4 |
| Purpose of each joining-survey question (BR-090, DPO) | A15 | 1.1 |
| DEP-19 Legal opinions, POL-05 to POL-09, POL-12, POL-13 | Election information and the Phase 2 modules | M2 |
| INT-24 Signing keys in KMS | D30, M47 | 2.7 |
| OD-43 Renewal | M33, M34, D25 | 2.9 |
| OD-27, OD-40 Payments | M51, M52, D11 | 3.3 |
| OD-39 Blood donors | M37, M38, D27 | 3.6 |
| OD-28, OD-29 Biometrics | M03 | 3.8 |

The code records each assumption in its place, so it can change when a decision is taken.

## How progress is reported

After every batch: the A–H report (`CLAUDE.md`), the screen map's statuses and the coverage counts above. At each gate: the gate's exit criteria with evidence. Releases follow `deployment/README.md` and are recorded there.

## Completed batches

| Batch | Scope | BRD | Waiting on |
|---|---|---|---|
| 11 (done) | Membership states and activation; staff need Active membership | FR-ADM-003, PRM-05, BR-014, BR-015, BR-097, FR-REG-024, FR-CARD-014 | OD-02 (auto-activation stays off until decided) |
| 12 (done) | Duplicate identities by keyed hash, investigations | FR-IDV-005, 006, 010, FR-WEB-012, BR-007, BR-094, PRM-28, D04 | KMS for the key (OD-20) |
| 13 (done) | Registration in FastAPI: route, consent, profile, area, referral, survey, progress, passport sign-in, area lists | FR-AUTH-005, 009 to 013, FR-REG-001, 003, 008, 009, 017, 026, 027, 029 to 033 | OD-15 (minimum age), POL-01 (notices) |
| 14 (done) | Recovery number with SMS one-time codes behind an interface, recovery, assisted recovery, registration rate limits | FR-REG-028, FR-AUTH-014 to 017, 023 (part), 026 | SMS vendor (INT-01) |
| 14b (done) | Sessions list and revoke, idle expiry, new-device notices, staff TOTP | FR-AUTH-019 to 021, 025 (part), FR-STF-001 (part), NFR-SEC-04, NFR-SEC-11 | — |
| 14c (part done) | Done: suspicious sign-ins with M50 alerts, refresh-token rotation with reuse detection, quarterly access reviews with D31. Left: step-up codes, passkeys, lost-device wipe | Done: FR-AUTH-018, 025, 027, NFR-SEC-12, 13 (part). Left: FR-AUTH-022, FR-STF-010 | Push (INT-02), staff identity provider (INT-09); who reviews the Tier 5 grant (sponsor) |
| 15 (done) | Member card: rotating signed QR, scanning, revocation | FR-CARD-001 to 015, FR-ADM-001, 002, FR-STF-005 | Wallet passes (INT-03), OD-08 |
| 15b (done) | Security fixes from the 25 October review: authenticator lockout per factor, Express honours ended sessions, no phone-number probing, duplicate reports only from an open review, staff actions ranked by tier | NFR-SEC-04, NFR-SEC-11, FR-STF-001, FR-REG-028, PRM-03, RB-03 | Lockout figures (sponsor) |
| 15c (done) | The review's low findings: sign-in attempts counted before the password check under a lock both APIs share, repeated refusals tallied, a daily upload cap, sign-out only from a working session, code limits per purpose, recovery SMS after the answer | NFR-SEC, FR-ARCH-002, FR-AUTH-014, BR-023 | Upload cap figure (sponsor) |
| 16 (done) | Events foundation: listing, RSVP with history and waitlist, event passes, check-in, roster, event console | FR-EVT-001 to 003, 005, 007, 009 to 017, FR-ADM-004, FR-STF-006 (API) | OD-12 (pass eligibility, volunteer scanning); reminders need scheduled tasks |
| 17 (done) | Home (layout, one next step, locks with reasons, hub) and gallery (albums, photo processing, removal requests, media console, 24-hour queue) | FR-HOME-001 to 008, 012, 013, FR-GAL-001 to 005, 007, FR-ADM-005, 006 (API) | Feature policy for pending members and the approver rule (sponsor); notifications for FR-HOME-009 to 011 and the 18-hour alert |
| 18 (done) | Profile (locked legal details, display name, My Activity, survey answers, identity-data notice), GN area change with proof, password change, data-subject requests and the DPO register | FR-PROF-001 to 006, 009, 010, 014, 017 to 019 (API) | FR-PROF-008 (versioned identity change), 012 (messaging); the DPO permission and the statutory period (DPO) |
| 19 (done) | Notifications: in-app inbox with Action needed, outbox notices from decisions, channel choices and quiet hours, push behind an interface, staff broadcasts with approval, the dispatcher (also the 18-hour removal alert) | FR-REG-021, FR-ADM-007, FR-STF-009, FR-HOME-009 to 011, FR-PROF-012, FR-MSG-004, 007, 008 (API) | Push credentials (INT-02); SMS and WhatsApp vendors (INT-01, INT-14) for FR-MSG-001 to 003, 006 |
| 20 (done) | Feature flags with recorded phase gates; election periods with silence windows (publishing refused, announcements held), the member banner and labelled notices; manual event check-in by member ID | FR-ARCH-011, NFR-ELC-01, 03, 05, 06, 08, FR-ELX-001, 004, 008, 010, FR-VOI-007 (API) | POL-12 (what counts as campaign content); NFR-ELC-02 is an operating procedure and NFR-ELC-04 waits for the finance module |
| 21 (done) | Member app screens on `/v1`, from the approved PWA designs: A01 to A13, A16, H01 to H04, E01 to E06, C01 and C06, G01 to G03, P01 to P06 | Screens for the API batches above; FR-VOI-007 (photo library as the manual route) | Tamil review of the new text; the ID-card artwork, PDF and wallet on the Card tab; push (INT-02) |
| 22 (done) | Dashboard: staff sign-in with the second factor, W01, W02 with evidence links, D03 notice, D04, D05, D06, W09, audit log | FR-WEB-001 to 013, 030 to 033, FR-ADM-003, 011 (screens) | Evidence watermark (FR-WEB-006); screening (OD-42) |
| 23–24 (done) | Staff app: S01 with the second factor, S02, S03, S08 with the camera and the member-ID route, S09, S13, S14; shared mobile components moved to `packages/mobile-ui`; `GET /v1/membership/lookup` and `GET /v1/access/assignments` | FR-STF-001, 003, 005, 006, 009, FR-ADM-001, 002 | S04 (OD-04), S10 (volunteering), offline use and device wipe (FR-STF-010) |
