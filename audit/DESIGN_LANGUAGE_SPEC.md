# Design Language Spec — Target State

Consolidated from existing verified tokens (`app/src/theme/tokens.ts`) and existing CSS (`app/src/styles/global.css`), plus new rules proposed to close gaps found in `GLOBAL_UI_CONSISTENCY_AUDIT.md`. Items marked **[existing]** are already implemented and simply need wider adoption; items marked **[new]** need a decision (see `APPROVAL_CHECKLIST.md`).

## 1. Header variants — FINAL: exactly three

Per explicit instruction, the target state has exactly **three** header variants. Every existing header-ish implementation found in the codebase maps onto one of these three; none is a fourth variant in the target state, even though today's code has at least five parallel implementations (`HomeTopBar`, `cm-head-redesign`, plain `<header>` in Events/Card, `pf-hero-container`, `ScreenHeader`, the Reports/PartyFund gradient header). The mapping of each existing implementation to its target variant is in `SHARED_COMPONENT_ARCHITECTURE.md`.

### 1a. Root Header
Used on every screen that is a direct bottom-nav tab destination with no "came from" screen above it in the stack: `/` (Home), `/events`, `/community`, `/reports` (tab 0 landing), and also the FAB target. Profile is explicitly **excluded** from Root Header and placed in Hero Header instead (see 1c) because it already carries a cover-image treatment that is worth preserving as NorthUnity's identity, not flattening.
- **Layout**: brand/eyebrow row (left-aligned bilingual title, Tamil primary + English secondary per existing `font.ta`/`font.ui` pattern) + up to 2 right-side action icons (e.g. notification bell, language chip). Sticky to top, matching `HomeTopBar.tsx:18-39`'s existing sticky behavior.
- **Back control**: **absent by rule.** A Root Header never renders a back button — there is nothing "back" to a root tab; leaving a tab happens via the bottom nav, not an in-header back arrow. This is a deliberate rule fix: it directly closes the Profile.tsx `navigate(-1)`-with-no-guard risk (Corrections #2) by removing the back button from root screens entirely rather than trying to make `navigate(-1)` safe.
- **Right-action slot**: 0–2 icon buttons, each from the shared `HeaderAction` primitive (44×44 hit target, `chevronLeft`/`bell`/`globe`/`settings` icon set), consistent regardless of which root screen is showing. Fixes Problem #9 (duplicate settings/language entry points with different iconography) by requiring the same icon for the same destination everywhere.
- **Title/subtitle typography**: Tamil primary, `font.ta` 16–18px/600; optional English secondary, `font.ui` 11–12px/400, `c.ink3`.
- **Color/background**: `c.page` background, `c.hairline` 1px bottom border, light mode; dark mode swaps to the dark-theme CSS var set already wired through `data-theme` (per `tokens.ts` header comment) — no new tokens needed, just consistent adoption.
- **Safe-area**: `--safe-top` applied as top padding/inset, matching existing `HomeTopBar` sticky behavior.

### 1b. Nested Header
Used on every screen reached by navigating forward from somewhere else (detail screens, settings sub-screens, forms): `/announcement/:id`, `/survey`, `/events/:id`, `/milestones`, `/referral`, `/courses`, `/ideas`, `/skills`, `/privacy`, `/notifications`, `/language`, `/area`, `/gallery`, `/profile/edit`, `/onboarding/nic`, `/onboarding/otp`. This is the existing `ScreenHeader` component, promoted to be the ONLY nested-header implementation (today it already is the majority pattern; the gap is screens that don't use it at all — `MyArea`/`/area`, `Gallery`, `Card` — and screens with incompatible bespoke headers that need to be re-shaped into it, e.g. `Reports`/`PartyFund`'s gradient-with-tabs header, which keeps its gradient and tabs but swaps its manual 40×40 rotated-chevron button for the shared back control).
- **Layout**: single row — back button (left) + title block (center-left, flex 1) + optional single right action.
- **Back control**: **always present**, 44×44 circular hit target, transparent fill, `chevronLeft` icon (never the rotated-`chevron` pattern), `strokeWidth 2.1`, color `c.ink` (or white/scrim-backed if the nested header sits over imagery, e.g. a future photo-backed detail screen — handled via a `tone="light"|"dark"` prop rather than a new variant). Default behavior is `navigate(-1)`; explicit `onBack` override is used only where history is provably unreliable (the onboarding flow's correct existing pattern) — and any `onBack` override must point at a route that is actually registered in `App.tsx`, which closes the `/welcome/otp` dead-route bug (Corrections #1) by making "target must be a real route" a lint-able rule, not just a convention.
- **Right-action slot**: 0–1 icon action, same `HeaderAction` primitive as Root Header. This is the slot that already exists on `ScreenHeader` (`right?: React.ReactNode`) but has zero real consumers today (Problem #4) — the migration should give it at least one real use (e.g. Gallery's filter toggle, or a share action on Event/Announcement detail) so it's a proven pattern, not a theoretical one.
- **Title/subtitle typography**: identical scale to Root Header (Tamil primary 16px/600, English secondary 11px/400) — same type tokens, smaller container.
- **Color/background**: `c.page` + `c.hairline` bottom border in light mode; dark-mode equivalent via the same `data-theme` CSS var mechanism.
- **Safe-area**: `--safe-top` inset at the header's own top, not the screen body's.

### 1c. Hero Header
Used only where a screen carries a cover-image/branded full-bleed treatment as its primary identity element: `/profile` (member hero: avatar, cover gradient, identity row) and `/login` (branded auth entry: logo, marque, language toggle). This explicitly covers both "Profile's current cover-image header" and "Login's branded header" per instruction — they are visually different content but structurally the same variant: a tall, non-sticky, gradient/image-backed block that the rest of the screen's content overlaps or sits beneath.
- **Layout**: full-bleed gradient/image block, top row reserved for a back control (if applicable — see below) and/or a settings/menu action, title+subtitle stacked beneath, optional identity row (avatar + name + status) beneath that.
- **Back control presence/rule**: **conditional, not a per-screen free choice.** A Hero Header shows a back button only when the screen is reachable as a nested destination from somewhere else (never true for Profile, since Profile is itself a root tab — so Profile's Hero Header drops its back button entirely, closing Corrections #2 the same way Root Header does); Login, when reached as a nested step from Welcome/SignUp, keeps a back control. This makes "does this Hero Header have a back button" a property of the screen's position in the navigation graph, not an arbitrary per-screen decision — eliminating the exact bug class in Corrections #2.
- **Right-action slot**: 0–1 action over the hero image, rendered with a scrim/translucent circular backing for contrast (the existing `pf-icon-btn` treatment, `Profile.tsx:81`, is the right idea — keep the scrim-circle approach, standardize its size at 44×44 to match the other two variants' `HeaderAction`, and standardize its icon set so the same destination always uses the same icon per Problem #9).
- **Title/subtitle typography**: larger scale than Root/Nested — title at `font.head` 22–24px/700, subtitle 13–14px/400, both white/high-contrast over the image, with a scrim gradient underneath for legibility (existing `pf-hero-overlay` approach, `Profile.tsx:75`).
- **Color/background**: gradient or image with a dark overlay scrim for text contrast; this is the one header variant that does NOT simply flip to the standard light/dark `c.*` tokens, because its content is designed to read white-on-image regardless of system theme (same reasoning as the existing "auth is always light" exception documented in `tokens.ts`). Both light and dark mode keep the same hero treatment; only the content beneath the hero (cards, menu rows) follows the theme.
- **Safe-area**: `--safe-top` applied as padding at the very top of the hero block (above the back/action row), not as a separate bar — the hero IS the top bar.

## 2. Back button — standardized geometry (single primitive, used by Nested Header and conditionally by Hero Header; never by Root Header)

- Icon: `chevronLeft` only, everywhere. Retire the rotated-`chevron` pattern (`Reports.tsx:68`, `PartyFund.tsx:90`, `EditProfile.tsx:131`) and `BackChip`'s separate pill treatment as a distinct geometry (see Shared Component Architecture for its migration — it keeps its own color tokens per the "auth is always light" exception, but adopts the same 44×44 circular hit target and `chevronLeft` icon as everything else, dropping its pill/border/shadow treatment as an unnecessary 4th visual language for the same control).
- Size: 44×44 fixed, everywhere — retire 38px (`EditProfile.tsx:129`) and 40px (`Reports.tsx:66`, `PartyFund.tsx:88`).
- Shape: circular. Transparent fill on `c.page` backgrounds (Nested Header); translucent scrim-backed circle on imagery (Hero Header, when present per the position-based rule above).
- Behavior: default `navigate(-1)`; explicit `onBack` only for provably-unreliable-history cases, and only to routes verified present in `App.tsx`'s route table (closes Corrections #1's `/welcome/otp` dead-route bug as a rule, not just a one-off fix).
- Never rendered on Root Header, and never rendered on Hero Header when that screen is itself a root tab (closes Corrections #2's Profile `navigate(-1)`-with-no-guard risk).

## 3. Bottom nav + center FAB **[existing, documented as-is]**

- 5 slots: Home, Events, center FAB (Report), Community, Profile. Reference: `BottomNav.tsx:13-39`.
- FAB: circular, maroon/primary fill, white `plus` icon at 24px, stroke 2.8, elevated above the bar. Reference: `BottomNav.tsx:49-64`, CSS class `.work-nav-fab` (`global.css:410-421`).
- Regular tabs: icon 22px, stroke 1.8 default / 2.3 active, label beneath. Reference: `BottomNav.tsx:67-79`.
- Active state via `aria-current="page"`, styled through `.work-nav button[aria-current]` (`global.css:387-394`).
- Always visible across every authenticated route (no route-level suppression exists — `TabLayout`, `App.tsx:142-152`). **[new — decision needed]** Confirm this is intentional for nested/detail screens (e.g. `/events/:id`, `/announcement/:id`) rather than an oversight. See Approval Checklist Q2.
- Bottom padding safe-area handled via `--safe-bottom` CSS var consistently (`global.css:335,340,351-352,539,583`).

## 4. Button / FAB variants **[existing — `Button` in `ui.tsx`]**

- Variants: `primary` (maroon fill), `secondary` (card bg + border), `ghost` (transparent, maroon text), `success`, `danger`. Reference: `ui.tsx:12,49-55`.
- Height: `control.hSm`, radius `radius.sm`, font `600 16px/1 Inter`. Reference: `ui.tsx:36-41`.
- Disabled state swaps to `c.hairline3`/`c.ink4`, drops shadow. Reference: `ui.tsx:50`.
- **[new]** Add a dedicated icon-only button variant (`control.hIcon` = 44) to formally absorb the ad hoc `pf-icon-btn`, `ev-iconbtn`, rotated-chevron back buttons, and the undocumented `RoundButton` used in `Card.tsx:136`.

## 5. Card / list-item / section-heading patterns **[existing — `ui.tsx`]**

- `Card`: `radius.lg`, `shadow.card` unless `cream` variant (flat, no shadow/border). Reference: `ui.tsx:214-233`.
- `Chip`: pill, 44px tall, active = maroon fill/white text, inactive = card bg/ink text. Reference: `ui.tsx:176-211`.
- `LabelPair`: Tamil primary + English secondary, reusable text block. Reference: `ui.tsx:288-295`.
- Section heading: **[new]** no shared primitive exists; `WorkspaceTitle`'s eyebrow pattern (`MemberWorkspace.tsx:6`) should become the canonical "section/page heading," replacing the bespoke `cm-head-redesign` and plain `<h1>`/`<p>` pairs in `Events.tsx:72-75` and `Card.tsx:128-133`.

## 6. Color / status tokens **[existing — `theme/tokens.ts`]**

| Token | Use |
|---|---|
| `c.maroon` / `maroonHover` / `maroonPressed` / `maroonTint*` | primary accent |
| `c.page` / `pageOuter` / `card` / `cardCream` / `cardWarm` | surfaces |
| `c.ink` / `ink0` / `ink2` / `ink3` / `ink4` | text, descending emphasis |
| `c.hairline` / `hairline2` / `hairline3` | borders, descending strength |
| `c.success` / `successBg`, `warning` / `warningBg`, `error` / `errorBg`, `info` | status semantics, consumed by `StatusPill` (`ui.tsx:298-313`) |
| `c.primary*`, `secondary*`, `tertiary*`, `surfaceVariant` | Material-3-style secondary palette, used by newer screens (Reports/PartyFund gradients) — **[new]** decide whether this second semantic set should be merged into the primary `maroon`/`ink` set or kept as an intentional "hero screen" palette |

All color tokens resolve through CSS vars (`var(--maroon)` etc., `tokens.ts:8-71`) enabling light/dark re-theming at runtime via `data-theme` on `<html>` (per file header comment, `tokens.ts:5-7`) — not independently re-verified against `state/theme.ts` in this pass, flagged **Inferred** based on the token file's own documentation comment.

## 7. Type scale **[existing]**

- `font.ui` / `font.head`: Inter, system fallback. `font.ta`: Inter-first then Noto Sans Tamil (deliberate — comment at `tokens.ts:84-85` explains Noto-first broke English rendering). Reference: `tokens.ts:80-86`.
- Observed sizes in the wild range informally: 11px (header subtitle), 12-13px (captions/labels), 14-16px (body/buttons), 16px (ScreenHeader title), 20-24px (hero/root titles), 28px (Events root title) — **[new]** formalize into a named scale (e.g. `type.caption=12, type.body=14, type.label=15, type.title=18, type.hero=24, type.display=28`) so screens stop picking arbitrary px values.

## 8. Spacing / radii / shadow scale **[existing — partially]**

- `radius.sm` / `lg` / `pill` / `xl` confirmed in use (`ui.tsx`, `PartyFund.tsx:97`). Full numeric scale not re-extracted from `tokens.ts` in this pass — **[new]** confirm/document exact px values.
- `shadow.card` confirmed (`ui.tsx:50,225`, `PartyFund.tsx:97`).
- Spacing is entirely ad hoc inline (`padding: '16px 16px 28px'` appears verbatim in `Privacy.tsx:23`, `Skills.tsx:21`, `Milestones.tsx:21`, `Courses.tsx` area, `Ideas.tsx:28`) — **[new]** promote this repeated literal to a named `space.screenPad` token.

## 9. Input / dialog / sheet patterns **[existing]**

- `Field` component: 56px (`control.h`) single-line / 112px min textarea, `radius.sm`, error-state border + `role="alert"` message, full aria wiring (`aria-invalid`, `aria-describedby`). Reference: `ui.tsx:68-173`. This is a strong, accessible pattern — keep as-is.
- `Toggle`: 48×28 switch, `role="switch"`, `aria-checked`. Reference: `ui.tsx:236-261`.
- Sheet pattern: `topbar-sheet` (native `<dialog>`-style, `::backdrop` styled) used at minimum by `Profile.tsx:578-590`. Reference: `global.css:574,587-589`. **[new]** confirm this is the only sheet/modal pattern in the app or whether others exist unverified.

## 10. Loading / empty / error / offline states

- `QueryBoundary` **[existing]**: loading spinner + bilingual label, error state with retry button, used widely (`ui.tsx:329-345`). Keep as the standard for any async section.
- `EmptyState` **[existing]**: icon + title + optional sub, centered. Reference: `ui.tsx:316-326`. **[new]** Not confirmed to be in active use anywhere in the screens read this pass — verify adoption; if unused, that's its own finding.
- Offline banner **[existing]**: shown app-wide above the screen when `!online`, via `OfflineBanner` in `App.tsx:82-99`, driven by `useOnline` hook.
- Route-chunk loading: `ScreenFallback` (`App.tsx:69-80`) duplicates `QueryBoundary`'s spinner markup instead of sharing a primitive (Problem #10). **[new]** extract shared `Spinner`.

## 11. Responsive / safe-area / keyboard rules **[existing]**

- Safe-area insets consistently referenced via `--safe-top`/`--safe-bottom` across header and nav CSS (`global.css:335,340,351-352,462,539,583,1159`). This is a genuine strength — keep as the standard and require any new header variant to use the same vars rather than hardcoded padding.
- Keyboard-overlap behavior not verified this pass (no textarea-heavy screen's on-focus behavior read) — flagged for the migration plan's validation phase.

## 12. Reduced motion & focus-visible **[existing]**

- `:focus-visible` rule present (`global.css:216`) — not re-read in full for completeness of coverage (does it cover custom buttons with `outline: none`? not verified).
- `@media (prefers-reduced-motion: reduce)` present at two locations (`global.css:271`, `global.css:306`) — good sign of deliberate handling, but the `npmSpin` keyframe animation (used twice, `App.tsx:77`, `ui.tsx:337`) was not confirmed to be covered by either reduced-motion block — **[new]** verify and, if not covered, add it.

## 13. Light/dark theme token mapping **[existing, per tokens.ts header comment — Inferred depth]**

- All `c.*` tokens are CSS var indirections (`tokens.ts:8-71`) toggled by `data-theme` on `<html>`, per the file's own top-of-file comment (`tokens.ts:5-7`). Auth screens are a deliberate, documented exception: always light, never dark, because they render before the stored theme preference resolves (comment block near `tokens.ts` auth section). This exception is a precedent for `BackChip`'s divergent styling (Problem/Matrix: auth `BackChip`) — it is *intentional*, not an inconsistency, and should be documented as such rather than "fixed."
