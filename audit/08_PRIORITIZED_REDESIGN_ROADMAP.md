# 08 — Prioritized Roadmap

*எது முதலில்? — what goes first, and why, ranked by real risk evidenced in code, not by visual appeal.*

## P0 — Critical journey failures / trust risks (fix before anything else)

**Two P0 items from the prior pass are now RESOLVED after full reads and are removed from the active list** (kept here, struck through, for traceability):
- ~~Confirm/disclose Party Fund sandbox status~~ — **RESOLVED**: `PartyFund.tsx` (798 lines, now read) discloses sandbox status clearly and hides the card method entirely unless the server explicitly enables it. See 05 UX-03.
- ~~Confirm scope of admin review workflow~~ — **PARTIALLY RESOLVED**: donation review has a real, working in-app screen (`PartyFund.tsx`'s `ReviewTab`). Only identity-verification review remains a confirmed gap (moved to P1 below).

| Item | Affected files | Effort | Risk if deferred | Acceptance criteria | Depends on |
|---|---|---|---|---|---|
| Fix fabricated password-reset success (DEFECT-01) | `app/src/screens/auth/Forgot.tsx` | Small (minimal "contact coordinator" version) / Medium (full SMS reset) | Members permanently locked out, believing help is coming | Screen never claims a reset occurred unless a real mechanism exists; QA script in 09 confirms no code path shows `sent=true` without a real server acknowledgment | None |
| **NEW — Fix the fake Events check-in / mock EventDetail (DEFECT-03)** | `app/src/screens/EventDetail.tsx`, `data/mock/client.ts` | Medium (rebuild against the already-correct `GET /api/events/:id`; either build or hide check-in) | Members believe they're earning real engagement/points credit for check-ins that never reach the server, and RSVP state silently diverges between the Events list and Event detail (two different data stores for the same event) | `EventDetail` reads/writes the real `/api/events/:id` + RSVP endpoints; check-in either calls a real endpoint or the check-in UI is hidden until one exists, matching the `cardEnabled`-style honest-disclosure pattern already proven in `PartyFund.tsx` | None |
| Re-verify server-side admin authorization on donation review (UX-21) | `server/src/index.js:872-895` | Small (a targeted re-check) | If the routes trust the client's `isAdmin` hint rather than independently checking role server-side, any member could call them directly | Confirm (or add) a server-side admin guard on `GET /api/donations/pending` and `POST /api/donations/:id/review` | None |

## P1 — High-impact gaps in shipped-looking features

| Item | Affected files | Effort | Risk if deferred | Acceptance criteria | Depends on |
|---|---|---|---|---|---|
| **REVISED** — Delete the orphaned legacy report pair, don't reconnect (DEFECT-02) | `app/src/screens/ReportDetail.tsx`, `app/src/screens/ReportNew.tsx` | Small (delete, after user confirmation) — or Medium if a *new* detail screen against the real `CommunityReport` contract is wanted instead | Low direct risk (already unreachable), but leaving them risks a future "fix" that reconnects stale, incompatible mock-shaped screens | Files removed (or rebuilt from scratch against `CommunityReport`/`useMyCommunityReports`); `Reports.tsx`'s own inline 4-stage status bar is confirmed to already meet the "track my report's status" promise | User confirmation before deleting any file |
| Build the missing identity-verification review screen | New admin screen; `server/src/index.js:725-756` (`POST /api/members/:id/verification`) already exists | Medium | Coordinators have a real, working donation-review screen but no equivalent for identity verification — confirmed gap after reading all 28 screens, not just inferred | A gated (`isAdmin`) screen lists pending verification requests and calls the existing endpoint, mirroring `PartyFund.tsx`'s `ReviewTab` pattern | None — pattern to copy already exists in the codebase |
| Branch Login error states by `ApiError.code` (UX-01) | `app/src/screens/auth/Login.tsx` | Small | Members hammer a correct password during a rate-limit window, worsening their own lockout | Three distinct, correctly-i18n'd messages confirmed via manual QA (see 09) for: bad credentials, rate-limited (with countdown), network error | None |
| Fix tier-system split between Card and Milestones (DEFECT-04) | `app/src/screens/Milestones.tsx`, `app/src/theme/tokens.ts`, `app/src/theme/tiers.ts` | Small–Medium | A member sees two contradictory tier ladders one tap apart; undermines trust in the tier/progress feature generally | `Milestones.tsx` renders the same `volunteer/diamond/gold/platinum` ladder `Card.tsx` uses | None |
| Wire the three dead Privacy buttons or disable them honestly (DEFECT-05) | `app/src/screens/Privacy.tsx` | Small (disable) / Medium (wire "download my data" / "delete membership" to real server actions) | A data-rights screen with non-functional "delete membership" and "download my data" controls is a trust and likely compliance gap | Each button either performs its real action or is visually/semantically marked not-yet-available, never silently inert | May depend on new server endpoints for data export/account deletion if those don't already exist (not traced in this pass) |

## P2 — Design-system consolidation (prerequisite for safe, fast future screen work)

| Item | Affected files | Effort | Risk if deferred | Acceptance criteria | Depends on |
|---|---|---|---|---|---|
| Consolidate dual color-token systems (DS-01) | `app/src/theme/tokens.ts`, `app/src/styles/tokens.css` | Medium | Every new screen risks picking the "wrong" palette, compounding drift | One documented canonical set; the other's names either removed or aliased with a deprecation comment | None, but should land before C3/Home rework |
| Consolidate dual localization systems (DS-02) | `app/src/components/MemberWorkspace.tsx` (`useWorkspaceText`), `app/src/i18n/*.json`, `Home.tsx` | Medium–Large (touches every screen using `useWorkspaceText`) | Content/copy edits keep requiring code deploys instead of translation-file edits; Sinhala-completion work (already behind, `si.json` 195 vs 479 keys) gets harder the longer this persists | `useWorkspaceText` reads from the same i18next resource bundle, or is removed in favor of direct `useTranslation()` calls | None |
| Remove hardcoded hex colors from Home's Quick Access tiles (DS-04) | `app/src/screens/Home.tsx:20-29` | Small | Dark-mode/rebrand passes must hunt one-off hex values by hand | Tile colors sourced from named tokens | DS-01 (do after canonical palette is chosen) |

## P3 — Polish and completeness

| Item | Affected files | Effort | Risk if deferred | Acceptance criteria | Depends on |
|---|---|---|---|---|---|
| Complete Sinhala translation (`si.json`, confirmed 195 of 479 lines present) | `app/src/i18n/si.json` | Medium (translation work, not engineering) | Sinhala-preferring members get an inconsistent fallback-to-Tamil experience; already honestly disclosed as "beta" in `Language.tsx` | `si.json` reaches parity (479 keys) with `ta.json`/`en.json` | None |
| Wire or remove Ideas' dead mic/record button | `app/src/screens/Ideas.tsx:33-35` | Small | Minor — a visible control that does nothing | Button either records or is removed | None |
| Make Referral's WhatsApp/SMS buttons actually open those channels | `app/src/screens/Referral.tsx:39-44` | Small | Labels promise a specific share channel; both just copy to clipboard today | Tapping "WhatsApp" opens a WhatsApp share intent with the code pre-filled (web share API / `wa.me` link), same for SMS | None |
| Wire or honestly disable Skills' availability toggles | `app/src/screens/Skills.tsx:16,35-37` | Small | Toggling "weekends available" etc. is silently discarded on navigation, since it's local-only state | Either persisted via a real mutation or visibly marked as not-yet-saved | None |
| Make Announcement's "Confirm attendance" real or remove it | `app/src/screens/Announcement.tsx:42` | Small | Same local-only-confirmation pattern as DEFECT-03, lower traffic | Confirmation persists via a real call, or the button is relabeled to avoid implying persistence | Lower priority than DEFECT-03 (same root cause, less-used screen) |
| Fix legacy `Pending.tsx` bypassing review (DEFECT-06) | `app/src/screens/onboarding/Pending.tsx:14-17` | Small | A legacy, low-traffic screen tells the member their application is "pending" then grants full access on tap regardless — misleading if this path is ever reached via an old deep link | Either remove the legacy phone-OTP onboarding path entirely (pending the user's answer to the prior pass's sunset question) or make "Explore" reflect real account status | Depends on the user's answer about whether `/onboarding/*` should be sunset (open question, carried from the prior pass, still unanswered) |
| 200%-font-scale accessibility pass (explicitly listed as not done in PROJECT.md) | All screens | Large | Long Tamil strings may overflow fixed-width containers; not yet tested per PROJECT.md's own admission | Manual test at 200% OS font scale across the 5 bottom-nav destinations at minimum | None |
| Reposition Home Quick Access grid to personalized content (A1) | `app/src/screens/Home.tsx` | Medium | Ongoing minor navigation redundancy, not a failure | New tile set ships behind existing routes; no destination removed | DS-02 (copy should be data-driven by then, not hardcoded) |

## Recommended pilot journey for incremental rollout

**Password recovery (B1/P0)** is the recommended pilot: it is small in surface area (one screen, `Forgot.tsx`), has a crisp and verifiable acceptance test (does the screen ever lie about success?), carries the highest user-trust risk of anything found in this audit, and does not require design-system consolidation to ship correctly. It is a clean first slice to prove the team's redesign process end-to-end before tackling Home's larger IA change.
