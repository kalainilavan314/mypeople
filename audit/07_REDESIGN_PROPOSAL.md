# 07 — Redesign Strategy

*புதுப்பித்தல் — not a repaint, a set of justified structural moves. Every recommendation here preserves existing capabilities per the audit's ground rules; nothing is removed, only clarified, consolidated, or connected.*

## A. Information architecture

### A1 — Resolve the Home-grid vs. Community-hub duplication (addresses UX-05)
**Keep**: both navigation surfaces — removing either would remove a usable entry point members may already rely on muscle memory for.
**Reposition**: Home's Quick Access grid should show a curated, *personalized* subset (e.g. the member's own pending report status, their next RSVP'd event, a verification-status nudge) rather than a static copy of the Community hub's full catalogue. Community (`BottomNav.tsx:25-31`) remains the exhaustive index of every civic feature.
**Justification**: this isn't "prettier" — it removes a real redundant-decision cost (which of two identical tiles do I tap?) without deleting any destination.

### A2 — Build the missing identity-verification admin screen (addresses DEFECT found in 02/05 — **narrowed after full reads**)
**RESOLVED for donations**: `PartyFund.tsx`'s `ReviewTab` is a real, working, `isAdmin`-gated donation-review screen — no action needed there.
**Still open**: identity-verification review (`POST /api/members/:id/verification`) has no frontend anywhere in this repo, confirmed by reading all 28 screens. **Introduce**: a new admin screen mirroring `ReviewTab`'s own pattern (pending-queue fetch, per-item approve/reject, image/detail preview) — the codebase already proves this pattern works, so this is a template-reuse task, not a new design problem.

### A3 — Retire the orphaned legacy report pair, don't reconnect (addresses DEFECT-02, **revised after full reads**)
**Keep** the feature's intent (status visibility) — but it's already met: `Reports.tsx` (now fully read) shows an inline 4-stage status bar per report in its own "My Reports" list.
**Introduce**: delete `ReportNew.tsx` and `ReportDetail.tsx` (pending user confirmation, per this audit's no-code-change rule) rather than wiring a route to them — both target an abandoned mock `Report` contract (`audioUrl`/`lat`/`lng`/`timeline[]`) that the live `CommunityReport` model has superseded. If a richer per-report detail view (e.g. full timeline with coordinator notes) is still wanted, it should be built fresh against `CommunityReport`, not revived from these files.

### A4 (new) — Fix the fake event check-in (addresses DEFECT-03, Critical — the most severe new finding of this pass)
**Keep**: the check-in UI concept and the "points for check-in" reward framing — it's a good engagement mechanic.
**Introduce**: rebuild `EventDetail.tsx` against the already-correct `GET /api/events/:id` and real RSVP endpoints; either build a real check-in-redemption server endpoint before re-enabling the check-in card, or hide it behind the same kind of server-driven feature flag `PartyFund.tsx`'s `cardEnabled` already demonstrates works well for exactly this "don't show an option that doesn't really work" problem.

### A5 (new) — Unify the tier ladder (addresses DEFECT-04)
**Introduce**: point `Milestones.tsx` at the same `theme/tiers.ts` ladder `Card.tsx` already uses (`volunteer/diamond/gold/platinum`); retire the old `sprout/root/palmyra` map in `theme/tokens.ts` once nothing references it.
**Justification**: two live, contradictory tier ladders one screen-transition apart is a direct trust/comprehension cost, not a cosmetic nit.

### A6 (new) — Wire or honestly disable Privacy's dead buttons (addresses DEFECT-05)
**Introduce**: "Download my data," "Privacy policy," and "Delete membership" each either perform a real action or are visibly marked not-yet-available (disabled state + "coming soon" sublabel), matching the honest-disclosure pattern this app already does well elsewhere (verification badges, PartyFund's sandbox note).

## B. Journey-level improvements

### B1 — Password recovery (addresses DEFECT-01, Critical)
**Remove nothing visible to the user** — but the underlying mechanism must change: replace the fabricated "reset sent" success state in `Forgot.tsx` with an honest flow. Two viable directions, either acceptable depending on the product's resourcing:
- *Minimal*: `Forgot.tsx` tells the member to contact their ward coordinator / a support WhatsApp number to reset their password (honest, works today, zero backend change).
- *Full*: build `/api/auth/request-password-reset` (NIC → verified phone on file → SMS code → password change), reusing the OTP throttling infrastructure already built for signup (`server/src/throttle.js`).
**Justification**: this is not a UX polish item — it is a member-facing lie about system state. It must be fixed before any other redesign work on this screen, independent of visual design.

### B2 — Donation trust disclosure (addresses UX-03 — **RESOLVED, confirmed present**)
Full read of `PartyFund.tsx` confirms the disclosure already exists (`fund.sandboxNote` text + visible dev OTP code) and the card method is hidden entirely unless the server opts in. **No action needed.** Suggested polish only: also mention "no real charge occurred" on the success sheet itself, for defense-in-depth.

### B3 — Verification status literacy
**Introduce**: a one-tap "what does this mean?" affordance next to the Home verification badge (`Home.tsx:93-96`) explaining the four states in plain Tamil-first language, since the badge currently assumes the member already understands `nic_format` vs. `identity_confirmed` vs. `review_pending`. **Keep** the existing honest-badge logic (`verify()` function, `Home.tsx:31-38`) exactly as is — it's correct and should not be loosened.

## C. Screen-level layout proposals (textual specs, for the screens actually read in 05)

### C1 — Login (`Login.tsx`)
- **Keep**: segmented Login/Create-account tabs, inline NIC validation, `role="alert"` error box.
- **Introduce**: branch the error message on `ApiError.code` into three distinct, already-i18n-ready strings:
  - `credentials` → existing "wrong NIC/password" copy
  - `rate_limited` → "Too many attempts — try again in {{seconds}}s" using the server's `retry-after` header value, with the button visibly disabled and a countdown instead of just failing silently again
  - `network` → existing offline copy
- Structured spec: `ErrorBanner { variant: 'credentials' | 'rate_limited' | 'network', retryAfterSeconds?: number }` rendered in place of the current single `error` string state.

### C2 — Forgot (`Forgot.tsx`)
- **Remove**: the unconditional success state tied to a call that does nothing real.
- **Introduce** (minimal version): replace the `send()` handler and the post-submit view with a static "contact your coordinator" card: coordinator phone/WhatsApp from a config value, plus the member's own NIC pre-filled into a "tell them this" text block they can copy.
- Structured spec: `RecoveryUnavailable { contactChannel: 'whatsapp' | 'phone', contactValue: string, memberNicMasked: string }`.

### C3 — Home (`Home.tsx`)
- **Keep**: hero, membership-summary card with QR, "Coming up" events list with its correct empty state, "Local Updates" feed.
- **Reposition**: Quick Access grid → rename conceptually to "For you" and populate from live personal state (next RSVP, latest report status, verification nudge, points progress) rather than a static 8-tile menu; move the exhaustive feature menu entirely into the Community hub (already the stated purpose of that tab per `BottomNav.tsx:25-31`'s comment).
- **Consolidate**: fold `useWorkspaceText()` calls into the i18next resource files as a prerequisite — otherwise every copy change on this screen keeps requiring a code deploy.

## D. What is explicitly NOT being proposed

- No removal of the legacy phone-OTP onboarding routes (`/onboarding/*`) — PROJECT.md and `App.tsx:199-206`'s own comment say they're kept for old bookmarks/deep links; removing them would break real inbound links, which is out of scope for a UX audit regardless of how "unused" they look in the main flow. **Noted after reading `Join.tsx`/`Pending.tsx` this pass**: `Pending.tsx`'s "Explore" action bypasses its own "review pending" framing and grants full access immediately (DEFECT-06) — if these routes are kept, that specific behavior should still be fixed, independent of the broader sunset-or-keep question.
- No rename of tiers (sprout/root/palmyra vs. volunteer/diamond/gold/platinum) as a *brand* decision — that's still the user's call. But A5 above is a narrower, non-discretionary fix: whichever name set is chosen, both live screens (`Card.tsx`, `Milestones.tsx`) must agree, which they currently do not.
- No new payment gateway integration — out of scope for a UX audit; flagged as a prerequisite for B2 but the actual PCI/gateway work belongs to a payments-focused engineering task, not this design document.
