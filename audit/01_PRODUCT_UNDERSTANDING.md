# 01 — Product Understanding

*தொடங்குவோம் (Let's begin). This is a code-grounded read of what NorthUnity actually is today, not what the brief assumed it was.*

## 0. Scope correction (important)

The audit brief handed to this session was written for a **Flutter** mobile app (pubspec.yaml, widgets, ThemeData, Bloc/Riverpod/GetX). This repository is **not** Flutter. Verified stack:

- **Frontend**: React 18 + TypeScript + Vite, PWA via `vite-plugin-pwa` (`app/vite.config.ts:1-56`). Routing: `react-router-dom` (`app/src/App.tsx:2`). Data fetching: `@tanstack/react-query` (`app/src/data/queries.ts`, `app/src/screens/Home.tsx:2`). State: no Redux/Zustand/Bloc — plain module-level stores using `useSyncExternalStore` (`app/src/state/auth.ts:1-38`, `app/src/state/signupDraft.ts`, `app/src/state/theme.ts`).
- **Styling/theming**: no Tailwind config found. Theming is hand-rolled CSS variables (`app/src/styles/tokens.css`) mirrored by TS constants (`app/src/theme/tokens.ts:1-70`) consumed as inline `style={{ font: ... }}` objects throughout screens (e.g. `app/src/screens/Home.tsx:77-84`). Supports light/dark via `data-theme` attribute on `<html>` (`app/src/theme/tokens.ts:5-6`).
- **Localization**: `i18next` / `react-i18next`. Three locale files, line counts VERIFIED directly: `app/src/i18n/ta.json` (479 lines), `app/src/i18n/en.json` (479 lines), `app/src/i18n/si.json` (195 lines, ~41% parity, acknowledged incomplete — falls back to Tamil, and `Language.tsx` itself honestly labels Sinhala "beta"). A second, parallel translation mechanism also exists: inline `t(en, ta)` calls via `useWorkspaceText()` (`app/src/components/MemberWorkspace.tsx`). **Follow-up pass update**: a full read of all 28 screens scopes this precisely to the hub/overview screens — `MyArea.tsx`, `Community.tsx`, and parts of `Home.tsx`/`Profile.tsx` — while every module screen (Reports, PartyFund, Card, Events, EventDetail, EditProfile, Courses, Ideas, Skills, Privacy, Notifications, Gallery, Milestones, Referral, Language, and all of `auth/*`) correctly uses i18next directly. **Two localization systems coexist, but the migration surface is smaller than first estimated** (see 06 DS-07).
- **Backend**: Express + `pg` (node-postgres) against PostgreSQL, in `server/src/index.js` (946 lines) with helpers `db.js`, `lib.js` (JWT/session/NIC hashing), `tier.js` (tier computation), `throttle.js` (rate limiting), `storage.js` (object storage abstraction). Serverless entry `api/[...path].js` wraps the same Express app for Vercel.
- **Deploy**: `vercel.json` (serverless) and `render.yaml` (long-running host) both present — the team is keeping two deploy targets alive simultaneously. **UNKNOWN**: which one is the canonical production target; not stated in either config file beyond mechanics.

## 1. Product purpose (VERIFIED from PROJECT.md + README.md)

NorthUnity (internal name "NPM App" / "My People" in the PWA manifest, `app/vite.config.ts:27`) is a **Tamil-first membership and civic-participation platform** for a political/community movement ("Northern Province People's Movement", வடமாகாண மக்கள் இயக்கம்) in Jaffna, Sri Lanka, explicitly built for **budget Android phones** (`PROJECT.md:3`). It is **not** a generic CRM — it combines:

- Membership identity (digital card, QR check-in, tiers)
- Civic engagement (events, surveys, community reports/issue-reporting, ideas, skills registry, volunteering)
- Movement financing (a "Party Fund" donation flow — card sandbox + bank-slip upload)
- Content distribution (announcements, courses/learning)

PROJECT.md explicitly frames this as a product for a **political movement**, which raises the stakes on privacy, consent, and the honesty of UI claims (verification status, donation status) — the codebase comments show the engineering team is already alert to this (see §3).

## 2. Target users / roles (VERIFIED + INFERRED)

- **Member** (primary persona) — authenticates with NIC + password (`app/src/data/authApi.ts:159-163`, `server/src/index.js:387-421`), no SMS/OTP gate on login. VERIFIED: registration is **fully open** — no invite code, no identity check at signup (`server/src/index.js:23-28` comment block is explicit about this being "a deliberate product choice").
- **Admin / coordinator** — `is_admin` boolean on `npm.member` (`server/migrations/0006_party_fund.sql:9`), gated via `requireAdmin()` (`server/src/index.js:713-717`). Confirmed admin-only endpoints: member verification review (`server/src/index.js:725-756`) and donation slip review (`server/src/index.js:888-895`). INFERRED: this is likely a ward/electorate coordinator role, consistent with PROJECT.md's "ward-coordinator side" mentioned as **not built yet** — meaning today's admin role is a flat superuser flag, not a scoped ward-level permission. No evidence of per-ward admin scoping in `requireAdmin`.
- **Anonymous/unauthenticated visitor** — `/api/events` is readable without auth (`reqContext()` degrades gracefully, `server/src/index.js:492-502`), consistent with a public landing/preview use case. UNKNOWN whether any public (non-PWA) marketing page exists; not found in this repo.

No evidence of a third role tier (e.g., super-admin vs. ward-coordinator vs. district-coordinator) in the current schema — PROJECT.md's richer tier language (Sprout/Root/Palmyra) is a **membership loyalty tier**, not a permission role; it is computed, not authored (`server/src/tier.js`, confirmed by comment in `PROJECT.md`: "Tier = derived, not authored").

## 3. Architecture & data flow (VERIFIED)

- Screens call React Query hooks (`app/src/data/queries.ts`) → an `api` singleton (`app/src/data/index.ts`) → **today this is still a mock, in-memory adapter** (`app/src/data/mock/client.ts`) for most content domains (events list shape, surveys, ideas, courses, skills, badges, notifications, consents) per `app/src/data/api.ts:1-3` and README's explicit "Content APIs still use the mock client for now" (`app/src/data/authApi.ts:3`).
- **Auth, profile, events RSVP, community reports, donations, avatars** have real server-backed routes already (verified above) — meaning **the app is a hybrid**: some domains are production-wired to Postgres, others are still mock data. This is a critical fact for any redesign: changing a "mock" screen's data shape is cheap; changing an "api-backed" screen's data shape requires a server+migration change.
- Session security is cookie-based (`HttpOnly`, `SameSite=Lax`, `Secure` in prod) with CSRF defence-in-depth (`server/src/index.js:96-145`), session revocation via `session_version` bump on logout (`server/src/index.js:424-438`), login throttling by NIC-hash + IP pair (`server/src/index.js:391-409`), OTP throttling (`server/src/index.js:229-246`). This is unusually mature security engineering for a project at this stage — flagged as a **strength**, not an issue, in 10_EXECUTIVE_SUMMARY.

## 4. PWA / offline / responsive support (VERIFIED)

- Full PWA manifest generated via `VitePWA` (`app/vite.config.ts:27-43`): standalone display, Tamil `lang: 'ta'`, maskable icons present.
- Custom service worker using Workbox `injectManifest` strategy (`app/src/sw.ts:1-60`): app-shell navigation fallback, Google Fonts caching, OpenStreetMap tile caching (for the Events map), and a **deliberate non-auto-update** policy — new builds wait for the user to tap "Update now" (`components/UpdatePrompt.tsx`, referenced in `sw.ts:52-54`) rather than silently swapping assets mid-session. This is a thoughtful, non-default engineering choice.
- Offline-first mutation queue: `app/src/data/queue.ts` (IndexedDB outbox) with `client_uuid` idempotency, flushed on `online` event (`App.tsx:116-124`). PROJECT.md's offline design intent (field reports "சேமிக்கப்பட்டது — will sync") is at least partially implemented at the data layer. **Follow-up pass update**: now VERIFIED directly — both `ReportNew.tsx` (line 107-111, `StatusPill` with `reports.willSync`) and `Reports.tsx` (via its `navigator.onLine` branch in `onSubmit`'s catch, line 139) surface offline-aware messaging. However, `ReportNew.tsx` is one of the two orphaned legacy screens (see 05 DEFECT-02) — the offline pill that actually matters in production is the one in the live `Reports.tsx`, which is confirmed present.
- No automated responsive breakpoint system found (no Tailwind, no CSS-in-JS breakpoint library) — layout is primarily single-column mobile-first inline styles. **UNKNOWN** how/whether desktop/tablet widths are handled; not inspected per-screen in this pass.

## 5. Accessibility provisions (VERIFIED, partial)

- Some ARIA present: `role="status"` + `aria-label` on loading spinner and offline banner (`App.tsx:72-98`), `aria-current="page"` on active bottom-nav tab (`BottomNav.tsx:53`), `aria-label` on primary nav (`BottomNav.tsx:45`).
- Avatar `<img alt="">` is empty/decorative in `Home.tsx:101` — acceptable only if the name text next to it already identifies the person (it does, `Home.tsx:104`), so this is fine, not a defect.
- No skip-links, no systematic focus-trap/dialog accessibility pattern found in the files read. **NOT INSPECTED**: form labeling in `onboarding/`, `auth/` screens, and whether Tamil text at 200% zoom was ever tested (PROJECT.md explicitly lists "accessibility pass at 200% font scale" as **not done**).

## 6. What's explicitly admitted as unfinished (VERIFIED, from PROJECT.md / README.md / code comments)

- Ward-coordinator app/role scoping — not built.
- Full Sinhala translation — `si.json` is a stub, 195 vs. 479 keys.
- Automated tests — **none found** in `app/src` or `server/src` (confirmed by filesystem search, see 09).
- Real payment gateway — Party Fund card flow is an explicit, commented **sandbox** (`server/src/index.js:167-177`, `0006_party_fund.sql:3-5`): "no payment gateway behind any of it... unacceptable as a way to take real contributions."
- 200% font-scale accessibility pass — not done (PROJECT.md).

## 7. Domain terminology glossary (VERIFIED)

| Term | Meaning |
|---|---|
| Member | A registered user, identified by NIC |
| Tier (Sprout/Root/Palmyra in PROJECT.md; `volunteer/diamond/gold/platinum` in current `authApi.ts:21`) | Loyalty/engagement level, computed from points + check-ins. **Note, sharpened after full screen reads**: this isn't only a stale-doc issue — `Card.tsx` renders the 4-tier `volunteer/diamond/gold/platinum` ladder live, while `Milestones.tsx` (one tap away) renders the 3-tier `sprout/root/palmyra` ladder live, from two different token files. Both are real, reachable UI. See 05 DEFECT-04 and 06 DS-03. |
| Verification status | `unverified → nic_format → review_pending → identity_confirmed` (`0009_verification.sql:9-13`) — an explicitly honesty-driven state machine added after a prior dishonest default (see audit comment, same file lines 3-7) |
| Party Fund | Donation feature; "card" (sandboxed) or "slip" (bank-deposit photo, admin-reviewed) |
| Community report | Civic issue report (road/water/waste/electricity/agriculture/environment/public_facility/other), replacing the "field report" wording from PROJECT.md |
| district/ds/gs code | Sri Lankan administrative hierarchy (District → Divisional Secretariat → Grama Niladhari division), used for geo-targeting events/reports (`server/src/index.js:613-625`) |
