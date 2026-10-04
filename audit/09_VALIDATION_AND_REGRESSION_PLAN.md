# 09 — Validation & Regression Plan

*சோதனை இல்லை என்றால், நம்பிக்கை இல்லை — no automated tests exist, confirmed by filesystem search (`find . -iname "*.test.*" -o -iname "*.spec.*"` excluding `node_modules` returns nothing). Every check below is manual by necessity.*

## 1. Pre-existing automated coverage: NONE (verified)

- No `*.test.*` / `*.spec.*` files anywhere under `app/src` or `server/src`.
- No test runner (`vitest`, `jest`, `mocha`) config found during exploration of `app/package.json`'s visible scripts (`npm run dev`, `build`, `preview`, `typecheck` only, per README.md).
- `npm run typecheck` is the only existing automated safety net — it catches type errors, not behavioral regressions. **Run this before and after any change** as a minimum bar.

## 2. Manual QA checklist (per fix in the P0/P1 roadmap)

### DEFECT-01 — Password reset honesty
1. Navigate to `/login` → tap "Forgot password" → `/forgot`.
2. Enter a valid-format NIC, submit.
3. **Before fix**: confirm the bug — a generic "reset sent" screen appears with no real backend action (reproduce: watch network tab, confirm no `/api/auth/*reset*` call exists; confirm `api.requestOtp` goes to the mock client).
4. **After fix**: confirm the new screen never claims a reset occurred unless it is backed by a real, observable server action; if the minimal "contact coordinator" version shipped, confirm the coordinator contact value renders correctly in both Tamil and English.

### DEFECT-02 — ReportDetail/ReportNew — **revised to a deletion check, not a reconnection check**
1. Submit a new community report via `/reports`.
2. Confirm it appears in "My Reports" with its inline 4-stage status bar already visible (already working — server-backed, VERIFIED this pass).
3. Confirm `ReportDetail.tsx`/`ReportNew.tsx` are unreferenced anywhere (`grep -rn "ReportDetail\|ReportNew" app/src` should only show their own file definitions) before deleting them.
4. **After the deletion decision ships**: confirm no route or import references the deleted files, and `npm run typecheck`/`build` still pass clean.

### UX-01 — Login error branching
1. Trigger `invalid_credentials`: correct NIC, wrong password → confirm distinct message.
2. Trigger rate-limit: fail login 5+ times rapidly on one account → confirm the server's `retry-after` header value (`server/src/index.js:402-406`) is reflected in the UI as a countdown, not a generic error.
3. Trigger network error: disable network, submit → confirm offline-specific message.

### UX-03 / B2 — Party Fund sandbox disclosure — **RESOLVED, kept as a regression check**
1. Confirmed present this pass by full read: `fund.sandboxNote` text under Card Details, and the dev OTP code shown in a labelled box in the OTP sheet.
2. Regression check only (no fix needed): toggle `cardPaymentsEnabled` off server-side → confirm the card method tile disappears from `PartyFund.tsx`'s method grid entirely, in both `ta` and `en`.
3. Confirm `GET /api/config`'s `cardPaymentsEnabled` flag correctly drives `cardEnabled` client-side (`PartyFund.tsx:147-156`) and that `method` is force-cleared if the flag flips false mid-session (lines 159-161) — already verified in code, worth a manual re-check after any change to this file.

### DEFECT-03 (new) — Fake event check-in
1. From `/events`, tap a real event card → confirm `EventDetail.tsx` currently shows data from the mock client, not the event actually tapped (compare title/venue/agenda against what `Events.tsx`'s list showed, or against a direct `GET /api/events/:id` call).
2. Tap "Check In" → confirm the "points earned" pill appears, then navigate away and back → confirm the checked-in state is lost (proving it was never persisted).
3. **After fix**: `EventDetail.tsx` shows the real event's real data; check-in either calls a real, verifiable server endpoint (confirm via network tab + a direct re-fetch of the member's state) or the check-in UI is absent when no such endpoint is configured.

### DEFECT-04 (new) — Tier system split
1. Open `/card`, note the displayed tier name (e.g. "Gold").
2. Tap "View All" under Milestones → confirm (before fix) a different-named 3-tier ladder (sprout/root/palmyra) appears with no visible relationship to "Gold".
3. **After fix**: both screens show the same tier name and the same ladder length.

### DEFECT-05 (new) — Dead Privacy buttons
1. On `/privacy`, tap "Download my data," "Privacy policy," and "Delete membership" in turn → confirm (before fix) none of the three does anything observable.
2. **After fix**: each either performs its real action (confirm via network tab for the two that imply a server call) or is rendered in a visibly disabled/"coming soon" state rather than a fully-interactive-looking control.

### DEFECT-06 (new) — Pending.tsx bypasses review
1. Reach `/onboarding/pending` via the legacy flow.
2. Tap "Explore" → confirm (before fix) it logs the user in immediately regardless of any real verification state.
3. **After fix** (pending the product decision on sunsetting `/onboarding/*`): either this screen is removed, or its action reflects the member's actual verification status rather than unconditionally granting access.

## 3. Regression checklist (run before any merge touching shared systems)

- [ ] `npm run typecheck` passes (app/)
- [ ] Login flow still works for a known-good NIC+password (session cookie set, redirect to `/`)
- [ ] Signup flow (3-step: Join → Profile → Questions) still completes without a server 400 on default/empty-but-valid inputs
- [ ] Bottom nav tab-highlighting still correctly reflects the active route for all 5 tabs, including the nested matches (`Card` matching `/milestones`, `Community` matching 8 sub-routes, `Profile` matching 4 sub-routes — `BottomNav.tsx:24-38`)
- [ ] Offline banner appears/disappears correctly on toggling network (`App.tsx:82-99,116-124`) — test via browser devtools network throttling, not just assumption
- [ ] Service worker update prompt still appears on a new build (`UpdatePrompt.tsx`) rather than silently swapping assets — critical regression target since the team explicitly engineered against silent updates (`sw.ts:52-54` comment)
- [ ] Language switch still respects the "don't override an explicit user choice" rule (`App.tsx:106-114`) after any auth/profile change
- [ ] Any change to `theme/tokens.ts` or `styles/tokens.css` is checked in **both** light and dark mode (`data-theme` toggle)
- [ ] Any change to i18n content is checked in **all three** locales (ta/en/si), acknowledging `si.json` is currently incomplete (195 vs 479 keys) — a missing key should be confirmed to fall back to Tamil, not render a raw key string

## 4. Accessibility checks (manual, no tooling found in repo)

- [ ] Tab through Login, Forgot, SignUp with keyboard only — confirm focus order and visible focus states (not inspected whether CSS defines `:focus-visible` styles anywhere — check `tokens.css`/`global.css` for this before assuming it works)
- [ ] Screen-reader pass (VoiceOver/TalkBack) on: Home membership card (verification badge, name, QR), Login error banner (`role="alert"` already present — confirm it actually announces), BottomNav (`aria-current` already present — confirm tab names are read correctly in Tamil)
- [ ] 200% OS font-scale test across at least Home, Login, Reports composer, Card — PROJECT.md explicitly flags this as never done
- [ ] Color-contrast check of the hardcoded pastel Quick Access tile colors (`Home.tsx:20-29`, e.g. `fg: '#3B82F6'` on `bg: '#EEF5FF'`) against WCAG AA — not calculated in this pass, flag as a concrete to-do with real hex values to check, not a vague "check contrast" note

## 5. Responsive checks

- [ ] Verify app at common Sri Lankan budget-Android viewport widths (360×640, 412×915 — PROJECT.md's explicit target hardware class) since no responsive breakpoint system was found; confirm nothing assumes a wider viewport than that
- [ ] Verify the Events List↔Map toggle and OpenStreetMap tile rendering (`sw.ts:40-49` caches OSM tiles) at those widths — map UIs are the most likely to break on small screens

## 6. What needs real user feedback vs. what is provable from code alone

**Provable from code** (already demonstrated in this audit, re-provable by any engineer): the Forgot-password defect; the ReportDetail/ReportNew orphan pair and its abandoned data contract; **the EventDetail/Events parallel mock-vs-server data stores and the fake check-in (DEFECT-03)**; **the Card-vs-Milestones tier-ladder contradiction (DEFECT-04)**; **the three dead buttons on Privacy (DEFECT-05)**; **Pending.tsx bypassing its own review premise (DEFECT-06)**; the dual token/localization systems (now scoped to hub screens); the honest-verification-badge logic; the confirmed-present sandbox disclosure on card donations; the working donation-admin-review screen; the absence of automated tests; the exact `si.json` completion gap (195/479 lines).

**Needs real user feedback** (cannot be settled by reading source):
- Whether the Home Quick Access / Community hub duplication (UX-05) actually confuses real members, or whether muscle memory makes it a non-issue in practice.
- Whether the verification-status language ("NIC format checked" vs. "Identity verified") is understood by members without further explanation — this is a comprehension question, not a code question.
- Whether Tamil-first members perceive the Noto Sans Tamil / Inter pairing as intended, and whether the current line-length/wrapping choices (e.g. `Home.tsx:84`'s `maxWidth: 250`) cause awkward breaks with real, longer Tamil sentences in production content (not just the sample strings read in this pass).
- Real-world signal on signup completion/drop-off across the 3-step flow — only observable via analytics or field testing, not static code reading.
