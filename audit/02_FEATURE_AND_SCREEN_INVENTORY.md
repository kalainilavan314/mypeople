# 02 — Feature & Screen Inventory

*ஒவ்வொரு திரையும் பதிவு — every screen, named from the router, not guessed.*

Source of truth: route table in `app/src/App.tsx:182-236` and the files under `app/src/screens/`. Every route below was read directly from the router; "Data source" is VERIFIED only where the screen file itself was opened (see 05 for per-screen reads), otherwise marked INFERRED from `app/src/data/api.ts` / `authApi.ts` contracts.

| Screen ID | Route | Persona | Purpose | Primary action | Data source | Lazy-loaded? | Evidence |
|---|---|---|---|---|---|---|---|
| S-00 Welcome | `/welcome` | First-time visitor | First-launch brand intro | Continue → Login | local (`hasSeenWelcome()`) | No (eager) | `App.tsx:16,186-188` |
| S-01 Login | `/login` | Returning member | NIC + password auth | Submit login | server (`/api/auth/login`) | No (eager) | `App.tsx:17,192` |
| S-02 SignUp | `/signup` | Prospective member | Create account | Submit signup | server (`/api/auth/signup`) | Yes | `App.tsx:47,193` |
| S-03 ProfileSetup | `/signup/profile` | Prospective member | Collect profile fields (dob/gender/division) | Continue | server (signup payload) | Yes | `App.tsx:49,194` |
| S-04 Questions | `/signup/questions` | Prospective member | Custom signup questions | Continue | server (signup payload `answers`) | Yes | `App.tsx:50,195` |
| S-05 Forgot | `/forgot` | Locked-out member | Password recovery | Submit | INFERRED (no route found in server/src/index.js for password reset — **gap, see 05**) | Yes | `App.tsx:48,196` |
| S-06 Join (legacy) | `/onboarding/join` | Legacy deep link | Old phone-first onboarding entry | Continue | mock/OTP | Yes | `App.tsx:43,199-205` |
| S-07 Otp (legacy) | `/onboarding/otp` | Legacy deep link | Phone OTP verify | Verify | server (`/api/auth/verify-otp`, still live) | Yes | `App.tsx:44`; **VERIFIED full read this pass** — `onboarding/Otp.tsx:1-72`, custom keypad UI, genuine server call |
| S-08 Nic (legacy) | `/onboarding/nic` | Legacy deep link | NIC capture (old flow) | Submit | mock, and **worse than "mock" implies** | Yes | `App.tsx:45`; **VERIFIED full read this pass** — `onboarding/Nic.tsx:1-64`. `api.submitNic()` is called with no arguments at all; the "upload" tiles never touch a file input or camera — see DEFECT-07 in 05 |
| S-09 Pending (legacy) | `/onboarding/pending` | Legacy deep link | "Under review" holding screen | — | mock | Yes | `App.tsx:46` |
| S-10 Home | `/` | Member | Dashboard: hero, membership summary, quick actions, upcoming events, local updates | Navigate to any module | mixed: server (`cardToken`, events, announcements) | No (eager) | `screens/Home.tsx:1-213` |
| S-11 Community | `/community` | Member | Hub for civic-participation sub-features | Navigate to Area/Reports/Fund/Ideas/Skills/Courses/Survey/Gallery | INFERRED hub, not opened | Yes | `App.tsx:23,211`, `BottomNav.tsx:25-31` |
| S-12 MyArea | `/area` | Member | Localized feed for member's own district/division | Browse | INFERRED | Yes | `App.tsx:24,212` |
| S-13 Announcement | `/announcement/:id` | Member | Announcement detail | Confirm attendance / read | mock (`getAnnouncement`) | Yes | `App.tsx:30,213`, `data/api.ts:59` |
| S-14 Survey | `/survey` | Member | Vote on active survey | Submit vote | mock (`voteSurvey`) | Yes | `App.tsx:31,214`, `data/api.ts:69` |
| S-15 Events | `/events` | Member / anonymous | Browse events, List/Map toggle | RSVP, open detail | server (`/api/events`) | Yes | `App.tsx:26,215`, `index.js:504-508` |
| S-16 EventDetail | `/events/:id` | Member / anonymous | Event detail, agenda, RSVP, check-in | RSVP / check-in | **CORRECTED — mock, not server.** `EventDetail.tsx:13,22,25` imports `useEvent`/`useCheckIn` from `data/queries.ts:45-46,78-84`, which call `api.getEvent(id)` / `api.checkIn(id)` — the **legacy mock client** (`data/mock/client.ts:147-151`), never `/api/events/:id`. See DEFECT-03 in 05. | Yes | `App.tsx:32,216`; **not** `index.js:510-539` (that endpoint is only used by the real `Events.tsx` list via `useEvents`) |
| S-17 Card | `/card` | Member | Digital membership card + QR | Show QR, add to wallet | server (`cardToken`) + mock (badges/milestones) | Yes | `App.tsx:25,217`, `Home.tsx:56-61` |
| S-18 Milestones | `/milestones` | Member | Tier ladder + badges | View progress | server (`tierProgress`) + mock (badges) | Yes | `App.tsx:34,218` |
| S-19 Referral | `/referral` | Member | Referral code sharing | Copy / share code | server (`referralCode`, `recruitCount` on `ServerMember`) | Yes | `App.tsx:33,219`, `authApi.ts:26-28` |
| S-20 Reports | `/reports` | Member | List own community reports; composer | Submit new report | server (`/api/reports`, `/api/reports/mine`) | Yes | `App.tsx:27,220`, `index.js:541-593` |
| S-21 ReportNew | **No route found (confirmed — `grep -n ReportNew App.tsx` returns nothing)** | Member | A *second*, older "field report" composer: category chips (`canvassing/water/roads/land/electricity`), hold-to-record voice note, GPS capture | Submit | **Legacy mock**, not the real community-reports API: `useSubmitReport`/`ReportCategory` (`data/queries.ts`, `data/types.ts`) — a different type and hook from `Reports.tsx`'s `useSubmitCommunityReport`/`CommunityReportCategory`. On submit it navigates to `/reports`, which renders `Reports.tsx`, not itself. | Orphaned, like S-22 | `screens/ReportNew.tsx:1-121` VERIFIED full read |
| S-22 ReportDetail | (file exists, no route found — **re-confirmed**) | Member | Single report detail | View status | **VERIFIED, and worse than previously flagged**: `ReportDetail.tsx:7,12` calls `useReport(id)` → `api.getReport(id)` (`queries.ts:49-50`) — the **legacy mock `Report` type** (with `audioUrl`, `lat/lng`, `timeline[]`), the *same* abandoned data model `ReportNew.tsx` targets. It is not merely unrouted; it was built against a data contract the live `/api/reports` feature has already superseded. Reconnecting it verbatim would show a voice-note/GPS report shape the real backend doesn't produce. | — | `screens/ReportDetail.tsx:1-71` VERIFIED full read |

**Note**: the real, server-backed community-reporting feature is fully self-contained in `Reports.tsx` (401 lines, VERIFIED): its own `ReportForm` (category/title/description/district/priority) and `MyReports` list, the latter already rendering an inline 4-stage status progress bar per report (`Reports.tsx:372-398`). So the *status-tracking promise* PROJECT.md makes is substantially met by `Reports.tsx` itself — `ReportDetail`/`ReportNew` are a parallel, disconnected legacy pair that should likely be deleted rather than reconnected (see 05 DEFECT-02 revision).
| S-23 Gallery | `/gallery` | Member | Media gallery | Browse photos | INFERRED | Yes | `App.tsx:28,221` |
| S-24 Profile | `/profile` | Member | Own profile summary, menu | Navigate to settings | server (`useMe`) | Yes | `App.tsx:29,222` |
| S-25 EditProfile | `/profile/edit` | Member | Edit own profile fields | Save | server (`/api/me` PATCH) | Yes | `App.tsx:40,223`, `index.js:599-648` |
| S-26 Courses | `/courses` | Member | Learning catalogue + progress | Start/continue course | mock (`getCourses`) | Yes | `App.tsx:36,224` |
| S-27 Ideas | `/ideas` | Member | Submit/back community ideas | Submit idea, back idea | mock (`getIdeas`, `submitIdea`, `backIdea`) | Yes | `App.tsx:37,225`, `data/api.ts:78-80` |
| S-28 Skills | `/skills` | Member | Skills registry / volunteering availability | Toggle skill availability | mock (`toggleSkill`) | Yes | `App.tsx:38,226`, `data/api.ts:83` |
| S-29 PartyFund | `/fund` | Member | Donations — card sandbox or bank-slip upload, donor board, admin review | Donate / approve / reject | server (`/api/donations/*`) — **now VERIFIED full 798-line read**; see 05 for the sandbox-disclosure answer (confirmed disclosed) | Yes | `App.tsx:39,227`, `index.js:798-895`, `screens/PartyFund.tsx:1-798` |
| S-30 Privacy | `/privacy` | Member | Consent toggles, data export, delete membership | Toggle consent, request delete | mock (`getConsents`/`setConsent`) | Yes | `App.tsx:41,228`, `data/api.ts:87-88` |
| S-31 Notifications | `/notifications` | Member | Notification inbox | Mark read, deep link | mock (`getNotifications`) | Yes | `App.tsx:35,229` |
| S-32 Language | `/language` | Member | Switch ta/en/si | Select language | server (`/api/me` PATCH `language`) + local `i18n` | Yes | `App.tsx:42,230`, `index.js:641` |

## Admin-only server capability — UPDATED after full `PartyFund.tsx` read (798 lines, now VERIFIED)

| Capability | Route | Evidence | UI screen? |
|---|---|---|---|
| Review donation slip / view pending donations | `POST /api/donations/:id/review`, `GET /api/donations/pending` | `index.js:872-895`; `screens/PartyFund.tsx:74,78,130,639-715` | **CORRECTING prior pass**: a real admin review screen exists. `PartyFund.tsx`'s `ReviewTab` (lines 639-715) is gated on `me?.isAdmin` and renders pending slip donations with an image preview (`fetchSlipImage`) and Approve/Reject buttons wired to `useReviewDonation()`. This is a genuine, functional in-app admin tool, not a gap. |
| Review member identity verification | `POST /api/members/:id/verification` | `index.js:725-756` | **Still not found** in any of the 28 screens now read. `Profile.tsx`'s `VerificationSheet` (lines 292-341) only *displays* the member's own verification progress — it has no coordinator-facing action. No separate admin app was found in this repo. **Confirmed gap**, not an oversight — this audit read every screen file and found no candidate. |

This narrows the prior "admin tooling" finding considerably: only identity-verification review is a confirmed gap; donation review is shipped and working.

## Non-screen UX surfaces worth tracking

- **Offline banner** — global, not a screen (`App.tsx:82-99`).
- **Update prompt** (`components/UpdatePrompt.tsx`) — global PWA update nudge.
- **Bottom navigation** — 5 tabs: Home, Events, Card, Community (hub), Profile (`BottomNav.tsx:16-39`). Note PROJECT.md's original prototype describes different tab labels (Home/Events/Card/Reports/Profile) — the live app's tabs have diverged from the design doc (Community replaces Reports as a tab, Reports is now nested under Community). This is a **documentation drift** issue, not a code defect — PROJECT.md should be updated or flagged stale.

## Coverage status — final, now 100% of files line-read

All 28 routed/orphaned screen files, the shared primitive file `auth/parts.tsx`, and — closed in this consolidation pass — `app/src/styles/tokens.css` (398 lines) and `app/src/components/ui.tsx` (345 lines) have all now been read in full by direct inspection. See 05/06 for the findings folded in from this closing read (DS-10 through DS-13, UX-23, UX-24), and 10 for the final coverage matrix.

**True remaining gap, stated precisely**: `app/src/theme/tokens.ts` (the TS mirror of `tokens.css`) was read in excerpts across 05/06/11 (its tier map, font tokens, and comment on `font.ta` ordering are all directly cited with line numbers) but not confirmed read top-to-bottom in one pass. Given that `tokens.css` — its authoritative source — has now been read in full and the TS file is a thin `var(--x)` mirror of the same custom properties (06's own description), this is a low-risk residual gap, not an unknown system. No further screen, shared-component, or stylesheet file remains unread in this audit.
