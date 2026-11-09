# Requirements

The requirements are the **Business Requirements Document v1.1, "My People (என் மக்கள்)", MP-BRD-001**, a draft for stakeholder review. It is confidential and is not stored in this repository; the project owner holds it (`BRD — My People.docx`).

v1.1 contains 466 functional requirements, 160 business rules, 174 screens, 70 data entities and 48 open decisions. Every v1.1 module is "Proposed" until the sponsor signs it, and each is meant to sit behind a feature flag until its phase gate is recorded (FR-ARCH-011).

The order of the remaining work, its gates and the decisions it waits on are in the [delivery plan](roadmap.md); the place of every screen, and whether it is built, is in the [screen map](screen-map.md).

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
| BR-097 | Staff need a confirmed identity and an Active membership; rights stop while membership is not Active | `access/rules.py`, `access/repository.py` |
| FR-ADM-003 (API), PRM-05, BR-014, BR-015 | Activate, suspend, reinstate and inactivate with a reason; identity approval does not activate membership; notifications not built | `services/api/app/modules/membership` |
| FR-REG-024, FR-CARD-014 (API part) | The member's membership state and reason code, for A12 and C06 | `/v1/membership/me` |
| RB-12 [ASSUMPTION] | Assistance decisions refused alongside fundraising or election-roster rights | `app/core/permissions.py` |
| FR-WEB-030 to 033 (API) | Select a verified person, area and permissions; preview; refuse grants beyond the administrator's own; revocation on the next request. The W09 screen and notifications are not built | `/v1/access` |
| FR-ADM-011 (part) | Searchable, tamper-evident audit log with chain verification; export not built | `/v1/audit` |
| FR-REG-021, FR-HOME-009 to 011, FR-PROF-012, FR-STF-009, FR-ADM-007, FR-MSG-004, 007, 008 (API) | Notices written with the decision they report; inbox with All and Action needed (read separate from done); push and SMS choice per topic with account and review locked; quiet hours; push behind an interface with the inbox as fallback; staff broadcasts by area with preview, ID-number check, scheduling and approval above district | `/v1/notifications` |
| FR-PROF-001 to 006, 009, 010, 014, 017 to 019 (API) | Profile with locked legal details and a separate display name, masked number, My Activity, survey answers deletable, identity-data notice, GN area change with proof reviewed in the new area, password change with the current one, copy and closure requests with receipts and a DPO register | `/v1/profile`, `/v1/auth/password`, `/v1/privacy` |
| FR-HOME-001 to 008, 012, 013 (API) | Home decided by the server: H01 only for Verified and Active members, one next step, the next event nearby, locked features with a reason and next step, the hub with the party fund after civic services | `/v1/home` |
| FR-GAL-001 to 005, 007, FR-ADM-005, 006 (API) | Published albums and photos without download; photos re-encoded without metadata; bilingual captions required; a second person publishes; removal requests with receipts, a 24-hour queue, remove, blur or keep with a reason, and the requester told | `/v1/content` |
| FR-EVT-001 to 003, 005, 007, 009 to 017 (API) | Events with "My area" as a removable default, filters, detail, RSVP with history and waitlist, event passes as 60-second codes bound to one event and member, check-in that records attendance once | `/v1/events` |
| FR-ADM-004, FR-STF-006 (API) | Event console: create, edit, publish, cancel with SMS to members who responded; attendance roster | `/v1/events` (staff) |
| FR-ARCH-011, D34 (API) | Each v1.1 module behind a flag, off in production until a Tier 5 records its phase gate and approval and turns it on; changes kept with reasons and audited | `/v1/features`, `services/api/app/modules/features` |
| NFR-ELC-01, 03, 05, 06, 08, FR-ELX-001, 004, 008, 010, FR-THL-008 (part), BR-119, BR-129 (API) | Election periods per type and area with their own silence window covering polling day; overlapping periods warned; publishing refused and announcements held during silence, audited; the member banner with the official source and countdown; notices labelled Election Commission or Party information, withdrawn when superseded; no vote fields (tested) | `/v1/election`, `services/api/app/modules/election` |
| FR-VOI-007 (part) | Event check-in by the member ID on the card when the pass cannot be scanned, with the same rules and a recorded reason; other camera or location steps already have a manual route (file upload, area lists) | `/v1/events/{id}/checkin/manual` |
| Screens A01 to A18, H01 to H04, E01 to E06, C01 to C06 (C04 share only), G01 to G03, P01 to P06, M04, M06 to M10, M45 (SMS part), M49, M50 | The Expo member app on `/v1`, following the approved PWA designs; Tamil and English; the session in the phone's secure store | `apps/member-mobile` |
| FR-REG-034, 035, BR-020, BR-021 (app) | A17: each photo shows whether the server holds it; an interrupted upload reads "Not yet received by the server" with Retry upload of the same photo; the app's cached copy is deleted after the server acknowledges it, or when replaced or abandoned | `apps/member-mobile/src/features/identity` |
| FR-CARD-008, 009 (part), FR-PROF-016, BR-066 | C03: the card last confirmed online is kept in the keychain or keystore with its time, shown offline without a QR as "Online check needed", retried every 30 seconds, offered on the welcome screen when the app opens offline; removed at sign-out, when the session ends or when the card is withdrawn | `apps/member-mobile/src/features/membership`, `packages/mobile-ui/src/lib/storage.ts` |
| FR-MSG-002, 004 (choices), M45 (SMS part) | Messages and channels in Settings: push and SMS per topic, the confirmed number texts go to (changed only with a code); the screen says texts start once the SMS vendor is connected (INT-01). STOP replies and WhatsApp are not built | `apps/member-mobile/app/(member)/profile/settings.tsx` |
| FR-VOI-004, 006 (part), M44 | Text size (Standard, Large, Larger) applied by the shared text components on top of the phone's setting, capped at twice the base size; a data saver that loads gallery photos only when tapped; both kept on the device and read before the first screen. Voice input and audio guidance wait for Phase 3 | `packages/mobile-ui/src/display`, `apps/member-mobile/app/(member)/profile/accessibility.tsx` |
| NFR-ACC-05 (part) | Every member and staff screen scanned in CI: switches named, pressable areas with a role, images named or marked decorative, text typed only through the shared field | `scripts/accessibility/mobile-screens-contract.mjs` |
| FR-STF-010 (part), FR-AUTH-020, 021 (staff app) | Staff "Devices and sessions": every signed-in device, sign out one or all others; the lost device's next request is refused and its app deletes its tokens and saved data | `apps/staff-mobile/app/(staff)/sessions.tsx` |
| FR-IDV-001 (part), AI-01, M01 | Capture advice on every uploaded ID photo or selfie: blurry, too dark, glare on ID pages, too small; returned with the upload acknowledgement and shown under the photo; advice only, the photo still counts. Simple image statistics, no AI provider; thresholds [ASSUMPTION] until tuned on consented test photos (DEP-16). Edge visibility (whole card in frame) not built | `services/api/app/modules/identity/documents/quality.py`, `PhotoRow.tsx` |
| C02 (MP-DEC-001 6.1) | Full brightness while the secure code is shown, the member's level restored on close, a manual hint where the phone refuses | `apps/member-mobile/src/features/membership/useFullBrightness.ts` |
| D22, FR-ELX-001, 004, 008 (screens) | Election mode in the dashboard (Tier 5, `election.mode.manage`): periods with their silence windows, declaring from an Election Commission publication with every refusal named at its field, overlap warnings, labelled notices published and withdrawn, ending or withdrawing a period with a reason. The duty roster, polling information and period report have no API yet | `apps/admin-web/src/app/(staff)/elections` |
| D35 (requests part), FR-PROF-018, 019 (screens) | The DPO's register of data-subject requests (`privacy.requests.handle`): soonest due first, overdue alert, complete or refuse with a note the member sees. Policy approvals and consent statistics have no API yet | `apps/admin-web/src/app/(staff)/privacy` |
| FR-STF-003 (API) | One member by exact member ID in the caller's areas, minimal fields; outside them the same 404 as an unknown ID; audited | `GET /v1/membership/lookup` |
| Screens W01, W02, D03 (notice), D04, D05, D06, W09 and the audit log | The dashboard: staff session in an HttpOnly cookie, the second factor each session, modules by role, evidence through 5-minute links | `apps/admin-web` |
| Screens S01 to S03, S08, S09, S13, S14 | The staff app: second factor, role context, tasks, member look-up, camera check-in with the member-ID route, roster, approvals, alerts | `apps/staff-mobile` |
| FR-ARCH-007, INT-08 (part) | Identity images in private, encrypted storage; served only through a 5-minute link for one reviewer, issued after the permission and area check | `services/api/app/modules/identity/documents` |
| BR-086, FR-WEB-005 (API) | Every link, view and refusal of identity evidence is logged | `identity/documents/service.py` |
| FR-AUTH-024 (API) | Members see the date of each view and "Identity reviewer" | `/v1/identity/me/evidence-views` |
| FR-REG-004, 005, 010, BR-020 (API) | NIC front and back (also passport page and selfie) uploaded separately, one side replaceable; JPEG, PNG or HEIC up to 10 MB; the response is the acknowledgement | `/v1/identity/me/documents` |
| BR-021, FR-PROF-007 (API) | No way for a member to fetch their identity images | `/v1/identity` |
| BR-085 (part) | Nobody opens, claims or decides their own identity review or evidence; relatives are not recorded yet | `access/service.py` (`check_record_scope`) |
| PRM-03, PRM-04 | Evidence opens only inside the reviewer's own open review; decisions need `members.verify` over the member's area | `identity/documents`, `identity/reviews` |
| FR-REG-019, 020, 022, 023, 025 (API) | Submission with a VR reference and no duplicates; states; the exact items to correct with the note; a correction returns to the same review; the reason category for Unable to verify | `/v1/identity/me/review` |
| FR-WEB-001 to 004 (API) | Queue limited to the reviewer's areas with counts; search by review reference; claim with the owner shown; no bulk decision | `/v1/identity/reviews` |
| FR-WEB-007 to 011, 013 (API) | Checklist before Approve; exactly three decisions; items and reason for Request an update; reason for Unable to verify; immutable decision with reviewer, time, reason and evidence versions; no deciding one's own record | `identity/reviews/rules.py`, Alembic `0004` |
| BR-011 to 014, BR-081, BR-082 | Declaration; only a human with `members.verify` decides; corrections name the item; identity, membership and access stay separate | `identity/reviews` |
| FR-IDV-010, FR-WEB-012, BR-094, PRM-28, D04 (API) | Same name and date of birth, or a reviewer's report, opens an investigation; flags on the review file; investigator decides with a reason; no automatic action on either account | `services/api/app/modules/identity/duplicates` |
| BR-007, FR-IDV-005 (NIC part) | One NIC per active account through the unique peppered NIC hash, checked at sign-up without reading any NIC; passport numbers wait for the registration batch | Express migration `0008`, `server/src/index.js` |
| FR-AUTH-005, 006, 010 to 013 (API) | Registration on the NIC or passport route with format checks, password policy and terms consent; one account per ID number; passport sign-in; one generic sign-in error | `services/api/app/modules/identity/registration`, `auth` |
| FR-REG-001, 003, 008, 009, 017, 026, 027, 029 to 033, FR-AUTH-009 (API) | Route choice, identity consent before uploads, passport fields, details with derived age, top-down area lists, optional referral and survey, registration progress | `identity/registration`, `geography` |
| BR-001, BR-003, BR-005, BR-006, BR-008, BR-016, BR-017, BR-019 | Language, one route per account, passport route without NIC data, format checks, consent before upload, age from date of birth, dependent areas, optional survey | `identity/registration/rules.py` |
| FR-REG-028, FR-AUTH-014 to 017, 026, BR-023, BR-024 (API) | Recovery number confirmed by code; recovery codes only to it, with neutral answers; 10-minute codes, five guesses; reset ends every session and notifies; assisted recovery with a reference and a reviewers' queue | `services/api/app/modules/identity/recovery` |
| FR-AUTH-023 (part) | The old number is told of a change and the change time is kept; the 24-hour delay waits for a high-risk action to exist | `identity/recovery/service.py` |
| FR-AUTH-019 (part), 020, 021, 025 (part), NFR-SEC-11 (API) | Session list with device labels; end one or all others, refused on the next request; 30-day idle expiry; new-device notice by SMS | `services/api/app/modules/auth` |
| FR-STF-001 (part), NFR-SEC-04 (API) | Staff authenticator (TOTP) required in each session before staff endpoints; the role and area header is a screen task | `auth/totp.py`, `access/dependencies.py` |
| FR-CARD-001 to 004, 007, 012, 014, 015, FR-ADM-001 (part), FR-STF-005 (part), BR-063 to BR-065 (API) | The card only when Verified and Active, never identity numbers; 60-second HMAC code with an opaque reference; scan results without reasons; public-card fields; C06 state and reason; suspension invalidates codes at once | `services/api/app/modules/membership/card` |
| FR-PROF-006 (API) | The member's review history with decision, reviewer tier and date | `/v1/identity/me/review` |
| FR-IDV-013, PRM-29, M04 and D05 (API), §15B.4 | One appeal per Request-update or Unable-to-verify decision, up to 1,000 characters; decided by a holder of `idv.appeal.decide`, never the original reviewer; uphold or overturn with a reason the member sees; the 10-working-day target is not tracked yet | `services/api/app/modules/identity/appeals` |
| FR-AUTH-027, NFR-SEC-13 (part), KPI-42, D31 | Quarterly review of every staff grant but Tier 5: confirm for another quarter or revoke, with a reason, by `audit.view` from a higher tier; an overdue grant stops counting and counts again once confirmed; reviewed this quarter shown against those waiting | `services/api/app/modules/access/reviews`, dashboard `/access-reviews` |
| FR-AUTH-025 | 15-minute tokens renewed by a refresh token that works once; a used one coming back ends the session for every copy and alerts the member; apps and the dashboard renew on their own | `auth/refresh.py`, `packages/api-client`, `packages/mobile-ui`, dashboard `src/proxy.ts` |
| FR-AUTH-018, NFR-SEC-12, BR-151, ENT-68, M50 | Risk rules on each sign-in (recent wrong passwords, unusual numbers of sign-ins, a new device alongside either); a flagged sign-in alerts the member in the inbox and by SMS, and "this wasn't me" ends every other session | `auth/risk.py`, `auth/security_alerts.py`, member app security screen |
| FR-ARCH-003, NFR-ARCH-02 | Versioned `/v1` REST API documented in OpenAPI 3.1 | `services/api`, `packages/api-client/openapi.json` |
| FR-ARCH-006 (part) | CI runs builds and tests; security scans and the production approval gate are still missing | `.github/workflows/ci.yml` |
| FR-ARCH-010 | One design-token package for the new apps | `packages/design-tokens` |
| FR-AUTH-021 | Revoking sessions ends every session of the member at once | both APIs |
| AP-06, NFR-ARCH-01 | Modular monolith with one folder per module | `services/api/app/modules` |
| AP-07 (part) | Tamil and English text shared; parity checked, 49 older gaps recorded | `packages/i18n` |
| §13.8 migrations | Alembic, forward-only, baseline guarded, run in CI | `services/api/alembic` |

## Where the rest will be built

Every BRD module has a folder in the target structure, with a README naming its requirement IDs: the member and staff app route and feature folders, the dashboard's `src/features/*`, the API's `modules/*`, `integrations/`, `tasks/` and the AI worker's task folders. See `PROJECT_STRUCTURE.md`. A few BRD modules have no folder of their own in the target tree yet: Home, Volunteering, Surveys, Learning, Referrals, Gallery, Elections (member side), Committees, Blood donors, Livelihood guide, Voice, Messaging (member side), Diaspora and Fact-checking. They get one when they are built.

## Open decisions that block upcoming work

| Decision | Blocks |
|---|---|
| OD-26 One role-aware app or two published apps | Staff app distribution (built as a separate app for now, as the BRD recommends) |
| OD-01, OD-02 Who verifies identity; how membership is activated | Assigning reviewers in production; automatic activation on approval (only the manual path is built) |
| OD-03 Retention of ID images, selfies, decisions | Deleting identity images (FR-IDV-015); every version is kept until decided |
| OD-28, OD-29 Acceptable biometric processing and retention | Liveness and face comparison |
| OD-42 AI provider and hosting | `services/ai-worker` |
| OD-20 Hosting location and cross-border transfer | Production architecture |
