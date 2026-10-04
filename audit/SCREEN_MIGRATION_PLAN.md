# Screen Migration Plan

## Corrections vs the earlier draft of this plan

- The "Special / unclear (needs follow-up read)" group below originally listed `/gallery` and `ReportDetail` as unresolved. Both are now resolved: `Gallery.tsx` has been fully read and confirmed to have **no header, no back button at all** (not just "bespoke hero" — it's header-less), and `ReportDetail`/`ReportNew` are confirmed **orphaned** (no route, no external import anywhere in `app/src`) rather than merely "route registration unconfirmed." Both are reclassified below.
- `/area` (MyArea) and `/card` (Card) were previously grouped under "Nested hero (bespoke hero header)" — this was incorrect. Verified: neither has any header-level back button at all (`MyArea.tsx` uses only `WorkspaceTitle`'s eyebrow/title content, no back affordance; `Card.tsx:126-134` is a plain `<header>` with no back button). They belong in a new group, "Nested, currently header-less," alongside Gallery.
- The Root pilot recommendation changes from Profile to **Community**, and the reasoning is restated below — Profile is higher-risk than originally assessed because of the `navigate(-1)`-with-no-guard finding (Corrections #2 in `HEADER_BACK_NAVIGATION_MATRIX.md`): piloting on Profile means the pilot itself has to resolve a real bug (removing its back button) at the same time as proving the new component, conflating two kinds of risk. Community has no such bug and is root-tab/no-back by nature already, making it the cleaner first proof of `AppHeader variant="root"`.

## Grouping by shared template

**Root tab (bottom-nav destination, no back button)**
- Home (`/`) — `HomeTopBar`, root-brand
- Events (`/events`) — bespoke header, candidate for root-title/root-hero
- Community (`/community`) — `cm-head-redesign`, candidate for root-title
- Profile (`/profile`) — `pf-hero-container`, root-hero

**Nested detail (back button expected, conforms to `ScreenHeader` today)**
- `/announcement/:id`, `/survey`, `/events/:id`, `/milestones`, `/referral`, `/courses`, `/ideas`, `/skills`, `/privacy`, `/notifications`, `/language`

**Nested hero (back button expected, bespoke hero header — the inconsistent group)**
- `/reports`, `/fund`, `/profile/edit`

**Nested, currently header-less (confirmed this pass — no back button exists at all)**
- `/area` (`MyArea.tsx`), `/card` (`Card.tsx:126-134`), `/gallery` (`Gallery.tsx:66-75`) — these gain a back button for the first time during migration, not just a restyled one. Treat as higher-attention-required than a pure visual swap: QA must explicitly confirm a back button now exists and works, since there is no "before" behavior to regress-test against.

**Create/edit form**
- `EditProfile` (`/profile/edit`, currently nested-hero style, not form-specific chrome)

**Auth / onboarding (no tabs, distinct always-light theme)**
- `/login`, `/signup`, `/signup/profile`, `/signup/questions`, `/forgot`, `/welcome`
- Legacy: `/onboarding/join`, `/onboarding/otp`, `/onboarding/nic` (back-target bug confirmed, see Corrections #1 in the matrix — must be fixed as part of touching this screen, independent of header styling), `/onboarding/pending`

**Orphaned — not part of this migration (product decision needed first)**
- `ReportNew.tsx`, `ReportDetail.tsx` — confirmed this pass: no route in `App.tsx`, no import anywhere outside their own files. Do not migrate their headers (they already correctly use `ScreenHeader`) until a product decision determines whether they are wired up, kept as dead code, or deleted. See Approval Checklist.

## Dependency-ordered rollout

**A — Approve tokens + header spec**
- Human sign-off on `DESIGN_LANGUAGE_SPEC.md` open items: back icon/size, root-header variant choice (brand vs hero vs title per screen), bottom-nav-always-visible decision, settings-entry-point consolidation, Material-3 secondary palette fate. See `APPROVAL_CHECKLIST.md` — nothing in B-F should start before this.

**B — Build shared components**
- `AppButton` icon variant (extends existing `ui.tsx` `Button`) → unlocks `BackButton`/`HeaderAction` as thin wrappers.
- `BackButton`, `HeaderAction`, `AppHeader` (all variants), `PageSection`, `Spinner` extraction.
- `routeMeta` module replacing `BottomNav.tsx`'s inline `match` arrays.
- Each new component ships beside the old ones, unused by any screen yet — zero visual change in this phase.

**C — Pilot on one root tab + one nested screen**
- Root pilot: **Community** (`/community`), not Profile. Justification: Community is already root-tab/no-back by nature (Problem #6), so piloting `AppHeader variant="root"` there proves the component without simultaneously having to fix a live bug — unlike Profile, which first needs its unguarded `navigate(-1)` back button removed (Corrections #2) before it can safely become the hero-variant reference. Doing that fix inside the pilot would conflate "does the new component work" with "did we also fix a navigation bug," making a failed pilot ambiguous to diagnose. Community's current header (`cm-head-redesign`, `Community.tsx:131-149`) has no back button today, so the pilot has nothing to accidentally regress on that axis.
- Nested pilot: Announcement (`/announcement/:id`) — already a clean `ScreenHeader` consumer, lowest-risk place to prove `AppHeader variant="nested"` is a drop-in replacement for `ScreenHeader`. Unchanged from the earlier draft; still the right choice (simple screen, no tabs, no hero imagery, no known bugs).
- Profile's hero-variant migration (including removing its back button) happens in batch E3, after the pilot has proven the component works, as its own explicitly-tracked bug fix rather than folded into the pilot.
- Acceptance for this phase: no visual diff on Community beyond removing the bespoke markup for the shared component; Announcement's back button, title, and right-slot (currently unused) behave identically to today.

**D — Validate**
- Manual pass on both pilot screens: direct link (paste the URL fresh, confirm back button doesn't dead-end), Android back gesture / browser back button, offline (toggle network, confirm `OfflineBanner` still renders above the new header), Tamil locale (switch language, confirm title truncation holds for long Tamil strings), viewport sweep (360px, 390px, 768px widths at minimum).
- Any regression here blocks phase E for the affected component.

**E — Roll out in batches**

| Batch | Screens | Why this grouping |
|---|---|---|
| E1 | `/courses`, `/ideas`, `/skills`, `/privacy`, `/notifications`, `/milestones`, `/referral`, `/survey`, `/events/:id`, `/onboarding/otp`, `/onboarding/nic` | Already `ScreenHeader` consumers — mechanical swap to `AppHeader variant="nested"`, lowest risk, proves the pattern at scale. `/onboarding/nic`'s back-target bug (Corrections #1, `/welcome/otp` doesn't exist) is fixed in this same batch since the file is already being touched — change its `onBack` target to the registered `/welcome` route (matching `Otp.tsx`'s correct pattern) or to `/onboarding/otp` if the legacy two-step flow must be preserved; either way, point it at a route that actually exists. |
| E2 | `/reports`, `/fund` | Identical duplicated hero-header code (Problem #6) — fixing both together eliminates the duplication in one PR. Confirms the FAB's existing target (`BottomNav.tsx:21-27` → `/reports`, landing on tab 0/`ReportForm` by default per `Reports.tsx:50`) needs no new route or handler — only the header chrome changes. |
| E3 | `/profile/edit`, `/profile` | Profile's back-button removal (Corrections #2) happens here, deliberately after the Community/Announcement pilot has proven the shared component, so this batch is purely "apply the now-proven pattern + fix the known bug" with a clear rollback point if either regresses. |
| E4 | `/card`, `/area`, `/gallery` | Currently fully header-less screens (confirmed this pass, not just "smallest back button") — each gains a back button for the first time; QA must verify the new back button functions, not just that it looks right, since there is no prior back behavior to compare against. |
| E5 | `/events`, `/community` | `/community` already validated in the pilot (phase C); this batch finishes `/events`'s root-header migration using the same now-proven variant. |
| E6 | Home (`/`) | Highest blast-radius, highest-traffic screen, migrated last after every other root/nested/hero instance has proven stable. |
| — | Auth/onboarding (`/login`, `/signup*`, `/forgot`, `/welcome`, legacy `/onboarding/join`, `/onboarding/pending`) | Explicitly out of scope for visual migration (default is to leave auth's distinct light theme untouched) except `BackChip`'s internal wrap-not-replace change (Shared Component Architecture §2), which is a non-visual refactor and can land independently, in any batch, with no call-site changes. |
| — | `ReportNew.tsx`, `ReportDetail.tsx` | Not scheduled in any batch — orphaned, pending a product decision (see Approval Checklist) on whether to wire them into the router, delete them, or leave them as unreachable dead code. |

**F — Regression pass**
- Full click-through of every route in `HEADER_BACK_NAVIGATION_MATRIX.md` after E6, re-verifying back-button size/icon/behavior and bottom-nav visibility. Language.tsx's two `navigate(-1)` call sites (header back + "save and return" after picking a language) are confirmed non-conflicting as of this pass (see matrix Corrections #4) but should still be clicked through explicitly: tap the header back arrow without picking a language (should return to caller), then pick a language (should save, then also return to caller) — both paths must land on the same screen. `ReportNew`/`ReportDetail` are explicitly excluded from this regression pass since they remain unrouted; do not spend QA time on them until the product decision in the Approval Checklist is made.

## Acceptance criteria (apply at D and F)
- **Consistency**: every nested screen's back button is 44×44, `chevronLeft`, same aria-label pattern; every root screen uses one of the three approved root variants, not a fourth bespoke one.
- **Routing / direct links**: pasting any route's URL directly (cold load, no prior history) must not produce a back button that navigates to a blank/undefined state.
- **Android back gesture / browser history**: back gesture from a nested screen returns to its logical parent, not an arbitrary prior page from unrelated navigation.
- **Keyboard overlap**: any screen with `Field`/textarea inputs must keep the active input visible above the on-screen keyboard (not verified as broken, but must not regress during migration).
- **Offline**: `OfflineBanner` continues to render above the new header without layout shift.
- **Tamil localization**: long Tamil titles in `AppHeader`/`PageSection` truncate or wrap without breaking layout, matching `ScreenHeader.tsx:35`'s existing `min-width: 0` truncation guard.
- **Viewport sizes**: no horizontal scroll or clipped tap targets at 360px width (smallest common Android width) through 768px (small tablet).
