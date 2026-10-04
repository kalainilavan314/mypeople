# Pre-Implementation Compatibility Report — Uncommitted Working-Tree Diffs vs Proposed Global Design System

Scope: the 8 files modified outside this audit session, read in full via `git diff`, cross-referenced against the six existing audit docs (`GLOBAL_UI_CONSISTENCY_AUDIT.md`, `HEADER_BACK_NAVIGATION_MATRIX.md`, `DESIGN_LANGUAGE_SPEC.md`, `SHARED_COMPONENT_ARCHITECTURE.md`, `SCREEN_MIGRATION_PLAN.md`, `APPROVAL_CHECKLIST.md`). Every claim below is tagged **Verified** (diff lines read directly this pass) or **Assumption** (inferred, not line-confirmed). `global.css`'s diff is 2034 lines; the structurally significant ~1000 lines (bottom-nav/FAB, Home hero/membership/QA-grid/highlights, Profile hero/stats/menu, Community header/hero/involved/explore, Reports header/segmented-tabs) were read in full with line numbers; the remaining CSS (icon-card/menu-row cosmetic rules, idcard/sheet styling carried over unchanged) was sampled by targeted grep for header/back/safe-area/rotation patterns rather than read character-by-character — flagged **Assumption** where relevant below.

---

## 1. `app/src/components/Icon.tsx`

**What changed (Verified):** 17 new icon names added to `IconName` and `paths`: `dotsVertical`, `play`, `arrowRight`, `sparkles`, `settings`, `pencil`, `coins`, `landmark`, `gradCap`, `road`, `droplet`, `trash`, `bolt`, `leaf`, `dotsHorizontal`, `send`, `x` (note: `x` already existed in the original union — only `paths.x` placement shifted). **Bug (Verified):** `pencil` is defined twice in `paths` — once at the top of the new block and again further down inside the same new block (both with identical SVG content), a duplicate object key. TypeScript/ESLint will likely flag this (`no-dupe-keys` or similar); functionally harmless since both definitions are identical, but it is dead code that should be deleted in any later edit of this file.

**Affects:** UI design only (new icon glyphs feeding the other screens' redesigns). No navigation/state/API impact.

**Conflicts with proposed design system:** None directly — `Icon.tsx` is a leaf primitive the design docs already plan to keep using (`IconName` is referenced throughout `SHARED_COMPONENT_ARCHITECTURE.md`'s `AppHeaderProps`/`HeaderActionProps`). The new icons (`settings`, `pencil`, `landmark`, etc.) are consumed by Profile/Reports/Community's redesigns below and would need to remain available to any future `HeaderAction`/`AppButton` icon-variant component.

**Must preserve:** The new icon set — Profile's settings-gear redesign and Reports' category icons depend on it.

**Reuse as-is:** Yes, trivially — icon additions are pure extension, zero risk.

**Broken navigation/interaction:** None introduced by this file.

---

## 2. `app/src/components/BottomNav.tsx`

**What changed (Verified):** The 5-tab model changed shape. Old: Home / Events / Card / Community / Profile, with Card folded into its own tab and `/reports` folded into Community's `match` array. New: Home / Events / **center FAB → `/reports`** / Community / Profile — `/card` moved from being a tab destination to a member of Profile's `match` array (`match: ['/profile', '/card', '/milestones', '/referral', '/privacy', '/language', '/notifications']`), and `/reports` moved out of Community's `match` array into a dedicated `isFab: true` tab rendering a distinct `<button className="work-nav-fab-btn">` with a circular `work-nav-fab` plus-icon and a separate label span. Regular tab icons changed from fixed `size={24}` to `size={22}` with `strokeWidth` now conditional (`2.3` active / `1.8` inactive) instead of a static stroke.

**Affects:** Navigation (tab→route mapping changed) and UI design (new FAB visual, new icon stroke-weight rule).

**Conflicts with proposed design system — real, substantive:**
- `DESIGN_LANGUAGE_SPEC.md` §3 and `SCREEN_MIGRATION_PLAN.md`'s groupings describe the **pre-existing** 5-tab model (Home/Events/Card/Gallery/Profile per the old code comment, or the "Home/Events/center FAB/Community/Profile" groups the audit separately documents as already-current in several places — e.g. `HEADER_BACK_NAVIGATION_MATRIX.md` Corrections #7 explicitly describes `BottomNav.tsx:21-27` wiring the center FAB to `/reports` as **already existing fact**, which matches this diff). This diff is **not** a new design proposal colliding with the audit — it is the literal implementation the audit's Corrections #7 and `SCREEN_MIGRATION_PLAN.md` phase E2 already describe as current/expected state. In other words: the six audit docs were written reading a version of `BottomNav.tsx` that already has the Option-B FAB layout this diff implements. There is no conflict in intent; the risk is purely that the *audit's own line-number citations* (`BottomNav.tsx:13-39`, `:21-27`, `:32`, `:38`) will drift once this diff (or a future one) lands, since line numbers shift.
- Problem #5 in `GLOBAL_UI_CONSISTENCY_AUDIT.md` ("match arrays must be hand-kept in sync with App.tsx") is **not fixed** by this diff — `/card` and `/reports` were simply moved between hand-maintained arrays, the exact fragility the audit flags. `SHARED_COMPONENT_ARCHITECTURE.md` §6's proposed `routeMeta` single-source-of-truth module is still fully applicable and still not implemented.
- The new `work-nav-fab-btn`/`work-nav-fab` CSS (see global.css section below) is a second, FAB-specific visual language inside the same component the audit's Problem #5/§3 describes as "5 slots... FAB: circular, maroon/primary fill" — the color changed from maroon to a navy/blue gradient (`#1468D9` → `#102D55`) in this diff, which the design spec's §3 ("FAB: circular, maroon/primary fill") does not yet account for. This is a new fact the design spec needs to absorb, not a contradiction requiring resolution — but it means **Approval Checklist Q9 ("FAB elevation/style — keep as-is or revise") is now stale**: "as-is" today is a navy gradient, not the maroon fill the checklist's own text describes.

**Must preserve:** The FAB's existing `/reports` target and its `isFab` rendering branch — this is the real, working center-action entry point the audit's migration plan (phase E2) assumes is already correct; do not let a future `AppHeader`/`routeMeta` refactor regress which route the FAB opens.

**Reuse as-is or as basis:** The FAB tab's `isFab` boolean + dedicated render branch is a reasonable foundation for `SHARED_COMPONENT_ARCHITECTURE.md` §6's `routeMeta` migration — the shape (`{ to, label, icon, match, isFab? }`) can become `routeMeta`'s per-tab schema directly rather than being rewritten.

**Broken navigation/interaction (Verified):** None found — `/card` is still reachable (via Profile's menu / Home's Quick Access tile, both unchanged), just no longer a bottom-nav tab destination in its own right; this is a deliberate UX decision already reflected consistently in this diff (Home.tsx's `/card` Quick Access tile and Profile.tsx's edit-card flow both still point at `/card`). `/reports` is still reachable identically, now via the FAB instead of via Community's match list — same destination, same `Reports.tsx`, no dangling references.

---

## 3. `app/src/components/HomeTopBar.tsx`

**What changed (Verified):** Purely cosmetic — the language-switch pill (`topbar-lang`) gained an explicit `color="var(--ink-2)"` on its globe icon, `fontWeight: 600` on the language label span, and a new trailing `chevron` icon rotated 90° (`style={{ transform: 'rotate(90deg)' }}`) to visually suggest the pill opens something.

**Affects:** UI design only.

**Conflicts with proposed design system:** Minor but real — `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #2 explicitly targets "the rotated-`chevron` pattern" as a fix-everywhere item ("ban the rotated-chevron pattern; always use `chevronLeft`" where applicable) and `DESIGN_LANGUAGE_SPEC.md` §2 says "Icon: `chevronLeft` only, everywhere. Retire the rotated-`chevron` pattern." This diff **adds a new instance** of a rotated `chevron` (90°, not 180°, and not as a back-button — it's a disclosure/chevron-down affordance on the language pill, a different semantic use than the back-button case Problem #2 is about). This is not the same bug (it's not masquerading as a back arrow), but it is the same anti-pattern class (rotating a generic chevron via inline `transform` instead of having a dedicated `chevronDown`/`chevronRight` icon) that the audit is trying to eliminate app-wide. A literal reading of "ban the rotated-chevron pattern... always use chevronLeft" would currently break this pill's correct visual intent (a disclosure indicator should NOT be `chevronLeft`), so the design spec's rule needs a scoping clarification: the ban is on rotated-chevron **as a back button substitute**, not on rotated-chevron as a disclosure/expand indicator. This should be made explicit before migration, or implementers will either (a) wrongly "fix" this pill to `chevronLeft` (breaking its meaning) or (b) leave the ambiguity unresolved and reintroduce rotated-chevron elsewhere under the same excuse.

**Must preserve:** The disclosure-chevron visual cue on the language pill — it's a minor, deliberate UX polish improving discoverability (addresses part of what `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #9 calls out as a learnability gap for the language entry point).

**Reuse as-is:** Yes — small enough to keep verbatim; if a `HeaderAction` `variant="chip"` primitive is built per `SHARED_COMPONENT_ARCHITECTURE.md` §3, this pill's exact icon/label/chevron arrangement should become that variant's reference implementation.

**Broken navigation/interaction:** None — still calls `navigate('/language')`, same destination documented in the matrix.

---

## 4. `app/src/screens/auth/Login.tsx`

**What changed (Verified):** Functional/API hardening, not UI: NIC input is now trimmed and upper-cased before validation/submission (`cleanNic = useNic.trim().toUpperCase()`); a `console.error('[Login Error]', err)` was added; error-message branching was extended from a 2-way switch (`network` / everything-else-as-credentials-error) to a 4-way switch handling `network`, a new `too_many_attempts` → `auth.errTooMany`, `invalid_credentials` → `auth.errCredentials`, and a new catch-all `auth.errServer` for any other error code (previously any non-network error was mislabeled as a credentials error).

**Affects:** Functionality and API-integration (error-code handling), not UI design or navigation.

**Conflicts with proposed design system:** None — this file isn't part of the header/nav consistency scope at all; `Login.tsx` is explicitly out of the design docs' visual-migration scope (`SCREEN_MIGRATION_PLAN.md`'s auth/onboarding row says visual migration is out of scope except `BackChip`'s internal wrap). No header/back-button code touched here.

**Must preserve:** The corrected NIC normalization and the new, more accurate error-code branching — this is a real bug fix (previously a server/rate-limit error was shown to the user as "NIC or password is incorrect," which is misleading) and must not be reverted by an unrelated auth-screen visual pass.

**Reuse as-is:** Yes, unconditionally — purely additive correctness fix, zero design-system interaction.

**Broken navigation/interaction:** None. Note: `en.json`/`ta.json` additions of `errTooMany`/`errServer` keys (see below) are required by this file — the two changes are a matched pair across 3 files.

---

## 5. `app/src/i18n/en.json` / `app/src/i18n/ta.json`

**What changed (Verified):** Two new bilingual string pairs added: `auth.errTooMany` / `auth.errServer`, consumed exclusively by `Login.tsx`'s new error-branching (see above). No other keys touched.

**Affects:** Functionality (error messaging) only; no UI-design or navigation surface.

**Conflicts with proposed design system:** None.

**Must preserve:** Yes — required by `Login.tsx`'s new logic; removing these keys without reverting `Login.tsx` would make `t('auth.errTooMany')`/`t('auth.errServer')` fall back to raw keys on screen.

**Reuse as-is:** Yes.

**Broken navigation/interaction:** None.

---

## 6. `app/vite.config.ts`

**What changed (Verified):** One line: the dev-server `/api` proxy's `changeOrigin` flag flipped from `true` to `false`.

**Affects:** API integration (dev-server proxy behavior) only — zero UI/navigation/state surface.

**Conflicts with proposed design system:** None — unrelated layer entirely.

**Must preserve / flag:** This is the one change in the 8 files that is **not** obviously a strict improvement and deserves a second look outside this design audit's scope: `changeOrigin: false` means the proxied request's `Host` header will no longer be rewritten to match the target (`localhost:8787`), which is usually only correct if the backend doesn't care about/validate the `Host` header, or if something else downstream (e.g. a tunnel) depends on the original origin being preserved. Given the comment above this block ("so the same origin (incl. the public tunnel) serves both the app and the API"), this may be an intentional fix for the tunnel use case — but it's a backend/infra concern, not a design-system concern, and should be confirmed with whoever owns the dev proxy before assuming it's safe. **Flagged for the human reviewer, not a design-system blocker.**

**Reuse as-is:** Not a design-system question — out of this report's authority to bless; flag separately.

**Broken navigation/interaction:** N/A (not a UI file).

---

## 7. `app/src/screens/Community.tsx`

**What changed (Verified):** Near-total rebuild. Removed: the old `cm-head`/`AreaMotif` SVG lattice/`cm-area`/`cm-deck`/`DeckTile`/`cm-band`/`EXPLORE` structure and its extensive design-rationale comments (hue-avoidance, depth-ladder reasoning, "two of six tiles are promoted" judgement, the "these three currently show demonstration content" honesty disclaimer for Ideas/Survey/Courses). Added: `cm-head-redesign` header with a new eyebrow+icon row, a `cm-hero-banner` "My Area" hero card showing live `district`/`ds`/`gs` strings sourced from `useMe()`/`useMember()` (previously the old `cm-area` card had no such live district/DS/GN text — it only linked to `/area`), a 6-item `cm-involved-grid` ("Get Involved") with per-tile pastel `bg`/`color`/`glow` hex values, and a 3-item `cm-explore-list` ("Explore & Learn") restyled similarly. The pastel-per-tile color scheme is a direct reversal of the deleted code's explicit design rationale ("nothing on this screen is differentiated by colour... six arbitrary hues is the thing that makes an interface look generated rather than designed").

**Affects:** UI design (header, hero, grid redesign) and, new in this diff, a small amount of state/data (`useMe`/`useMember` now feed real district/DS/GN text into the hero banner — a genuine functional upgrade, previously this data was only reachable one tap away on `/area`).

**Conflicts with proposed design system — significant:**
- **Header**: `Community.tsx`'s header is still a fully bespoke `cm-head-redesign` block (eyebrow icon row + `h1.cm-title` + two `<p>` subtitle lines + two circular action buttons `cm-action-circle-btn` linking to `/events` [search] and `/area` [filters]). `DESIGN_LANGUAGE_SPEC.md` §1a and `SHARED_COMPONENT_ARCHITECTURE.md` §1/§6b explicitly designate Community as the **pilot screen** for `AppHeader variant="root"` specifically *because* its old header had no back button and no known bugs — "Community's current header (`cm-head-redesign`, `Community.tsx:131-149`) has no back button today, so the pilot has nothing to accidentally regress on that axis" (`SCREEN_MIGRATION_PLAN.md` phase C). This diff **redesigns that exact header again**, in place, with new markup and new right-side actions (search → `/events`, filters → `/area` — the same two destinations the old header's "search"/"go to my area" icons pointed to, just relabeled "Search"/"Filters"). The pilot plan's premise — "no visual diff on Community beyond removing the bespoke markup for the shared component" (phase C acceptance criteria) — is now based on a header that no longer exists in the form the audit read. **Before starting the Community pilot, the migration plan's `AppHeader variant="root"` must be built against *this* diff's markup, not the pre-diff markup the audit docs cite by line number.**
- **Right-action placement**: the audit flagged Community's old search icon navigating to `/events` as "a surprising right-action target" (`HEADER_BACK_NAVIGATION_MATRIX.md` row for `/community`). This diff keeps that exact same surprising mapping (`cm-action-circle-btn` → `/events`) and adds a second icon (`sliders` → `/area`, previously labeled "Go to my area," now labeled "Filters" — also not literally a filter). The underlying UX problem the audit flagged is unchanged, just re-skinned.
- **Color/hue rule**: `DESIGN_LANGUAGE_SPEC.md` doesn't explicitly re-state the deleted code's "no per-tile hue" rule as a target-state requirement (it's silent on this), but `SHARED_COMPONENT_ARCHITECTURE.md` §4's `PageSection` and §1's `AppHeader` are both hue-agnostic layout contracts — they don't forbid per-item tint, but they also don't anticipate 9 independent tile color pairs (6 involved + 3 explore) as a pattern to preserve. This is a **design decision gap**, not a code conflict: the human stakeholder should be asked explicitly whether the new pastel-tile treatment is the direction to keep (reversing the prior design rationale) before `PageSection`/tile components are finalized, since building a hue-agnostic shared tile component and then discovering the actual shipped screen wants 9 distinct hues would mean rebuilding it.

**Must preserve (concrete UI/UX improvements in this diff):**
1. Live district/DS/GN text on the My Area hero card, sourced from real `useMe()`/`useMember()` data instead of being hidden one tap away — a genuine functional improvement over the audited version.
2. The "View my area" CTA button inside the hero card (`cm-hero-cta`) — new, more discoverable than the old card's "the whole card is one link" pattern (which the deleted comment itself flagged as needing the circle-decoration note because it wasn't obvious).
3. The "See all" links added to both section headers (`cm-section-see-all` → `/events` and `/ideas` respectively) — new navigational affordances not present in the audited version.

**Reuse as-is or as basis:** The `cm-hero-banner`'s live-data binding (`district`/`ds`/`gs` via `useMe()`/`useMember()`) should be preserved and carried into whatever hero/header component eventually replaces this markup — it is a data-layer improvement independent of the header-chrome question.

**Broken navigation/interaction (Verified):** None found — all `Link to=` targets (`/reports`, `/skills`, `/events`, `/fund`, `/referral`, `/gallery`, `/ideas`, `/survey`, `/courses`, `/area`) resolve to routes confirmed registered in `App.tsx` per the matrix; no new dead links introduced.

---

## 8. `app/src/screens/Home.tsx`

**What changed (Verified):** Extensive rebuild, same registered routes throughout (Verified no new `Link`/`navigate` targets outside the existing route table). Key changes:
- `QUICK` tile color values changed (new hex fg/bg pairs) but same 8 destinations, same order.
- New `HIGHLIGHTS` carousel array (4 cards: `/skills`, `/survey`, `/reports`, `/courses`) feeding a new "Community Highlights" horizontal-scroll section — entirely new UI section, not present in the audited version.
- `verify()` gained a third return field `statusClass` used for CSS-class-based status styling instead of inline-only styling.
- **Hardcoded placeholder data (Verified, real bug):** `const firstName = me ? me.fullName.split(' ')[0] : 'Kalainilavan';` — previously this fell back to `''` (empty string) when `me` is null; it now falls back to a literal first name. Likewise `me?.memberCode || 'WTL-26-3800415'` and `{me?.fullName || 'Kalainilavan'}` render a specific-looking fabricated member ID and name whenever `me` hasn't loaded yet or is null. This directly contradicts the deleted code comment's own stated principle ("real signed QR & honest verification") and is the same class of problem `GLOBAL_UI_CONSISTENCY_AUDIT.md` flags elsewhere (Problem #10's "no fabricated data" concern raised for `cm-band-note`) — a fake-looking real name/ID string shown to a user before their data loads is worse than a loading skeleton or em-dash, because it can be mistaken for real data mid-load. **This should be fixed (revert to an empty/loading placeholder) regardless of the header/design-system migration** — it is a pre-existing-pattern violation, not a header issue, but it's in a file this report was asked to audit.
- `handleShareQR()` — new `navigator.share()` integration with try/catch fallback to `navigate('/card')`. New functionality, not present before.
- Membership card markup fully rebuilt (`home-membership-card`, `home-member-avatar`, `home-member-qr-box`, a new `home-pills-row` of three status pills: Verified Member / Volunteer Tier / Since Aug 2025 — the latter two are **hardcoded, not data-driven** — "Volunteer Tier" and "Since Aug 2025" are static JSX strings, not derived from `me`/`member` fields, which is a smaller version of the same fabricated-data concern above).
- Upcoming-events section rebuilt into a single "featured" swipeable card with paging dots (`activeEventIndex` state) replacing the old 3-item vertical list.

**Affects:** UI design, state (new `activeEventIndex`/carousel state), and a genuine (if small) functionality addition (native share).

**Conflicts with proposed design system:**
- `HomeTopBar` itself is untouched by this diff (handled separately above) but `Home.tsx`'s own hero/membership-card header content is root-tab-shaped content that `DESIGN_LANGUAGE_SPEC.md` §1a's Root Header variant is meant to eventually own (brand/eyebrow row + actions). This diff doesn't touch the header boundary question at all — it only reskins content below the existing `<HomeTopBar />`, so there's no new conflict beyond what `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #7 already describes (Home's header remains its own fourth pattern).
- No header/back-button/bottom-nav code touched in this file, so none of the Approval Checklist's back-button items are affected by this diff specifically.

**Must preserve (concrete UI/UX improvements):**
1. The native Web Share API integration for the membership QR (`handleShareQR`) — genuinely new, useful functionality with a sensible fallback.
2. The "Community Highlights" carousel and "Be part of the change" promo banner — new engagement surfaces not present in the audited baseline; dropping them in a design-system rewrite would be a regression of content, not just chrome.
3. The featured-event-card-with-paging-dots pattern — more information-dense than the old 3-row list (shows venue, attendee count, category tag) and should inform whatever `PageSection`/card primitive eventually standardizes "upcoming item" cards across Home/Events/Reports.

**Must fix before/independent of migration:** The hardcoded `'Kalainilavan'` / `'WTL-26-3800415'` / `'Volunteer Tier'` / `'Since Aug 2025'` placeholder strings — real-looking fabricated data shown on null/loading state, flagged as a correctness bug, not a design-system question.

**Reuse as-is or as basis:** The carousel, promo banner, and share-QR logic are all additive UI/functionality independent of the header-consolidation work and should be carried forward untouched by the `AppHeader`/`BackButton` migration, which only needs to touch the very top `<HomeTopBar />` boundary, not anything below it.

**Broken navigation/interaction (Verified):** None — `navigate('/card')`, `navigate('/gallery')`, `navigate('/area')`, `navigate('/events')`, `navigate('/announcement/' + a.id)` all target routes confirmed registered in `App.tsx` per the matrix; the new `document.getElementById('local-updates-section').scrollIntoView(...)` has a correct fallback to `navigate('/area')` if the element isn't found, so no dead interaction even in a worst case.

---

## 9. `app/src/screens/Profile.tsx`

**What changed (Verified):** Extensive rebuild of markup/class names (`pf-hero` → `pf-hero-container`, new `pf-identity-row`/`pf-avatar-box`/`pf-stats-card`/`pf-menu-card`/`pf-menu-row` component structure replacing the old inline-styled `Row`/`StatCol` helper functions), plus:
- Back button: still `onClick={() => navigate(-1)}`, **unconditional, no guard** — same exact code shape as before (`Icon name="chevronLeth"` → now `chevronLeft` at `color="#ffffff" strokeWidth={2.4}` vs. previously `strokeWidth={2.2}`). **This is the single most important finding for migration sequencing**: `HEADER_BACK_NAVIGATION_MATRIX.md` Corrections #2 and `APPROVAL_CHECKLIST.md` item #15 both treat Profile's unguarded `navigate(-1)` as a known, not-yet-fixed bug that the migration plan schedules for batch E3. This diff touches the exact same back button (restyling it) but does **not** fix the underlying guard issue — it is still live, unchanged in behavior, in the current working tree.
- Settings icon changed from `Icon name="wrench"` to `Icon name="settings"` (the new gear icon added in `Icon.tsx`) — this actually **helps** `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #9 (duplicate settings/language entry points with different iconography): a gear icon is the convention the audit's shared fix recommends ("likely the gear, matching platform convention"). This diff has already made that choice for Profile's entry point; Home's entry point (`HomeTopBar.tsx`'s globe+chevron pill) still uses a different icon. **Approval Checklist item #5 is now partially pre-answered by this diff** (gear, not globe, is Profile's icon) — worth flagging to the stakeholder so the checklist answer is consistent with what's already shipped rather than re-deciding from scratch.
- Back-button size: now CSS-driven via `.pf-icon-btn` at `width: 38px; height: 38px` (confirmed in `global.css` diff) — explicitly smaller than the previous unconfirmed/Inferred size the audit flagged as "likely differs from 44px... not re-verified." This diff **confirms and keeps** Profile's back button at the smallest size in the app (38px, tied with `EditProfile.tsx`'s already-known 38px), directly contradicting `DESIGN_LANGUAGE_SPEC.md` §2's "Size: 44×44 fixed, everywhere — retire 38px."
- **Hardcoded placeholder (Verified, real bug):** `<div className="pf-user-name">{member.fullName || 'dabi'}</div>` — a literal fallback name "dabi" (likely a developer's own name used as a placeholder during testing) shown if `member.fullName` is empty. Same class of issue as Home.tsx's fabricated-data fallback above, but more clearly a leftover dev artifact given the informal lowercase name with no surname. Also `district` fallback `'Nallur'` (hardcoded) when `me?.districtName`/`member.electorateNameEn` are both absent.
- Activity feed empty-state redesigned with a new SVG document-outline illustration and an "Explore Events" CTA (`pf-explore-events-btn`) — new, not present in the audited version (previously just `EmptyState` from `ui.tsx`, now a bespoke illustration). This is a divergence from `ui.tsx`'s shared `EmptyState` component that `SHARED_COMPONENT_ARCHITECTURE.md` §9 explicitly recommends keeping as the one and only empty-state pattern ("`EmptyState` and `QueryBoundary`'s error branch are otherwise sufficient as-is — no new ErrorState/LoadingState component is justified").
- Logout button changed from `Button` (`ui.tsx`'s shared component, `variant="danger" fullWidth icon="logout"`) to a fully bespoke `<button className="pf-logout-btn">` — this is a new, small instance of exactly the kind of ad hoc one-off `ui.tsx`-bypass the audit's Problem #8 is about, introduced in this diff where it did not exist before.

**Affects:** UI design (extensive), and the already-known navigation risk (unguarded `navigate(-1)`) is carried forward unchanged.

**Conflicts with proposed design system — significant, multiple:**
1. Back button remains 38×38 with no history-guard, directly contradicting `DESIGN_LANGUAGE_SPEC.md` §2 (44×44 fixed) and leaving `APPROVAL_CHECKLIST.md` item #15's underlying bug unresolved. `SCREEN_MIGRATION_PLAN.md` phase E3 already plans to fix this by removing Profile's back button entirely (`variant="hero" showBack={false}`) — that plan is still valid and necessary, but it now has to replace *this* diff's `pf-icon-btn`/`pf-hero-top` markup specifically, not the pre-diff markup the audit cites by line number.
2. Custom `pf-logout-btn` bypasses the shared `Button` component the audit explicitly wants kept as the sole button implementation — a small new instance of Problem #8, not present before this diff.
3. Custom activity-empty-state SVG bypasses `ui.tsx`'s `EmptyState`, contradicting `SHARED_COMPONENT_ARCHITECTURE.md` §9's "no new component justified" recommendation — again, a new divergence introduced by this diff, not inherited from before it.

**Must preserve (concrete UI/UX improvements):**
1. Settings icon correctly changed to a gear (`settings`), partially resolving Problem #9 — must not be reverted to `wrench` or changed to something else without also updating Home's entry point to match (per Approval Checklist #5).
2. The redesigned stats card, menu-row structure, and activity-feed illustration are visually coherent improvements over the previous inline-styled version — worth preserving the *content* even if the *empty-state component choice* (bespoke SVG vs. shared `EmptyState`) should be reconsidered.
3. The "Explore Events" CTA inside the empty-activity state — a genuinely useful new affordance (previously the empty state had no action at all).

**Must fix independent of migration:** The hardcoded `'dabi'` name fallback and `'Nallur'` district fallback — both look like dev-time placeholder leftovers and should not ship.

**Reuse as-is or as basis:** The `pf-stats-card`/`StatItem`/`MenuRow` component extraction (already pulled into small named sub-components in this diff, e.g. `StatItem`, `MenuRow`, replacing the old `StatCol`/`Row`) is a reasonable intermediate step toward the shared components `SHARED_COMPONENT_ARCHITECTURE.md` proposes — `MenuRow` in particular is close in shape to what a generic list-row primitive would look like and could inform (not necessarily become) a future shared component.

**Broken navigation/interaction (Verified):** None newly introduced — same unconditional `navigate(-1)` risk as before (pre-existing, not new), same `/profile/edit`, `/language`, `/reports`, `/referral`, `/notifications`, `/privacy` targets, all confirmed registered routes.

---

## 10. `app/src/screens/Reports.tsx`

**What changed (Verified):** Full rebuild of the header and form. Most significant finding: **the header's back button was already fixed to use `chevronLeth` → `chevronLeft` instead of the rotated-180°-`chevron` pattern** (`Icon name="chevronLeft" size={20} color="#102D55" strokeWidth={2.5}` replacing the old `Icon name="chevron" ... style={{ transform: 'rotate(180deg)' }}`). This directly satisfies `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #2 and `APPROVAL_CHECKLIST.md` item #1 for this screen specifically — **already done, ahead of the migration plan**, which had scheduled this exact fix for batch E2 (`/reports`, `/fund`).
- Back-button size, however, is **still 40×40** (`cr-back-btn { width: 40px; height: 40px; ... }`, confirmed in global.css diff) — Problem #3/Checklist item #2's 44×44 standardization is **not** done; this diff fixed the icon but not the size.
- Header restructured into `cr-header` (back button + title block + a new "My Reports" quick-switch button `cr-my-reports-btn` replacing the old tab strip's second tab as a header-level action) plus a separate `cr-segmented-tabs` row duplicating the same tab switch (both `cr-my-reports-btn` and the second `cr-segment-btn` call `setTab(1)` — **two controls now do the identical thing**, a minor new redundancy, not a bug, but worth flagging: previously there was exactly one tab control, now there are two ways to reach "My Reports" from the top of the screen).
- `CATEGORIES` and `PRIORITIES` changed from emoji-based (`🛣️`, `💧`, etc., all one color `CAT_COLOR`) to icon+per-category-hex-pair (`road`/`#102D55`, `water`/`#0284C7`, etc.) — same "colour differentiates categories now" pattern flagged as a design-decision gap for Community above; applies identically here (8 categories × distinct hues, reversing the prior single-color rule).
- Form restructured into 5 numbered steps with step-number badges (`cr-step-num`), a new character counter on the description field (`desc.length}/500`), a new "Use Current Location" button (calls `navigator.geolocation.getCurrentPosition` but the diff's success callback is an empty no-op comment `/* location retrieved */` — **the button is wired to request geolocation but does nothing with the result**, which is either incomplete functionality or a placeholder for a future feature; it does not break anything since the catch is also a no-op, but it's a button that currently has no visible effect when pressed, which could read as broken to a user testing it).
- Default category changed from `null` (nothing pre-selected, user must choose) to `'road'` (pre-selected on load) — a UX behavior change: `onSubmit`'s `if (!category) return setError(...)` validation is now effectively dead code for the category field specifically, since `category` can no longer become falsy after initial mount (`useState<CommunityReportCategory>('road')`, never set back to a falsy value, including after successful submit — `setCategory(null)` was removed from the post-submit reset, confirmed in diff). This is a minor, likely intentional simplification (a sensible default is reasonable UX), but it does mean "road" will be submitted for any user who doesn't notice the category selector, which should be a conscious product decision, not an accidental one.

**Affects:** UI design (header fix + full form redesign) and a very small functionality change (category default, geolocation button wired but inert).

**Conflicts with proposed design system:**
- **Positive**: back-button icon is already `chevronLeft`, ahead of schedule relative to `SCREEN_MIGRATION_PLAN.md` phase E2.
- **Still open**: back-button size (40px, not 44px) and the header is still a fully bespoke `cr-header` implementation, not `ScreenHeader`/`AppHeader`. `SHARED_COMPONENT_ARCHITECTURE.md` §6b's migration mapping for "Reports/PartyFund gradient-with-tabs header" ("Replaced by `AppHeader variant='hero'` for the back+title row... manual `navigate(-1)` buttons deleted and replaced") is still the correct target — this diff changes the bespoke header's internals but does not reduce the number of header implementations in the app; if anything it adds a second internal tab-switch control (`cr-my-reports-btn`) that a future `AppHeader rightActions` slot would need to account for.
- Per-category hue palette: same open design-decision gap noted for Community — Reports now has 8 distinctly-colored category chips, which `DESIGN_LANGUAGE_SPEC.md`/`SHARED_COMPONENT_ARCHITECTURE.md` don't currently model as a target-state pattern.

**Must preserve (concrete UI/UX improvements):**
1. The `chevronLeft` back-icon fix — do not let a later wholesale `AppHeader` migration accidentally regress this by copy-pasting an older reference implementation.
2. The 5-step structure with step-number badges, character counter, and category icon+label chips — meaningfully clearer than the old single flat form; should inform `PageSection`/form-step conventions if the audit's future work touches form screens.
3. The "My Reports" quick-access button in the header — a genuinely useful shortcut (lets a user jump straight to their reports from the header without scrolling to the segmented tabs), should be preserved as a `rightActions` slot item in any future `AppHeader variant="hero"` adoption for this screen.

**Should be fixed/clarified independent of migration:** The dead/no-op geolocation success callback (purely cosmetic currently — button does nothing visible), and confirming whether defaulting `category` to `'road'` (removing the "must explicitly choose" requirement) is an intentional product decision.

**Reuse as-is or as basis:** The step-numbered form structure (`cr-step-head`/`cr-step-num`) is a strong candidate to standardize as a shared "stepped form section" pattern if other multi-step forms exist or are planned elsewhere in the app — not currently proposed in the six audit docs, but consistent with their general "name real duplication, then propose" methodology.

**Broken navigation/interaction (Verified):** None found in routing; the one near-miss is the geolocation button being functionally inert (not broken, just does nothing observable), and the redundant dual tab-switch controls (not broken, just duplicated).

---

## 11. `app/src/styles/global.css`

**What changed (Verified, for the sections read in full):** Supports every screen-level change above — new `.work-nav`/`.work-nav-fab*` rules for the FAB bottom-nav (navy gradient FAB, 50px circle, -12px top offset, `.screen` padding-bottom increased 68px→76px and `.work-nav` height fixed at `64px + safe-bottom` to match), a full new rule set for Home's redesigned hero/membership-card/QA-grid/highlights-carousel/promo-banner, a full new rule set for Profile's `pf-hero-container`/`pf-identity-row`/`pf-stats-card`/`pf-menu-card` (confirming `.pf-icon-btn` at 38×38, not 44×44), a full new rule set for Community's `cm-head-redesign`/`cm-hero-banner`/`cm-involved-*`/`cm-explore-*` classes (old `cm-head`/`cm-area`/`cm-deck`/`cm-tile`/`cm-band` classes and their extensive accessibility/contrast-rationale comments were deleted wholesale, matching the Community.tsx markup rewrite — no orphaned dead CSS left behind for these, confirmed by grep), and a full new rule set for Reports' `cr-header`/`cr-back-btn`/`cr-segmented-tabs`/`cr-cat-grid`/`cr-step-*` classes (confirming `.cr-back-btn` at 40×40). `--safe-top`/`--safe-bottom` usage was preserved consistently in every new header/hero block checked (`pf-hero-container`, `cr-header`), matching the audit's "genuine strength, keep as standard" assessment in `DESIGN_LANGUAGE_SPEC.md` §11. No rotated-180°-`chevron` CSS patterns were found in a targeted grep of the diff.

**Affects:** UI design only (pure styling, no logic).

**Conflicts with proposed design system:** Aggregates every per-screen conflict listed above into one file — this is the file where the migration plan's "extend `ScreenHeader` in place" vs. "each screen still hand-rolls its own header CSS class" tension becomes concrete: `pf-hero-container`, `cr-header`, and `cm-head-redesign` are three more rounds of exactly the bespoke-CSS-per-header pattern `GLOBAL_UI_CONSISTENCY_AUDIT.md` Problem #1 is about, written *after* the audit was presumably being developed, suggesting the two efforts (this ad hoc redesign pass and the design-system audit) were happening concurrently without cross-visibility.

**Must preserve:** All of the per-screen CSS described above, pending the specific component-by-component migration `SHARED_COMPONENT_ARCHITECTURE.md` §6b already plans — none of it should be deleted wholesale; it should be ported into the new shared components' internals (e.g., `pf-hero-container`'s gradient/overlay values become `AppHeader variant="hero"`'s default styling, not thrown away).

**Reuse as-is or as basis:** The FAB CSS (`.work-nav-fab`) and the segmented-tabs CSS (`.cr-segmented-tabs`/`.cr-segment-btn`) are self-contained, already-correct patterns with no audit-flagged issues — safe to carry forward unchanged into any future componentization.

**Broken navigation/interaction:** N/A (CSS-only file, no logic/routing).

---

## Cross-file "Conflicts with proposed Global Design System" summary table

| File | Conflict | Severity | Resolution needed before implementation |
|---|---|---|---|
| `BottomNav.tsx` | Problem #5's hand-maintained `match` arrays still not replaced by `routeMeta`; FAB fill color changed to navy gradient, making Approval Checklist Q9 ("keep FAB as-is") stale against what "as-is" now means | Medium | Re-ask Q9 against the navy-gradient FAB (not maroon); build `routeMeta` against this diff's `{to, label, icon, match, isFab}` shape |
| `HomeTopBar.tsx` | New rotated-90°-`chevron` disclosure icon on the language pill is the same anti-pattern class the audit bans for back buttons, but serves a different (valid) purpose | Low | Clarify `DESIGN_LANGUAGE_SPEC.md` §2's "ban rotated-chevron" rule to scope it to back-button use only, not disclosure/expand indicators |
| `Community.tsx` | Header fully re-rebuilt in `cm-head-redesign` *after* being designated the pilot screen for `AppHeader variant="root"`; right-action icons still map to the same "surprising target" destinations the matrix already flagged; reintroduces per-tile hue differentiation the deleted code's own comments argued against | High (pilot-blocking) | Build `AppHeader variant="root"` against *this* diff's markup, not the pre-diff version the audit docs cite by line number; get explicit stakeholder sign-off on the pastel-tile direction before finalizing `PageSection` |
| `Profile.tsx` | Back button remains 38×38 (not 44×44) with no history-guard — Checklist #15 and Design Spec §2's 44×44 rule both still open; new bespoke `pf-logout-btn` bypasses shared `Button`; new bespoke empty-state SVG bypasses shared `EmptyState` | High (known bug unresolved + 2 new Problem #8/§9 violations) | Batch E3 must target this diff's `pf-hero-top`/`pf-icon-btn` markup; decide whether `pf-logout-btn`/custom empty-state illustration are kept as deliberate exceptions or folded back into `Button`/`EmptyState` |
| `Reports.tsx` | Back-button icon already fixed (`chevronLeft`) but size still 40px, not 44px; header still fully bespoke (`cr-header`), not `ScreenHeader`/`AppHeader`; new redundant dual tab-switch controls; per-category hue palette reintroduced | Medium (partial progress, still needs E2 batch work) | Batch E2 must target this diff's `cr-header`/`cr-back-btn` markup; reconcile `cr-my-reports-btn` with `cr-segment-btn`'s duplicate "My Reports" access; same pastel-hue decision as Community |
| `global.css` | Houses all of the above as concrete CSS; three more bespoke per-screen header/hero class families (`pf-hero-container`, `cr-header`, `cm-head-redesign`) added after/concurrent with the audit, deepening Problem #1 rather than reducing it | High (aggregate) | No deletion — port each class family's visual values into the corresponding `AppHeader` variant's default styling during batch B/C, don't discard |
| Icon.tsx, Login.tsx, en/ta.json, vite.config.ts | No design-system conflict | None | No action needed from the design-system workstream |

## Must-preserve list (concrete UI/UX improvements already in the working tree)

1. **BottomNav**: the working FAB → `/reports` center-action tab (navy gradient, `isFab` branch) — functioning, matches the audit's own documented assumption of current behavior.
2. **HomeTopBar**: the new disclosure-chevron on the language pill — small but real discoverability improvement.
3. **Login**: corrected NIC trim/uppercase normalization and the 4-way error-code branching (`network`/`too_many_attempts`/`invalid_credentials`/generic server error) replacing the old 2-way switch that mislabeled server errors as credential errors.
4. **Community**: live district/DS/GN text sourced from `useMe()`/`useMember()` on the My Area hero card; the new "View my area" CTA; "See all" links on both section headers.
5. **Home**: native Web Share API integration for QR sharing with sensible fallback; the Community Highlights carousel and "Be part of the change" promo banner; the featured-event card with paging dots, attendee count, and category tag (more information-dense than the old 3-row list).
6. **Profile**: settings icon correctly changed to a gear (partially resolves Problem #9 — but must be paired with a matching fix to Home's entry-point icon per Approval Checklist #5); redesigned stats/menu-row structure; "Explore Events" CTA inside the empty-activity state.
7. **Reports**: `chevronLeft` back-icon fix (already ahead of the migration plan's own schedule); 5-step numbered form structure with character counter and icon+label category chips; "My Reports" quick-access button in the header.

## Must-fix independent of the design-system migration (flagged, not part of the header/nav work)

- `Home.tsx`: hardcoded fallback strings `'Kalainilavan'`, `'WTL-26-3800415'`, `'Volunteer Tier'`, `'Since Aug 2025'` shown as if real when `me`/`member` data is null or those fields are absent.
- `Profile.tsx`: hardcoded fallback name `'dabi'` and district `'Nallur'`.
- `Icon.tsx`: duplicate `pencil` key in the `paths` object (harmless but should be cleaned up).
- `Reports.tsx`: inert "Use Current Location" button (geolocation success callback is a no-op); confirm whether defaulting `category` to `'road'` is an intentional product decision, since the "must pick a category" validation is now unreachable.
- `vite.config.ts`: `changeOrigin: false` change should be confirmed with whoever owns the dev-proxy/tunnel setup — plausible intentional fix, but outside this report's authority to bless.

## Recommended safest implementation order, given what's already in the working tree

The existing `SCREEN_MIGRATION_PLAN.md` phase order (A: approve tokens → B: build shared components → C: pilot on Community + Announcement → D: validate → E: batch rollout → F: regression) remains structurally sound, but needs two adjustments because of what's already landed uncommitted:

1. **Before phase A approval sign-off, re-sync the audit docs' line-number citations and "current state" assumptions against these 8 diffs** — several Approval Checklist items (Q9 on FAB style, Q5 on settings/language icon unification) are partially pre-answered by what's already shipped (navy-gradient FAB instead of maroon; gear icon already on Profile). Asking the stakeholder to approve against stale assumptions risks an approval that doesn't match what's actually in the app.
2. **Phase C's Community pilot must be re-scoped to this diff's `cm-head-redesign` markup**, not the pre-diff version `SHARED_COMPONENT_ARCHITECTURE.md`/`HEADER_BACK_NAVIGATION_MATRIX.md` cite by line number — building `AppHeader variant="root"` against now-stale line references would produce a component that doesn't actually match the live screen it's meant to replace.
3. **Phase E2 (`/reports`, `/fund`) should be re-prioritized earlier relative to E3 (`/profile`, `/profile/edit`)** than the current plan implies, specifically because Reports' back-button icon is *already* fixed in the working tree (ahead of schedule) while Profile's back-button bug is *still open and unchanged* — Reports is now the lower-risk, more-done batch, and Profile is unambiguously the higher-risk one carrying a live, unresolved, previously-flagged bug (unguarded `navigate(-1)`). The plan's own stated reasoning for sequencing (Community before Profile, "to avoid conflating pilot risk with bug-fix risk") applies with even more force to Reports vs. Profile now: Reports' header fix is done, isolated, and already proven in production code; Profile's is not.
4. **Before any component-level work in phase B**, route the three newly-added bespoke header/hero CSS families (`pf-hero-container`, `cr-header`, `cm-head-redesign` in `global.css`) through the same "existing-component migration mapping" table in `SHARED_COMPONENT_ARCHITECTURE.md` §6b that was built for the pre-diff versions — the mapping's *intent* (Hero variant for Profile/Reports, Root variant for Community) still holds, but the *source values* to port (colors, sizes, spacing) must be read from these diffs' CSS, not the versions the audit originally read.
5. **Resolve the two open product/design decisions this diff pass surfaced before finalizing `PageSection`/tile components**: (a) whether the newly-reintroduced per-tile/per-category pastel-hue palette (Community's 6+3 tiles, Reports' 8 category chips) is the approved direction — if yes, `PageSection`/`AppButton`'s icon-tile variant need a `tint` prop the current proposals don't have; if no, both screens need another visual pass before their headers/content are componentized together. (b) whether Profile's `pf-logout-btn` and bespoke empty-state illustration are deliberate exceptions to the shared `Button`/`EmptyState` components or should be folded back in — deciding this before phase B avoids building `AppButton`/`EmptyState` extensions twice.
6. **Fix the hardcoded placeholder-data bugs (`Home.tsx`, `Profile.tsx`) in a separate, small, non-design PR before or in parallel with phase A** — they are unrelated to headers/navigation, carry no design-system dependency, and are low-risk, high-value fixes that should not wait on the much larger migration's approval cycle.

---

**No design decision in this report is approved. All items remain pending human approval per `audit/APPROVAL_CHECKLIST.md`.**
