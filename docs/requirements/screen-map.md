# Screen map

Every screen in BRD v1.1 (174), the app and place it belongs in, its module and phase (BRD §2 scope table, §20.2), and where it stands. A screen is built once, in the place given here; where the BRD describes two screens that overlap, the note says how they share one place. Update the status in the same commit that builds a screen.

Built screens are in the Expo member and staff apps and the Next.js dashboard; none of them is released yet. The live PWA (`app/`) is not the target for new screens.

| App | Screens | Built |
|---|---|---|
| Member app | 112 | 55 |
| Staff app | 18 | 7 |
| Dashboard | 44 | 19 |
| **All** | **174** | **81** |

Status: **Built**; **API ready** (the endpoint exists and is tested, only the screen is missing); **To build**; **Blocked** (waits on the decision or integration named).


## Member app

| Screen | Name | Module | Phase | Status | Place | Note |
|---|---|---|---|---|---|---|
| A01 | Welcome and language | Sign-in and account (SC-01) | 1 | Built | `apps/member-mobile/app/(auth)/welcome.tsx` |  |
| A02 | Sign in | Sign-in and account (SC-01) | 1 | Built | `apps/member-mobile/app/(auth)/sign-in.tsx` |  |
| A03 | Create account | Sign-in and account (SC-01) | 1 | Built | `apps/member-mobile/app/(auth)/register.tsx` |  |
| A04 | Identity document route | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A05 | NIC upload | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A06 | Passport upload | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A07 | Before your selfie | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A08 | Take selfie | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A09 | Review and submit | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A10 | Team review pending | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A11 | One item needs updating | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A12 | Identity approved | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/verify.tsx` |  |
| A13 | Basic profile | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(auth)/register.tsx (date of birth, gender; mobile in profile/recovery-number.tsx)` |  |
| A14 | Your area | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(auth)/register.tsx (district, DS, GN, referral)` |  |
| A15 | Optional joining survey | Identity verification (SC-02) | 1 | Built (DPO question-purpose approval pending) | `apps/member-mobile/app/(member)/setup/survey.tsx` | Optional fields; Skip remains available even when loading fails. |
| A16 | Recover access | Sign-in and account (SC-01) | 1 | Built | `apps/member-mobile/app/(auth)/recover.tsx, assisted-recovery.tsx` |  |
| A17 | Upload interrupted | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/src/features/identity/PhotoRow.tsx` | Per-file byte progress; an interrupted upload reads "Not yet received by the server" and retries the same photo; the app's cached copy is deleted after acknowledgement; server-acknowledged files remain received. |
| A18 | Resume setup | Identity verification (SC-02) | 1 | Built | `apps/member-mobile/app/(member)/setup/index.tsx` | Server-derived next step; completed steps link to review status and correction requests. Consent remains before document upload. |
| H01 | Home — active member | Home and inbox (SC-03) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/index.tsx` |  |
| H02 | Home — awaiting review | Home and inbox (SC-03) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/index.tsx` |  |
| H03 | Notifications | Home and inbox (SC-03) | 1 | Built | `apps/member-mobile/app/(member)/notifications.tsx` |  |
| H04 | Community Hub | Community hub (SC-04) | 1 shell, 2 services | Built | `apps/member-mobile/app/(member)/hub.tsx` |  |
| H05 | My area | Community issues (SC-05) | 2 | To build | `apps/member-mobile/app/(member)/issues/` |  |
| H06 | Local issue detail | Community issues (SC-05) | 2 | To build | `apps/member-mobile/app/(member)/issues/` |  |
| H07 | Report a concern | Community issues (SC-05) | 2 | To build | `apps/member-mobile/app/(member)/issues/` |  |
| H08 | Review report | Community issues (SC-05) | 2 | To build | `apps/member-mobile/app/(member)/issues/` |  |
| H09 | Report receipt and progress | Community issues (SC-05) | 2 | To build | `apps/member-mobile/app/(member)/issues/` |  |
| H10 | Volunteer skills | Volunteering (SC-06) | 2 | To build | `apps/member-mobile/app/(member)/volunteer/` |  |
| H11 | Volunteer opportunity | Volunteering (SC-06) | 2 | To build | `apps/member-mobile/app/(member)/volunteer/` |  |
| H12 | My assignment | Volunteering (SC-06) | 2 | To build | `apps/member-mobile/app/(member)/volunteer/` | Also lists M30 election duties |
| H13 | Community ideas | Ideas and surveys (SC-07) | 2 | To build | `apps/member-mobile/app/(member)/ideas/` | Decided: one Ideas area with M15–M17 |
| H14 | Take a survey | Ideas and surveys (SC-07) | 2 | To build | `apps/member-mobile/app/(member)/surveys/[id].tsx` |  |
| H15 | Learning and courses | Learning (SC-08) | 2 | To build | `apps/member-mobile/app/(member)/learning/` |  |
| H16 | Course lesson | Learning (SC-08) | 2 | To build | `apps/member-mobile/app/(member)/learning/[lesson].tsx` |  |
| H17 | Party fund contribution | Party fund (SC-09) | 2 | Built | `apps/member-mobile/app/(member)/fund/` | M1.4 bank slip intake |
| H18 | Contribution receipt | Party fund (SC-09) | 2 | Built | `apps/member-mobile/app/(member)/fund/receipt/[id].tsx` | M1.4 verified receipt card |
| H19 | Invite a member | Referrals (SC-10) | 2 | To build | `apps/member-mobile/app/(member)/referrals/invite.tsx` |  |
| H20 | My referrals | Referrals (SC-10) | 2 | To build | `apps/member-mobile/app/(member)/referrals/` |  |
| H21 | Survey submitted | Ideas and surveys (SC-07) | 2 | To build | `apps/member-mobile/app/(member)/surveys/[id]/done.tsx` |  |
| E01 | Events list | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/events.tsx` |  |
| E02 | Events map | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/events/[id].tsx` |  |
| E03 | Event filters | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/events/[id].tsx` |  |
| E04 | Event detail | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/events/[id].tsx` |  |
| E05 | Your RSVP | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/events/[id].tsx` |  |
| E06 | Event pass | Events (SC-11) | 1 | Built | `apps/member-mobile/app/(member)/events/[id]/pass.tsx` |  |
| C01 | My member card | Membership card (SC-12) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/card.tsx` |  |
| C02 | Show secure code | Membership card (SC-12) | 1 | Built | `apps/member-mobile/app/(member)/card/code.tsx` | Live 60-second signed QR, circular timer, temporary brightness. |
| C03 | Card while offline | Membership card (SC-12) | 1 | Built (display only) | `apps/member-mobile/app/(member)/(tabs)/card.tsx`, `apps/member-mobile/app/(auth)/welcome.tsx` | Encrypted saved copy with sync age; no offline QR or proof of current status. Offline scanning awaits OD-08. While the server cannot answer, the card tab asks again every 30 seconds. |
| C04 | Wallet and share | Membership card (SC-12) | 1 | Share built; wallet blocked: INT-03 | `apps/member-mobile/app/(member)/card/share.tsx` | Public text and image export; no live QR or ID image; wallet pass pending. |
| C05 | My progress | Membership card (SC-12) | 1 | Built (confirmed records) | `apps/member-mobile/app/(member)/card/progress.tsx` | Join, verified identity and attended events; training completion awaits a verified source. No ranking or points. |
| C06 | Card not available | Membership card (SC-12) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/card.tsx` |  |
| G01 | Gallery albums | Gallery (SC-13) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/gallery.tsx` |  |
| G02 | Album detail | Gallery (SC-13) | 1 | Built | `apps/member-mobile/app/(member)/gallery/[id].tsx` |  |
| G03 | Photo viewer and removal request | Gallery (SC-13) | 1 | Built | `apps/member-mobile/app/(member)/gallery/photo.tsx` |  |
| P01 | My profile | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/(tabs)/profile.tsx` |  |
| P02 | Edit profile | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/profile/edit.tsx` |  |
| P03 | Verification details | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/profile/activity.tsx` |  |
| P04 | My activity | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/profile/settings.tsx` |  |
| P05 | Account settings | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/profile/settings.tsx` | M45 messages and channels are added here |
| P06 | Privacy and account | Profile (SC-14) | 1 | Built | `apps/member-mobile/app/(member)/profile/privacy.tsx` |  |
| M01 | Document capture assistant | AI-assisted identity screening (SC-21) | 1–2 | Built (server-side advice: blur, darkness, glare, size; edge visibility not built) | `apps/member-mobile/app/(member)/verify/` | Advice shown under each photo after upload; thresholds to tune on consented test photos (DEP-16) |
| M02 | Confirm extracted NIC number | AI-assisted identity screening (SC-21) | 1–2 | Blocked: OD-42 (OCR provider) | `apps/member-mobile/app/(member)/verify/` |  |
| M03 | Guided liveness capture | AI-assisted identity screening (SC-21) | 1–2 | Blocked: OD-28, OD-29 (biometrics) | `apps/member-mobile/app/(member)/verify/` |  |
| M04 | Verification appeal | AI-assisted identity screening (SC-21) | 1–2 | Built (feature-gated) | `apps/member-mobile/app/(member)/verify/appeal.tsx` | Uses `/v1/identity/me/review/appeal`; shows decision reasons and 10-working-day target. |
| M05 | Assisted verification request | AI-assisted identity screening (SC-21) | 1–2 | Blocked: OD-04 (assisted verification) | `apps/member-mobile/app/(member)/verify/` |  |
| M06 | My Household / எனது குடும்பம் | My Household (SC-22) | 2 | Built | `apps/member-mobile/app/(member)/household/` |  |
| M07 | Add household member | My Household (SC-22) | 2 | Built | `apps/member-mobile/app/(member)/household/` |  |
| M08 | Invite adult member | My Household (SC-22) | 2 | Built | `apps/member-mobile/app/(member)/household/` |  |
| M09 | Household invitation response | My Household (SC-22) | 2 | Built | `apps/member-mobile/app/(member)/household/` |  |
| M10 | Household privacy and consent | My Household (SC-22) | 2 | Built | `apps/member-mobile/app/(member)/household/` |  |
| M11 | Community Support / சமூக உதவி | Community Support (SC-23) | 2 | To build | `apps/member-mobile/app/(member)/assistance/` |  |
| M12 | Request support | Community Support (SC-23) | 2 | To build | `apps/member-mobile/app/(member)/assistance/` |  |
| M13 | Support case status | Community Support (SC-23) | 2 | To build | `apps/member-mobile/app/(member)/assistance/` |  |
| M14 | Support complaint or appeal | Community Support (SC-23) | 2 | To build | `apps/member-mobile/app/(member)/assistance/` |  |
| M15 | Our Development Ideas / எமது அபிவிருத்தி யோசனைகள் | Development ideas (SC-24) | 2 | To build | `apps/member-mobile/app/(member)/ideas/proposals/` | Decided: shares the Ideas area with H13 |
| M16 | Submit development proposal | Development ideas (SC-24) | 2 | To build | `apps/member-mobile/app/(member)/ideas/proposals/` | Decided: shares the Ideas area with H13 |
| M17 | Proposal detail and stage | Development ideas (SC-24) | 2 | To build | `apps/member-mobile/app/(member)/ideas/proposals/` | Decided: shares the Ideas area with H13 |
| M18 | Promise Tracker / வாக்குறுதி முன்னேற்றக் கண்காணிப்பு | Promise Tracker (SC-25) | 2 | To build | `apps/member-mobile/app/(member)/promises/` |  |
| M19 | Promise detail | Promise Tracker (SC-25) | 2 | To build | `apps/member-mobile/app/(member)/promises/` |  |
| M20 | Area accountability scorecard | Accountability scorecard (SC-26) | 2 | To build | `apps/member-mobile/app/(member)/promises/scorecard.tsx` |  |
| M21 | Town hall live | Town hall (SC-27) | 2 | To build | `apps/member-mobile/app/(member)/town-hall/` |  |
| M22 | Ask and vote | Town hall (SC-27) | 2 | To build | `apps/member-mobile/app/(member)/town-hall/` |  |
| M23 | Town hall archive | Town hall (SC-27) | 2 | To build | `apps/member-mobile/app/(member)/town-hall/` |  |
| M24 | Budgeting cycle overview | Participatory budgeting (SC-28) | 3 | To build | `apps/member-mobile/app/(member)/budgeting/` |  |
| M25 | Budget project detail | Participatory budgeting (SC-28) | 3 | To build | `apps/member-mobile/app/(member)/budgeting/` |  |
| M26 | Cast budgeting ballot | Participatory budgeting (SC-28) | 3 | To build | `apps/member-mobile/app/(member)/budgeting/` |  |
| M27 | Budgeting results | Participatory budgeting (SC-28) | 3 | To build | `apps/member-mobile/app/(member)/budgeting/` |  |
| M28 | Tamil AI Assistant | Tamil AI assistant (SC-29) | 3 | Blocked: OD-42 (AI provider) | `apps/member-mobile/app/(member)/assistant.tsx` |  |
| M29 | Election information | Election mode (SC-30) | 2 | Blocked: DEP-19 (legal opinion) | `apps/member-mobile/app/(member)/election.tsx` |  |
| M30 | Duty roster and shift check-in | Election mode (SC-30) | 2 | To build | `apps/member-mobile/app/(member)/volunteer/ (duty roster with H12)` | Decided: election duties listed with H12 My assignment |
| M31 | My committees | Wings and committees (SC-31) | 3 | To build | `apps/member-mobile/app/(member)/committees/` |  |
| M32 | Committee space | Wings and committees (SC-31) | 3 | To build | `apps/member-mobile/app/(member)/committees/` |  |
| M33 | Membership renewal | Renewal and certificates (SC-33) | 2–3 | Blocked: OD-43 (renewal) | `apps/member-mobile/app/(member)/renewal/` |  |
| M34 | My certificates | Renewal and certificates (SC-33) | 2–3 | Blocked: OD-43 | `apps/member-mobile/app/(member)/renewal/` |  |
| M35 | Alerts and safety | Disaster support (SC-34) | 3 (alert relay may move to 2) | To build | `apps/member-mobile/app/(member)/alerts/` |  |
| M36 | Emergency help request | Disaster support (SC-34) | 3 (alert relay may move to 2) | To build | `apps/member-mobile/app/(member)/alerts/` |  |
| M37 | Blood donor enrolment | Blood donors (SC-35) | 3 | Blocked: OD-39 (blood donors) | `apps/member-mobile/app/(member)/blood-donors/` |  |
| M38 | Donation request response | Blood donors (SC-35) | 3 | Blocked: OD-39 | `apps/member-mobile/app/(member)/blood-donors/` |  |
| M39 | Livelihood and welfare guide | Livelihood guide (SC-36) | 3 | To build | `apps/member-mobile/app/(member)/livelihood/` |  |
| M40 | Guide entry detail | Livelihood guide (SC-36) | 3 | To build | `apps/member-mobile/app/(member)/livelihood/` |  |
| M41 | Meet your representative | Meet your representative (SC-37) | 3 | To build | `apps/member-mobile/app/(member)/representatives/` |  |
| M42 | Book or manage appointment | Meet your representative (SC-37) | 3 | To build | `apps/member-mobile/app/(member)/representatives/` |  |
| M43 | Voice report | Voice and low bandwidth (SC-38) | 1 manual alternatives, 3 voice | Blocked: Voice is Phase 3 | `apps/member-mobile/app/(member)/issues/new (voice mode of H07)` | Decided: a voice option inside H07, not a second report screen |
| M44 | Accessibility and data saver | Voice and low bandwidth (SC-38) | 1 manual alternatives, 3 voice | Built (text size and data saver; voice in Phase 3) | `apps/member-mobile/app/(member)/profile/accessibility.tsx` | In-app text size (Standard, Large, Larger) and a data saver that loads gallery photos on tap; stays on the device |
| M45 | Messages and channels | SMS and WhatsApp (SC-39) | 1 SMS, 2 WhatsApp | Built (preferences; SMS waits on INT-01, push on INT-02, WhatsApp in Phase 2) | `apps/member-mobile/app/(member)/profile/settings.tsx (channels, with P05)` | Independent push/SMS toggles per category; no second preferences screen. Decided: extends the P05 settings screen; no second preferences screen. |
| M46 | Diaspora participation | Diaspora (SC-40) | 3 | To build | `apps/member-mobile/app/(member)/diaspora.tsx` |  |
| M47 | Official updates | Official content and fact-checks (SC-41) | 2 | Blocked: INT-24 | `apps/member-mobile/app/(member)/official/` |  |
| M48 | Check or report a statement | Official content and fact-checks (SC-41) | 2 | To build | `apps/member-mobile/app/(member)/official/` |  |
| M49 | Devices and sessions | Account and device security (SC-42) | 1 | Built (remote revocation) | `apps/member-mobile/app/(member)/profile/security.tsx` | Confirmed session termination; device file wipe and passkeys await INT-02/INT-09. |
| M50 | Security alerts | Account and device security (SC-42) | 1 | Built | `apps/member-mobile/app/(member)/profile/security.tsx` |  |
| M51 | Card payment handoff | Payment gateway (SC-43) | 3, subject to OD-27 | Blocked: OD-27, OD-40 (payments) | `apps/member-mobile/app/(member)/fund/payment/` |  |
| M52 | Payment result and receipt | Payment gateway (SC-43) | 3, subject to OD-27 | Blocked: OD-27, OD-40 | `apps/member-mobile/app/(member)/fund/payment/` |  |

## Staff app

| Screen | Name | Module | Phase | Status | Place | Note |
|---|---|---|---|---|---|---|
| S01 | Staff sign-in and role context | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(auth)/` |  |
| S02 | Tasks and area dashboard | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/(tabs)/index.tsx` |  |
| S03 | Member support lookup | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/lookup.tsx` |  |
| S04 | Assisted verification session | AI-assisted identity screening (SC-21) | 1–2 | Blocked: OD-04 (assisted verification) | `apps/staff-mobile/app/(staff)/assisted-verification/` | Assisted verification only; the queue is W01/W02 on the dashboard |
| S05 | Field case capture | Field operations (SC-32) | 2 | To build | `apps/staff-mobile/app/(staff)/field-visits/` |  |
| S06 | Field visit record | Field operations (SC-32) | 2 | To build | `apps/staff-mobile/app/(staff)/field-visits/` |  |
| S07 | Offline sync and conflicts | Field operations (SC-32) | 2 | To build | `apps/staff-mobile/app/(staff)/field-visits/` |  |
| S08 | Attendance scanner (GAP-01) | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/(tabs)/check-in.tsx` | Also works offline: scans are queued on the phone and judged by the server at their recorded time, once the STF-01 replay window is approved; waiting scans are settled on the dashboard event page. The tab sends scans left from any event |
| S09 | Attendance roster and exceptions | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/roster/[id].tsx` |  |
| S10 | Volunteer assignment manager | Staff app (SC-19) | 1–2 | Partly built | `apps/staff-mobile/app/(staff)/assignments.tsx`, `apps/admin-web/src/app/(staff)/volunteer-assignments/` | Staff see and answer their own duties in the app; managers assign duties on the dashboard. A manager screen in the staff app is still to build |
| S11 | Referral intake and screening | Community Support (SC-23) | 2 | To build | `apps/staff-mobile/app/(staff)/assistance/` |  |
| S12 | Assistance case file | Community Support (SC-23) | 2 | To build | `apps/staff-mobile/app/(staff)/assistance/` |  |
| S13 | Approvals and escalations | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/(tabs)/approvals.tsx` |  |
| S14 | Operational notifications | Staff app (SC-19) | 1–2 | Built | `apps/staff-mobile/app/(staff)/(tabs)/alerts.tsx` |  |
| S15 | Election duty roster manager | Election mode (SC-30) | 2 | To build | `apps/staff-mobile/app/(staff)/election-roster/` |  |
| S16 | Relief distribution record | Disaster support (SC-34) | 3 (alert relay may move to 2) | To build | `apps/staff-mobile/app/(staff)/relief/` |  |
| S17 | Appointment calendar | Meet your representative (SC-37) | 3 | To build | `apps/staff-mobile/app/(staff)/appointments/` |  |
| S18 | Committee coordinator tools | Wings and committees (SC-31) | 3 | To build | `apps/staff-mobile/app/(staff)/committees/` |  |

## Dashboard

| Screen | Name | Module | Phase | Status | Place | Note |
|---|---|---|---|---|---|---|
| W01 | Verification queue | Verification and roles (SC-15) | 1 | Built | `apps/admin-web/src/app/(staff)/verification/page.tsx` | Scoped, filtered and paginated review queue |
| W02 | Identity decision | Verification and roles (SC-15) | 1 | Built | `apps/admin-web/src/app/(staff)/verification/[id]/page.tsx` |  |
| W03 | GN case file | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W04 | DS research | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W05 | District decision | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W06 | Regional plan | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W07 | Final approval | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W08 | Implementation and closure | Case workspaces (SC-16) | 2 | To build | `apps/admin-web/src/app/(staff)/cases/` |  |
| W09 | Role, area and permission assignment | Verification and roles (SC-15) | 1 | Built | `apps/admin-web/src/app/(staff)/access/page.tsx` |  |
| D01 | Admin home and work queues | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/page.tsx` | Area-scoped queues refresh each minute; community reports have filtered pagination, record detail, audited access and an immutable submission-area snapshot. |
| D02 | Member and household administration | My Household (SC-22) | 2 | Built | `apps/admin-web/src/app/(staff)/members/` |  |
| D03 | Identity screening panel | AI-assisted identity screening (SC-21) | 1–2 | Built | `apps/admin-web/src/app/(staff)/verification/[id]/page.tsx` | Shown on the W02 review page |
| D04 | Duplicate investigation workspace | AI-assisted identity screening (SC-21) | 1–2 | Built | `apps/admin-web/src/app/(staff)/duplicates/` | Paginated investigations and case decisions |
| D05 | Verification appeals queue | AI-assisted identity screening (SC-21) | 1–2 | Built | `apps/admin-web/src/app/(staff)/appeals/` | Paginated appeals and decision records |
| D06 | Membership activation console (GAP-02) | Membership activation (§9, BR-097) | 1 | Built | `apps/admin-web/src/app/(staff)/membership/` |  |
| D07 | Event console (GAP-03) | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/events/` | Paginated list, create, edit, audited roster CSV, cancellation |
| D08 | Gallery console and removal queue (GAP-04) | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/gallery/` | Paginated album and 24h removal queues, protected display-size preview |
| D09 | Notification and messaging composer (GAP-05) | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/messages/` | Paginated bilingual broadcasts with area and effective staff-authorization-tier targeting, live reach, final reach recalculation, approval and audited dispatch. No member ranking. |
| D10 | Finance queue and ledger (GAP-06) | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/finance/` | M1.4 two-person reconciliation queue & ledger |
| D11 | Payment reconciliation | Payment gateway (SC-43) | 3, subject to OD-27 | Blocked: OD-27, OD-40 | `apps/admin-web/src/app/(staff)/finance/payments/` |  |
| D12 | Moderation and fact-check queue (GAP-07) | Official content and fact-checks (SC-41) | 2 | To build | `apps/admin-web/src/app/(staff)/moderation/` |  |
| D13 | Assistance case management | Community Support (SC-23) | 2 | To build | `apps/admin-web/src/app/(staff)/assistance/` |  |
| D14 | Assistance programmes and criteria | Community Support (SC-23) | 2 | To build | `apps/admin-web/src/app/(staff)/assistance/programmes/` |  |
| D15 | Development proposal review | Development ideas (SC-24) | 2 | To build | `apps/admin-web/src/app/(staff)/development/` |  |
| D16 | Promise Tracker administration | Promise Tracker (SC-25) | 2 | To build | `apps/admin-web/src/app/(staff)/promises/` |  |
| D17 | Scorecard publication | Accountability scorecard (SC-26) | 2 | To build | `apps/admin-web/src/app/(staff)/scorecards/` |  |
| D18 | Town hall production and moderation | Town hall (SC-27) | 2 | To build | `apps/admin-web/src/app/(staff)/town-hall/` |  |
| D19 | Budgeting administration | Participatory budgeting (SC-28) | 3 | To build | `apps/admin-web/src/app/(staff)/budgeting/` |  |
| D20 | Assistant knowledge base | Tamil AI assistant (SC-29) | 3 | Blocked: OD-42 | `apps/admin-web/src/app/(staff)/assistant/` |  |
| D21 | AI model registry and monitoring | AI-assisted identity screening (SC-21) | 1–2 | Blocked: OD-42 | `apps/admin-web/src/app/(staff)/ai-models/` |  |
| D22 | Election mode administration | Election mode (SC-30) | 2 | Built (periods, silence windows, notices; duty roster, polling information and period report have no API yet) | `apps/admin-web/src/app/(staff)/elections/` |  |
| D23 | Committees and wings administration | Wings and committees (SC-31) | 3 | To build | `apps/admin-web/src/app/(staff)/committees/` |  |
| D24 | Field operations oversight | Field operations (SC-32) | 2 | To build | `apps/admin-web/src/app/(staff)/field/` |  |
| D25 | Renewals and certificates | Renewal and certificates (SC-33) | 2–3 | Blocked: OD-43 | `apps/admin-web/src/app/(staff)/renewals/` |  |
| D26 | Disaster alerts and relief logistics | Disaster support (SC-34) | 3 (alert relay may move to 2) | To build | `apps/admin-web/src/app/(staff)/disaster/` |  |
| D27 | Blood request desk | Blood donors (SC-35) | 3 | Blocked: OD-39 | `apps/admin-web/src/app/(staff)/blood-requests/` |  |
| D28 | Livelihood guide content | Livelihood guide (SC-36) | 3 | To build | `apps/admin-web/src/app/(staff)/livelihood/` |  |
| D29 | Representatives and appointments | Meet your representative (SC-37) | 3 | To build | `apps/admin-web/src/app/(staff)/representatives/` |  |
| D30 | Official content publishing and signing | Official content and fact-checks (SC-41) | 2 | Blocked: INT-24 (signing keys in KMS) | `apps/admin-web/src/app/(staff)/publishing/` |  |
| D31 | Security centre | Account and device security (SC-42) | 1 | Built | `apps/admin-web/src/app/(staff)/access-reviews/page.tsx` |  |
| D32 | Analytics dashboards | Administration (SC-17, SC-20) | 1–3 | Built (Phase 1 operational figures; further dashboards and exports later) | `apps/admin-web/src/app/(staff)/analytics/` | Registration, identity reviews, review queue and event attendance for the viewer's areas; groups of 1 to 9 hidden |
| D33 | Audit log viewer | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/audit/page.tsx` |  |
| D34 | Geography and configuration | Administration (SC-17, SC-20) | 1–3 | Built | `apps/admin-web/src/app/(staff)/settings/` | Feature flags and read-only district → DS → GN registry |
| D35 | Policy and consent register | Administration (SC-17, SC-20) | 1–3 | Built (data-subject request register; policy approvals and consent statistics have no API yet) | `apps/admin-web/src/app/(staff)/privacy/` |  |
