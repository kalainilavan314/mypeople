# Requirements

The requirements are the **Business Requirements Document v1.1, "My People (என் மக்கள்)", MP-BRD-001**, a draft for stakeholder review. It is confidential and is not stored in this repository; the project owner holds it (`BRD — My People.docx`).

v1.1 contains 466 functional requirements, 160 business rules, 174 screens, 70 data entities and 48 open decisions. Every v1.1 module is "Proposed" until the sponsor signs it, and each is meant to sit behind a feature flag until its phase gate is recorded (FR-ARCH-011).

## Sections used most during development

| Section | Topic |
|---|---|
| §9 | Organisation, tiers, permissions (RB-01 to RB-07), the four independent state systems |
| §11 | Functional requirements by module (AUTH, REG, HOME, RPT, EVT, CARD, ARCH, IDV, HH, AST, …) |
| §12 | Business rules |
| §13 | Data entities, classification, retention, schemas and migrations |
| §14 | Non-functional requirements (security, privacy, accessibility, performance) |
| §15A | Technical architecture: stack, modules, API catalogue, DevOps |
| §15B | AI/ML specification |
| §20 | Phases: 0 governance, 1 secure core, 2 community and accountability, 3 advanced participation and AI |
| §22 | Open decisions |

## Implemented so far

| Requirement | What exists | Where |
|---|---|---|
| FR-ARCH-002 | Server-side session, permission and area checks; refusals return 403 and are logged (processing-purpose checks still to come) | `services/api/app/modules/auth`, `access` |
| RB-01 to RB-07, BR-083, BR-084 | Staff assignments: tier + explicit permissions + area; grantor and time recorded; RB-03 limits; preview; 12-month review for explicit grants; nothing granted automatically | `services/api/app/modules/access` |
| BR-097 (part) | Staff need a confirmed identity; membership "Active" waits for the membership module | `access/rules.py` |
| RB-12 [ASSUMPTION] | Assistance decisions refused alongside fundraising or election-roster rights | `access/permissions.py` |
| FR-WEB-030 to 033 (API) | Select a verified person, area and permissions; preview; refuse grants beyond the administrator's own; revocation on the next request. The W09 screen and notifications are not built | `/v1/access` |
| FR-ADM-011 (part) | Searchable, tamper-evident audit log with chain verification; export not built | `/v1/audit` |
| FR-ARCH-007, INT-08 (part) | Identity images in private, encrypted storage; served only through a 5-minute link for one reviewer, issued after the permission and area check | `services/api/app/modules/identity` |
| BR-086, FR-WEB-005 (API) | Every link, view and refusal of identity evidence is logged | `identity/service.py` |
| FR-AUTH-024 (API) | Members see the date of each view and "Identity reviewer" | `/v1/identity/me/evidence-views` |
| FR-REG-004, 005, 010, BR-020 (API) | NIC front and back (also passport page and selfie) uploaded separately, one side replaceable; JPEG, PNG or HEIC up to 10 MB; the response is the acknowledgement | `/v1/identity/me/documents` |
| BR-021, FR-PROF-007 (API) | No way for a member to fetch their identity images | `/v1/identity` |
| BR-085 (part) | Nobody opens, claims or decides their own identity review or evidence; relatives are not recorded yet | `access/service.py` (`check_record_scope`) |
| PRM-03, PRM-04 | Evidence opens only inside the reviewer's own open review; decisions need `members.verify` over the member's area | `identity`, `verification` |
| FR-REG-019, 020, 022, 023, 025 (API) | Submission with a VR reference and no duplicates; states; the exact items to correct with the note; a correction returns to the same review; the reason category for Unable to verify | `/v1/identity/me/review` |
| FR-WEB-001 to 004 (API) | Queue limited to the reviewer's areas with counts; search by review reference; claim with the owner shown; no bulk decision | `/v1/identity/reviews` |
| FR-WEB-007 to 011, 013 (API) | Checklist before Approve; exactly three decisions; items and reason for Request an update; reason for Unable to verify; immutable decision with reviewer, time, reason and evidence versions; no deciding one's own record | `verification/rules.py`, Alembic `0004` |
| BR-011 to 014, BR-081, BR-082 | Declaration; only a human with `members.verify` decides; corrections name the item; identity, membership and access stay separate | `verification` |
| FR-PROF-006 (API) | The member's review history with decision, reviewer tier and date | `/v1/identity/me/review` |
| FR-IDV-013, PRM-29, M04 and D05 (API), §15B.4 | One appeal per Request-update or Unable-to-verify decision, up to 1,000 characters; decided by a holder of `idv.appeal.decide`, never the original reviewer; uphold or overturn with a reason the member sees; the 10-working-day target is not tracked yet | `services/api/app/modules/verification_appeals` |
| FR-AUTH-027 (part) | An assignment with an overdue review stops counting; the review workflow is not built | `access/repository.py` |
| FR-ARCH-003, NFR-ARCH-02 | Versioned `/v1` REST API documented in OpenAPI 3.1 | `services/api`, `packages/api-client/openapi.json` |
| FR-ARCH-006 (part) | CI runs builds and tests; security scans and the production approval gate are still missing | `.github/workflows/ci.yml` |
| FR-ARCH-010 | One design-token package for the new apps | `packages/design-tokens` |
| FR-AUTH-021 | Revoking sessions ends every session of the member at once | both APIs |
| AP-06, NFR-ARCH-01 | Modular monolith with one folder per module | `services/api/app/modules` |
| AP-07 (part) | Tamil and English text shared; parity checked, 82 older gaps recorded | `packages/i18n` |
| §13.8 migrations | Alembic, forward-only, baseline guarded, run in CI | `services/api/alembic` |

## Open decisions that block upcoming work

| Decision | Blocks |
|---|---|
| OD-26 One role-aware app or two published apps | Staff app distribution (built as a separate app for now, as the BRD recommends) |
| OD-01, OD-02 Who verifies identity; how membership is activated | Assigning reviewers in production; membership activation (approval confirms identity only) |
| OD-03 Retention of ID images, selfies, decisions | Deleting identity images (FR-IDV-015); every version is kept until decided |
| OD-28, OD-29 Acceptable biometric processing and retention | Liveness and face comparison |
| OD-42 AI provider and hosting | `services/ai-worker` |
| OD-20 Hosting location and cross-border transfer | Production architecture |
