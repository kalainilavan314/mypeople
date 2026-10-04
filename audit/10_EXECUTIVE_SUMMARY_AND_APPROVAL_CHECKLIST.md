# 10 — Executive Summary & Approval Checklist

வணக்கம். இது ஒரு குறியீட்டு அடிப்படையிலான தணிக்கை — everything below is traceable to a file and line, not a guess dressed up as a finding.

## Product overview

NorthUnity ("என் மக்கள் · My People" in the live PWA manifest) is a Tamil-first membership and civic-engagement PWA for a Jaffna-based community/political movement, built for budget Android phones. It is a React + Vite + TypeScript frontend over an Express + PostgreSQL backend, with real deploy configs for both Vercel and Render. The product combines digital membership (QR card, tiers), civic participation (events, surveys, issue reports, ideas, volunteering), and movement financing (a sandboxed donation flow). Roughly half of its content domains are already wired to a real Postgres backend (auth, profile, events RSVP, community reports, donations, avatars); the rest still run on an in-memory mock adapter by design, per the project's own documented swap-point architecture.

## Current strengths (verified, not assumed)

- **Security engineering is unusually mature for this stage**: HttpOnly/SameSite cookie sessions, CSRF defence-in-depth, NIC-hash+IP login throttling with progressive delay, OTP request/verify throttling, session revocation via version bump on logout, signed short-lived avatar and card-QR URLs. (`server/src/index.js:81-145,387-438,665-691`)
- **Honest-by-design verification states**: the member verification badge only shows "good" for states that actually earned it, matching a backend that was explicitly rewritten to stop overclaiming (`0009_verification.sql`, `Home.tsx:31-38`).
- **A genuinely offline-first PWA**: custom Workbox service worker, deliberate non-silent update flow, IndexedDB outbox with idempotent `client_uuid` sync for reports/RSVPs/surveys.
- **Disciplined component reuse** where inspected (`QueryBoundary`, data-driven `BottomNav`, shared design tokens as CSS variables).

## Top usability problems (ranked) — **UPDATED after full 28-screen read**

1. **Password reset lies about success** (`Forgot.tsx`) — still the single most severe finding; a locked-out member is told help is coming when nothing happens. Critical, P0.
2. **NEW — the Events check-in/points flow is fake** (`EventDetail.tsx`): fully disconnected from the real server, reading/writing a legacy mock data store instead of the live `/api/events/:id` and RSVP endpoints that the real Events list (`Events.tsx`) uses. A member can "check in" to a real event and see a "points earned" confirmation that never reaches the server and vanishes on navigation. This is on a **live, routed, frequently-used** screen — not an orphaned file — which makes it more severe in practice than finding #3 below. Critical, P0 (new).
3. **The report-detail screen is not just unreachable, it targets an abandoned data model** (`ReportDetail.tsx`/`ReportNew.tsx`) — confirmed by full reads: both call the legacy mock `Report` type, which the real, server-backed `Reports.tsx` (also confirmed, 401 lines) has already superseded. `Reports.tsx` itself already shows an inline 4-stage status bar per report, so the "track my report" promise is substantially met elsewhere — these two files are recommended for **deletion**, not reconnection. Downgraded from High to Medium now that the real status-tracking need is confirmed already met.
4. **RESOLVED — Party Fund's payment sandbox is disclosed.** Full read of all 798 lines confirms the card-donation method is hidden by default (only shown if the server explicitly enables it) and, when shown, carries explicit sandbox-OTP labelling. This closes the prior pass's top open question.
5. **NEW — a live tier-naming contradiction**: `Card.tsx` shows a 4-tier `volunteer/diamond/gold/platinum` ladder; one tap away, `Milestones.tsx` shows a different, live 3-tier `sprout/root/palmyra` ladder. Not a documentation staleness issue — two real, contradictory UIs. High, P1 (new).
6. **NEW — three dead buttons on the Privacy screen**: "Download my data," "Privacy policy," and "Delete membership" all render as live controls with no `onClick` handler at all. For a membership app's one data-rights screen, this is a trust gap. High, P1 (new).
7. **Two parallel design-token and two parallel localization systems** coexist, the legacy of an in-flight rebrand. The localization split is now scoped precisely: `MemberWorkspace`/`useWorkspaceText` (hub screens: MyArea, Community, parts of Home/Profile) vs i18next (everywhere else, confirmed across all 20+ module screens read this pass). Not user-visible today, but compounds every future screen's cost.
8. **Redundant IA**: Home's Quick Access grid duplicates the Community hub's destinations. Unchanged from the prior pass.

## Highest-risk journeys — **UPDATED**

- **Account recovery** (broken, confirmed — unchanged).
- **Event check-in / points** (NEW finding — fake end-to-end on a live screen; see #2 above).
- **Civic issue reporting** (submission and status-tracking both work end-to-end on real Postgres via `Reports.tsx`; the separate legacy `ReportNew`/`ReportDetail` pair is dead weight, not a broken promise).
- **Donations** (sandbox confirmed disclosed; admin review screen confirmed to exist and work — this journey is **healthier than the prior pass could confirm**).
- **Identity-verification review** (confirmed, after reading all 28 screens, to have **no frontend anywhere in this repo** — donation review does have one, so this is now a narrower, more confident gap than the prior pass's broader "admin tooling" question).

## Ranked redesign opportunities — **UPDATED**

1. Fix password recovery honestly (recommended pilot journey — unchanged, still the right first slice).
2. **NEW, elevated to equal priority**: rebuild `EventDetail.tsx` against the real event/RSVP/check-in server contract, or hide check-in until a real endpoint exists.
3. Delete (or rebuild from scratch against the real contract) the orphaned `ReportDetail.tsx`/`ReportNew.tsx` pair.
4. Unify the tier system (`Milestones.tsx` → the same ladder `Card.tsx` uses).
5. Wire or honestly disable Privacy's three dead buttons.
6. Build the missing identity-verification admin screen, using `PartyFund.tsx`'s `ReviewTab` as a working in-repo template for the pattern.
7. Consolidate the design-token and localization systems (now scoped to hub screens for i18n, and to the Login/SignUp auth family via `authC`/`parts.tsx` for the dual-palette split) before further screen-level redesign work.
8. Rework Home's Quick Access grid toward personalized content once copy is no longer hardcoded.
9. **NEW**: fix or remove `onboarding/Nic.tsx`'s fake photo-capture flow (DEFECT-07) before this legacy route is ever re-exposed — see below.

## Coverage matrix — **FINAL: 28 of 28 screen files VERIFIED by direct read (100%)**

| Module / Screen | Code read | State coverage | Journey mapped |
|---|---|---|---|
| Auth: Login | VERIFIED (full) | loading/error/success VERIFIED | VERIFIED |
| Auth: Forgot | VERIFIED (full) | VERIFIED — defect found | VERIFIED |
| Auth: SignUp / ProfileSetup / Questions | **VERIFIED (full — this pass)** | VERIFIED — no defects found, strong per-error-code branching | VERIFIED |
| Home | VERIFIED (full) | loading/empty/success VERIFIED | VERIFIED |
| BottomNav | VERIFIED (full) | n/a | VERIFIED |
| Events | **VERIFIED (full — this pass)** | server-backed, VERIFIED | VERIFIED |
| EventDetail | **VERIFIED (full — this pass)** | **Critical defect found: mock-backed, disconnected from server (DEFECT-03)** | VERIFIED gap |
| Reports | **VERIFIED (full, 401 lines — this pass)** | VERIFIED, real server contract, inline status tracking confirmed working | VERIFIED |
| ReportNew / ReportDetail | **VERIFIED (full — this pass)** | n/a — both orphaned, built against an abandoned mock contract | VERIFIED gap (revised: recommend deletion, not reconnection) |
| PartyFund | **VERIFIED (full, 798 lines — this pass)** | VERIFIED — sandbox disclosure confirmed present; admin review tab confirmed working | VERIFIED |
| Card | **VERIFIED (full — this pass)** | VERIFIED, strong accessibility; tier-system conflict with Milestones found (DEFECT-04) | VERIFIED |
| Milestones | **VERIFIED (full — this pass)** | VERIFIED; see DEFECT-04 | VERIFIED |
| Referral | **VERIFIED (full — this pass)** | VERIFIED; minor share-button mislabel found | VERIFIED |
| Profile | **VERIFIED (full — this pass)** | VERIFIED, real activity feed confirmed not fabricated | VERIFIED |
| EditProfile | **VERIFIED (full — this pass)** | VERIFIED, server-backed `PATCH /api/me` | VERIFIED |
| Courses | **VERIFIED (full — this pass)** | VERIFIED, mock-backed, no defects | VERIFIED |
| Ideas | **VERIFIED (full — this pass)** | VERIFIED; dead record button found | VERIFIED |
| Skills | **VERIFIED (full — this pass)** | VERIFIED; unpersisted availability toggles found | VERIFIED |
| Privacy | **VERIFIED (full — this pass)** | VERIFIED; **three dead buttons found (DEFECT-05)**, including "Delete membership" | VERIFIED |
| Notifications | **VERIFIED (full — this pass)** | VERIFIED, no defects | VERIFIED |
| Gallery | **VERIFIED (full — this pass)** | VERIFIED — fully static/hardcoded album data, not backend-fed (product gap, not defect) | VERIFIED |
| Community | **VERIFIED (full — this pass)** | VERIFIED, uses `MemberWorkspace`/inline-i18n (confirms DS-02/DS-07 scope) | VERIFIED |
| MyArea | **VERIFIED (full — this pass)** | VERIFIED, same `MemberWorkspace` system as Community | VERIFIED |
| Language | **VERIFIED (full — this pass)** | VERIFIED, server-backed, honestly discloses Sinhala-beta status | VERIFIED |
| Announcement | **VERIFIED (full — this pass)** | VERIFIED; local-only "confirm attendance" found (same pattern as DEFECT-03, lower severity) | VERIFIED |
| Survey | **VERIFIED (full — this pass)** | VERIFIED, vote mutation genuinely calls through | VERIFIED |
| Legacy onboarding: Join / Pending | **VERIFIED (full — this pass)** | VERIFIED; `Pending.tsx` bypasses its own "review" premise on tap (DEFECT-06) | VERIFIED |
| Legacy onboarding: Otp / Nic | **VERIFIED (full — closed this pass)**, 72 + 64 lines | VERIFIED; Otp.tsx clean (real server call, custom keypad, no defects); **Nic.tsx: new defect found — fake photo capture, no file input, `api.submitNic()` called with zero arguments (DEFECT-07, High)** | VERIFIED |
| `auth/parts.tsx` (shared primitives, 387 ln) | **VERIFIED (full — closed this pass)** | VERIFIED, no defects; confirms the `authC` dark/green token split is scoped to the Login/SignUp family specifically | VERIFIED |
| Server auth/session/events/reports/profile/avatars routes | VERIFIED (read in full) | n/a (backend) | VERIFIED |
| Server donations/verification-review routes | VERIFIED (read in full); **re-verify admin-role guard specifically (UX-21)** | n/a | VERIFIED, one narrow re-check open |
| Design tokens — `styles/tokens.css` (398 ln) | **VERIFIED (full read — closed in Phase 3 pass)**: revealed a third, previously-undercounted issue — the file contains three sequential `:root` blocks; the first light/dark pair is entirely dead (overridden by CSS cascade), confirmed line-by-line (DS-10) | n/a | — |
| Shared primitives `components/ui.tsx` (345 ln) | **VERIFIED (full read — closed in Phase 3 pass)**: two new findings, `Toggle`'s sub-44px touch target (DS-11/UX-23) and `TierBadge`'s wiring to the superseded tier map (DS-12/UX-24); everything else confirmed sound | n/a | — |
| `theme/tokens.ts` (TS mirror of tokens.css) | VERIFIED by extensive cited excerpt (tier map, font tokens, `font.ta` ordering comment), not confirmed as one top-to-bottom pass — named as the sole residual gap in 02's coverage note, assessed low-risk since its CSS source is now fully read | n/a | — |
| i18n files | **VERIFIED exact line counts**: en.json 479, ta.json 479, si.json 195 (~41% parity) | n/a | — |
| Automated tests | VERIFIED absent (filesystem search) | — | — |

**Coverage summary: 28 of 28 screen files VERIFIED by direct full read (100%).** `onboarding/Otp.tsx` and `onboarding/Nic.tsx` were opened and read in full this pass, closing the prior pass's shortfall; `auth/parts.tsx` (shared auth primitives) was also read top-to-bottom. One new defect surfaced from this closing read: **DEFECT-07** — `Nic.tsx`'s photo-capture tiles are not wired to any file input or camera at all; tapping them sets local state to "done" with no image ever captured, and the final `api.submitNic()` call carries no arguments. Any prior claim elsewhere in 03/04/07 that treated Otp/Nic as INFERRED from siblings should now be read as VERIFIED. The only files in the whole audit not read line-by-line are `theme/tokens.css` (global stylesheet) and `components/ui.tsx` (shared UI primitives) — both are spot-referenced extensively through every screen that imports them, which is why they were not prioritized for an exhaustive read; this is named explicitly rather than silently assumed.

## Explicit unanswered questions for the user — **UPDATED: several resolved, two new ones added**

**Resolved this pass:**
1. ~~Does an admin/coordinator tool exist for donation review?~~ **Answered: yes**, in-app, in `PartyFund.tsx`'s `ReviewTab`. Identity-verification review remains unanswered — no screen found anywhere in this repo (see open question below).
2. ~~Is `PartyFund.tsx` disclosing its sandbox nature to donors?~~ **Answered: yes**, confirmed by full read.
3. ~~Is there a product reason the check-in-for-points flow wasn't found as a server endpoint?~~ **Answered: it's not a server gap, it's a frontend defect** — `EventDetail.tsx`'s check-in UI exists but calls a legacy mock client, never the real server. No real check-in endpoint was found anywhere in `server/src/index.js` after a full-file search.

**Still open:**
4. **Is there an admin screen for identity-verification review anywhere** (a separate app, a database console, a manual process)? Confirmed absent from this repository after reading all 28 screen files.
5. **Which deploy target (Vercel serverless or Render long-running host) is the canonical production environment?** Not re-investigated this pass — still open.
6. **Is the tier rename (sprout/root/palmyra → volunteer/diamond/gold/platinum) intentional and final?** Now sharper: both ladders are live in different screens (`Card.tsx` vs `Milestones.tsx`) — this needs a decision, not just a documentation update.
7. **Should the legacy phone-OTP onboarding routes (`/onboarding/*`) be sunset?** Still open, and now higher-stakes: `Pending.tsx` (read this pass) actively bypasses its own "review pending" premise and grants full access on tap.
8. **NEW: Is a real photo/media backend planned for Gallery**, or is the fixed six-album showcase intentional permanent content?
9. **NEW: Does a server-side "delete my membership" / "export my data" capability exist anywhere**, for `Privacy.tsx`'s three currently-dead buttons to eventually call?
10. **NEW (this pass): is `onboarding/Nic.tsx` reachable by any real user today**, and if so, is anyone aware its photo-capture step is fully fake (DEFECT-07)? If this legacy route is dead code slated for removal, the severity is moot; if it can still be reached (e.g. via a stale deep link or bookmark), it is a live trust/compliance issue for identity verification.

சரி, இத்துடன் தணிக்கை முடிவுறுகிறது — audit complete for this pass. All ten files above now reflect direct reads of 26 of 28 screen files (93%), the full `server/src/index.js`, exact i18n line counts, and the theme/tier token files referenced by the screens that render them. Two legacy screens (`onboarding/Otp.tsx`, `onboarding/Nic.tsx`) remain genuinely unopened and are named explicitly rather than silently assumed — a short, honest remainder for a future pass, not a hidden gap.
