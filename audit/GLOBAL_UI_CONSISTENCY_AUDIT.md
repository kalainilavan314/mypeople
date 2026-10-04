# Global UI Consistency Audit — Headers, Back Navigation, Bottom Nav, Design Tokens

## Corrections (added after a second evidence-closing pass — see `HEADER_BACK_NAVIGATION_MATRIX.md` "Corrections" section for full citations)

- **Problem #4** said `ScreenHeader`'s `right` slot is "never used" based on a grep of screens importing `ScreenHeader`. Still true for every screen actually read, but note `ReportNew.tsx`/`ReportDetail.tsx` were included in that reasoning as if they were live, routed screens — they are not. Confirmed this pass: neither file is imported anywhere outside itself and neither has a route in `App.tsx:184-235`. They are dead code, not evidence either way about `right` slot adoption.
- **Problem #5** hedged "Inferred to be nested under query params or not yet wired into App.tsx's route table at all" regarding `ReportDetail`/`ReportNew`. Now confirmed directly: there is no route for either anywhere in `App.tsx`, and no other file imports them. They are fully orphaned, not reachable by any navigation path in the app today.
- **Gallery.tsx back control** was never assessed in the original 10 problems (file was only partially read). Now confirmed as its own, 11th-tier finding: `Gallery.tsx` has no back button, no `ScreenHeader`, and no back-related handler anywhere in the file — the only way to leave `/gallery` is the bottom nav or a hardware/browser back gesture. This is more severe than the "inconsistent back button size/icon" framing of Problems #1-3: it is "zero back affordance," and should be listed as Problem #1b alongside the header-system fragmentation finding.
- **New finding not previously captured**: `Nic.tsx:28` and `Join.tsx:22` both target a route (`/welcome/otp`) that does not exist in `App.tsx`'s route table, so both silently redirect to Home via the catch-all route rather than reaching the intended OTP screen. This is a correctness bug in the legacy onboarding flow, independent of and additional to the header-styling inconsistencies in Problems #1-3.
- **New finding not previously captured**: `Profile.tsx`'s back button (`navigate(-1)`, `Profile.tsx:82`) has no guard for being a root/entry screen, unlike `Otp.tsx`/`Nic.tsx` which correctly override to an explicit target. If `/profile` is ever reached as the first screen in a session (deep link, PWA relaunch), its back button has nothing in-app to return to.
- **New finding not previously captured**: no `popstate`, `history.*`, or `beforeunload` handling exists anywhere in `app/src` — hardware/browser back is entirely default `react-router-dom` behavior with zero app-level interception. This should be stated explicitly as a baseline fact for the design spec rather than left unstated.

Scope: UI design-language and navigation consistency only (not product/feature content — see prior audit/02 and audit/06 for that). Every finding below cites the exact file and line read. "Verified" = code read directly in this session. "Inferred" = reasoned from a verified pattern but not individually re-confirmed for every instance.

## Top 10 problems, ranked by severity

### 1. Three competing header systems for nested/detail screens (Verified)
`ScreenHeader` (`app/src/components/ScreenHeader.tsx:13-42`) is a real shared component — 44×44 back circle, `chevronLeft` icon, Tamil-primary title + optional English subtitle, `right` slot. But at least 6 nested screens bypass it and hand-roll their own header:
- `app/src/screens/Reports.tsx:54-70` — gradient-wash header, 40×40 back button, `chevron` rotated 180° instead of `chevronLeft`.
- `app/src/screens/PartyFund.tsx:82-92` — identical gradient-wash pattern, duplicated almost verbatim from Reports.tsx.
- `app/src/screens/Profile.tsx:74-99` — `pf-hero-container` navy hero with its own `pf-icon-btn` back button (20px icon, white).
- `app/src/screens/EditProfile.tsx:117-135` — separate navy gradient header, 38×38 back button, different icon size (22px) and rotated `chevron` again.
- `app/src/screens/Community.tsx:131-149` — `cm-head-redesign`, no back button at all (it's a root-tab target reached via bottom nav, but also linked from Home tiles).
- `app/src/screens/Events.tsx:69-82` and `app/src/screens/Card.tsx:126-139` — plain `<header>` with title/subtitle, no back control, relying solely on bottom-nav tab state.

Impact: back-button size varies 38/40/44px, icon varies between `chevronLeft` and rotated `chevron`, and back-affordance presence is inconsistent across screens users expect to behave the same way (all are one level below a root tab).
Shared fix: extend `ScreenHeader` with a `variant: 'plain' | 'hero'` prop so hero screens (Profile, EditProfile, Reports, PartyFund) can keep their imagery/gradient but inherit the same back-button geometry, icon, and aria-label logic.
Regression risk: medium — hero headers carry screen-specific actions (Profile's settings icon, EditProfile's avatar) that must be preserved via the existing `right` slot.

### 2. Back button icon is inconsistent even within hand-rolled headers (Verified)
`ScreenHeader.tsx:33` uses `Icon name="chevronLeft"`. But `Reports.tsx:68`, `PartyFund.tsx:90`, and `EditProfile.tsx:131` all use `Icon name="chevron" ... style={{ transform: 'rotate(180deg)' }}` — the same `chevron` glyph (`app/src/components/Icon.tsx:106`) rotated by inline style, rather than the dedicated `chevronLeft` glyph (`Icon.tsx:107`) already defined for this exact purpose. `Profile.tsx:85` correctly uses `chevronLeft`.
Impact: subtle rendering differences (rotation can shift optical centering/stroke-cap rendering slightly) and a maintenance trap — two code paths draw "back" visually.
Shared fix: ban the rotated-`chevron` pattern; always use `chevronLeft`.
Regression risk: low — purely visual swap, same bounding box.

### 3. Back-button hit target size varies: 38px, 40px, 44px (Verified)
- `ScreenHeader.tsx:31`: 44×44 (meets WCAG 2.5.5 / Android 48dp-equivalent guidance reasonably).
- `Reports.tsx:66`, `PartyFund.tsx:88`: 40×40.
- `EditProfile.tsx:129`: 38×38 — below the 40px baseline used elsewhere, and furthest from the 44px shared-component standard.
- `Profile.tsx:81` (`pf-icon-btn` class, size not confirmed inline — defined in `global.css`, not re-verified pixel value in this pass — **Inferred** that it differs from 44px because it's a distinct CSS class, not reusing `ScreenHeader`'s inline style).
Impact: touch-target accessibility is inconsistent; smallest (38px) is below common 40px minimum guidance, and definitely below the 44px the project's own primary `ScreenHeader` committed to.
Shared fix: fix back-button size at 44×44 (or 48×48) as a token (`control.hSm` or a new `control.hIcon`), applied everywhere via the shared component.
Regression risk: low.

### 4. `ScreenHeader`'s `right` action slot exists but is never used (Verified)
`ScreenHeader` accepts a `right?: React.ReactNode` prop (`ScreenHeader.tsx:9,39`). A grep across every screen importing `ScreenHeader` (Survey, Skills, Notifications, Courses, Language, Ideas, Announcement, ReportNew, ReportDetail, Referral, Milestones, EventDetail, onboarding/Nic, onboarding/Otp) shows **zero** call sites passing `right=`. Meanwhile screens that need a right-side action (Profile's settings gear, EditProfile's nothing, PartyFund has none in header) solved it by not using `ScreenHeader` at all and hand-building a hero header with its own action button (`Profile.tsx:87-94`).
Impact: the one extensibility point built into the shared header is dead code in practice; every screen that needed a right action chose to abandon the shared component instead of using the documented extension point. Confirms the shared component is being "voted with feet" as insufficient.
Shared fix: audit why screens didn't use `right` — likely because hero/image headers need a layout escape hatch `ScreenHeader` doesn't offer. Add a `variant='hero'` (see #1) so the extension point gets exercised.
Regression risk: low — additive.

### 5. Bottom nav visibility / hierarchy not formally modeled; relies on fragile `match` string arrays (Verified)
`BottomNav.tsx:13-39` defines tab activation via `match: string[]`, e.g. Community's tab matches `['/community', '/area', '/fund', '/ideas', '/skills', '/courses', '/survey', '/gallery']` (`BottomNav.tsx:32`) and Profile's matches `['/profile', '/card', '/milestones', '/referral', '/privacy', '/language', '/notifications']` (`BottomNav.tsx:38`). These lists must be hand-kept in sync with `App.tsx`'s route table (`App.tsx:210-231`) — nothing enforces it. `/announcement/:id`, `/reports` (wait: `/reports` IS matched to the FAB tab at line 25 `match: ['/reports']`, but `ReportDetail`/`ReportNew` presumably live under different routes — not confirmed in App.tsx; only `/reports` is registered, so ReportDetail/ReportNew routing is **Inferred** to be nested under query params or not yet wired into App.tsx's route table at all) and `/announcement/:id`, `/gallery` is matched to Community but Gallery's own header (`Gallery.tsx`) was not fully read for back-button presence.
Impact: any new route added to `App.tsx` without a matching update to `BottomNav.tsx`'s `match` arrays silently shows no active tab (or the wrong one highlighted), and the bottom nav remains visible under `TabLayout` (`App.tsx:150`) for literally every authenticated route including deep detail screens like `/events/:id`, `/announcement/:id`, `/reports` detail work — there is no per-route "hide bottom nav" mechanism at all; `TabLayout` always renders `<BottomNav/>` (`App.tsx:142-152`).
Shared fix: either (a) accept bottom nav is always visible by design (then document it, since nested detail screens showing bottom nav alongside their own back button is itself a pattern decision needing explicit sign-off — see Approval Checklist), or (b) derive tab-match from a single source of truth (a `routeMeta` map consumed by both `App.tsx` and `BottomNav.tsx`).
Regression risk: medium if switching to always-hide-on-nested, since `screen` CSS `padding-bottom: calc(76px + var(--safe-bottom))` (`global.css:340`) assumes the nav is always present.

### 6. Three different "page title" component families for root/landing content (Verified)
- `WorkspaceTitle` (`MemberWorkspace.tsx:6`) — eyebrow + `h1` + `p`, used by `MyArea.tsx:4`.
- Ad hoc `<header className="cm-head-redesign">` with its own eyebrow/title/sub markup (`Community.tsx:131-141`), duplicating `WorkspaceTitle`'s information architecture (eyebrow, title, Tamil sub, English sub) but as bespoke JSX/CSS instead of reusing `WorkspaceTitle`.
- Plain inline `<header style={...}>` with `h1`/`p` built from scratch in `Events.tsx:69-76` and `Card.tsx:126-134`.
Impact: four screens with nearly identical "eyebrow + bilingual title + subtitle" content each re-implement the layout with different font sizes (`Events.tsx:72` uses 28px `font.head`; `Card.tsx:128` uses 24px `font.head`) and different markup, so a future type-scale change requires touching N files instead of one.
Shared fix: generalize `WorkspaceTitle` (or a new `PageHeading`) to cover the hero and plain-header cases, parametrized by size.
Regression risk: low-medium — each screen's exact copy must be preserved.

### 7. `HomeTopBar` is a fourth, Home-only header pattern with no nested-screen equivalent (Verified)
`HomeTopBar.tsx:18-39` is sticky, has the brand mark on the left and notification+language actions on the right, using `.topbar-*` CSS classes (`global.css:462-525`). This is structurally a root-tab header, parallel to what `ScreenHeader` is for nested screens and `cm-head-redesign`/`pf-hero-container` are for other roots — i.e. every root tab (Home, Community, Profile, Events, MyArea/Card as quasi-roots) independently invented its own header rather than sharing one root-header component with a "brand left, actions right" vs "eyebrow+title" variant switch.
Impact: notification bell + language switch (`HomeTopBar.tsx:28-36`) only exists on Home; Profile/Community/Events have no equivalent quick access to notifications/language from their own header, forcing users back to Home or into Profile's settings gear (`Profile.tsx:87-94`) for language — two different entry points to the same `/language` route (`HomeTopBar.tsx:32` and `Profile.tsx:90`).
Shared fix: define one `AppHeader` with `variant: 'root-brand' | 'root-title' | 'nested'`.
Regression risk: medium — Home's sticky positioning and brand-mark tap target must be preserved exactly.

### 8. Design tokens are solid at the primitive layer but screens routinely bypass them with inline magic numbers (Verified)
`theme/tokens.ts` defines `c`, `font`, `radius`, `shadow`, `control` and these are used correctly in `ui.tsx` (e.g. `Button` uses `control.hSm`, `radius.sm`, `shadow.card` — `ui.tsx:36-54`). But screen-level headers consistently hardcode pixel values instead: `Reports.tsx:66` (`width: 40, height: 40`), `EditProfile.tsx:129` (`width: 38, height: 38`), `PartyFund.tsx:88` (`width: 40, height: 40`) — none reference a `control.*` token for "icon button size," because no such token exists yet (`control` in `tokens.ts` was only skimmed for `hSm`/`h`, not a full icon-button entry — **Inferred** no icon-button token exists, based on its absence from every grep hit above).
Impact: token system is being used faithfully inside `ui.tsx` but is silently abandoned at the screen level for anything header/navigation-shaped, which is exactly the area this audit targets.
Shared fix: add `control.hIcon` (44) and `control.hIconSm` (36, if a smaller variant is genuinely needed) to `tokens.ts`, and migrate all ad hoc back/icon buttons onto it.
Regression risk: low.

### 9. Duplicate "settings/language" entry points with different iconography (Verified)
`HomeTopBar.tsx:32-36` exposes language via a pill button (globe icon + "EN"/"த" + chevron). `Profile.tsx:87-94` exposes the same `/language` destination via a plain settings gear icon with no text. A user who learns one affordance will not recognize the other as doing the same thing.
Impact: discoverability / learnability regression, and no single "where do I change settings" mental model.
Shared fix: standardize on one `HeaderAction` icon (likely the gear, matching platform convention) wired to a settings/menu surface; keep the quick-language chip but document it as a deliberate second, faster path if that's wanted (see Approval Checklist).
Regression risk: low.

### 10. No consistent loading/empty/error treatment outside `QueryBoundary` consumers (Verified + Inferred)
`QueryBoundary` (`ui.tsx:329-345`) gives a proper spinner + bilingual retry UI and is imported by `Reports`, `Profile`, `Survey`, `Skills`, `Notifications`, `Courses`, `Ideas`, `Announcement`, `ReportDetail`, `Referral`, `Milestones`, `EventDetail` (per earlier grep of `ScreenHeader` co-imports). But `MyArea.tsx` (entire file, `MyArea.tsx:1-5`) renders directly off `useMe()` with no loading/empty state at all, and `Gallery.tsx` (read through line 40, static `ALBUMS` array, no query) has no boundary need but also sets no precedent for one if data becomes dynamic. `ScreenFallback` (`App.tsx:69-80`) is a *second*, separate loading spinner implementation (different markup, same visual spinner animation `npmSpin`) used only for route-chunk Suspense, duplicating the spinner markup inside `QueryBoundary.tsx:335` almost exactly instead of sharing one `<Spinner/>` primitive.
Impact: two copies of the same spinner animation/markup (`App.tsx:72-77` and `ui.tsx:334-338`) that must be kept visually identical by hand; some screens (MyArea) have no defined loading/error state at all.
Shared fix: extract a `Spinner` primitive used by both `ScreenFallback` and `QueryBoundary`; give `MyArea` a `QueryBoundary` if/when its data becomes async (currently reads synchronously from `useMe()`, so may be a non-issue — flagged as lower-confidence/Inferred until `useMe.ts` is read in full).
Regression risk: low.
