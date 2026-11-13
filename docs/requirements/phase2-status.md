# Phase 2 build status (MP-FEA-002)

What exists for Phase 2, *Community Service and Accountability*, against the Phase 2 Feature and Function List (MP-FEA-002 v1.0). Built 12 to 13 November 2026.

**Nothing here is live for members yet.** Every Phase 2 module sits behind its own switch, off in production until a Tier 5 records Gate G2 and turns it on (`/v1/features`, FR-ARCH-011). Home shows each switched-off service as "not open yet". The decisions in the last section still apply before any of them goes live.

## By feature area

| Area | Screens | API | Member app | Staff section | Dashboard | Switch |
|---|---|---|---|---|---|---|
| My Area and issue reporting (RPT) | H05 to H09 | `/v1/issues` | Built | — | — | `community_issues` |
| Case escalation (WEB) | W03 to W08 | `/v1/cases` | — | — | `/cases` | `community_issues` |
| Volunteering (VOL) | H10 to H12, S10 | `/v1/volunteering` | Built | `staff/volunteers` | `/volunteering` | `volunteering` |
| Ideas and surveys (IDEA, SRV) | H13, H14, H21 | `/v1/ideas`, `/v1/surveys` | Built | — | `/moderation`, `/surveys` | `ideas_surveys` |
| Learning (LRN) | H15, H16 | `/v1/learning` | Built | — | `/learning` | `learning` |
| Invitations (REF) | H19, H20 | `/v1/invitations` | Built (with `join/[token]`) | — | — | `invitations` |
| My Household (HH) | M06 to M10, D02 | `/v1/households` | Built earlier | — | Built earlier | `households` |
| Community Support (AST) | M11 to M14, S11, S12, D13, D14 | `/v1/assistance` | Built (`support`) | — | `/support` (intake, case file, programmes, statistics) | `community_support` |
| Development ideas (DEV) | M15 to M17, D15 | `/v1/proposals` | Built | — | `/development` | `development_proposals` |
| Promise Tracker (PRM) | M18, M19, D16 | `/v1/promises` | Built | — | `/promises` | `promises` |
| Scorecard (ACS) | M20, D17 | `/v1/scorecards` | Built | — | `/scorecards` | `scorecards` |
| Town hall (THL) | M21 to M23, D18 | `/v1/town-halls` | Built (stream links once a provider is chosen) | — | `/town-halls` | `town_halls` |
| Election duty roster (ELX) | M30, S15 | `/v1/election/roster` | Built (with My assignment) | — | `/roster`, `/elections/[id]/roster` | `election_roster` |
| Field visits (FLD) | S05 to S07, D24 | `/v1/field` | — | `staff/field-visits` (offline) | `/field` | `field_visits` |
| Fact-checks (AUT, part) | M48 (reporting), D12 | `/v1/fact-checks` | Built (`official`) | — | `/moderation` | `fact_checks` |

S11, S12 and S15 are on the dashboard, not in the app's Staff section: intake, the support case file and the roster manager are desk work with long forms. A Staff section version can follow if field staff need them on the phone.

Checks on 13 November 2026: the full API suite on a fresh database, the dashboard's typecheck, lint, tests and build, the member app's typecheck, dependency check and Android and web exports, and the shared packages. A visual check of the member app's Phase 2 screens against a local demo database.

## Not built, and why

| Item | Waiting for |
|---|---|
| M29 Election information | DEP-19 legal opinion |
| M47 Official updates, D30 signing, checking a statement by code (FR-AUT-001 to 005) | INT-24 signing keys in KMS |
| M33, M34, D25 Renewal and certificates | OD-43 renewal policy |
| AI topic, duplicate and summary suggestions; semantic search (FR-DEV-004, 005; AI-07 to 09) | OD-42 AI provider and hosting. Proposal search matches words meanwhile |
| Live video stream in the town hall | OD-44, DEP-20 streaming provider. Sessions keep the provider's links once known |
| Voice questions with Tamil speech-to-text (AI-11) | OD-42 |
| A map of the GN on My Area | GN boundary data; the list view is always there (FR-RPT-002) |
| WhatsApp channel | OD-45, DEP-21 |

## Assumptions to confirm (marked [ASSUMPTION] in the code)

- Case stage limits: GN 3, DS 7, district 10, regional 15, executive 10 working days, Monday to Friday, no public holidays (OD-10, BRD §4.3).
- One support per idea; 5 ideas, 5 proposals, 10 reports, 10 fact-check reports and 20 invitations a day per member.
- Closure challenges within 30 days (FR-RPT-016); assistance appeals decided within 15 working days (FR-AST-011).
- Field visits deleted after 12 months, monthly counts kept (OD-38).
- Course publishing by `content.moderate` holders (the BRD names no permission).
- Town hall reminders go to members who tapped "Remind me", not to everyone in the area.

## Before switching a module on

1. Merge the Phase 2 pull request and deploy it. The Alembic revisions are 0033 to 0041: new schemas and tables only, nothing existing changes.
2. Record the decision the module waits for (the table in MP-FEA-002 §9: OD-10, 13, 21, 24, 30 to 35, 37, 38, 42 to 45).
3. Give the staff roles their permissions (W09): `cases.*`, `volunteers.manage`, `surveys.manage`, `dev.review`, `dev.approve_planning`, `promise.edit`, `promise.publish`, `scorecard.publish`, `assistance.*`, `townhall.produce`, `townhall.moderate`, `field.collect`, `election.roster.manage`, `content.moderate`.
4. A Tier 5 records Gate G2 for the module in `/v1/features` and switches it on.
