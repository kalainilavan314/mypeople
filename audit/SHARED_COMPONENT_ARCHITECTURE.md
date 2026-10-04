# Shared Component Architecture — Proposed

Every component below is proposed only because real duplication was found and cited in `GLOBAL_UI_CONSISTENCY_AUDIT.md` (problem numbers referenced, including the Corrections section added after the second evidence-closing pass). No component is proposed speculatively. The header variant set below is FINAL at exactly three values (`root`, `nested`, `hero`), per `DESIGN_LANGUAGE_SPEC.md` §1 — this supersedes the earlier five-value `AppHeaderVariant` draft (`root-brand`/`root-title`/`root-hero`/`nested`/`nested-hero`) that appeared in a prior pass of this document; the five sub-styles still exist as rendering details, but they are not separate variants a caller chooses — `root` always means "no back button, sticky, brand-or-title content," `hero` always means "full-bleed gradient/image block," and whether a `hero` instance shows a back button is derived from the route's position in the nav graph, not a prop the caller sets ad hoc (closes the Profile `navigate(-1)` risk, Corrections #2).

## 1. `AppHeader`
**Justification**: Problems #1, #6, #7 and Corrections items 2/3/5 — five-plus independent header systems (`ScreenHeader`, `HomeTopBar`, `cm-head-redesign`, `pf-hero-container`, the Reports/PartyFund gradient-with-tabs header, and Gallery's/MyArea's/Card's complete absence of any shared header at all) duplicate or omit the same information architecture (back/brand + title + optional subtitle + right actions).

```ts
type AppHeaderVariant = 'root' | 'nested' | 'hero';

interface AppHeaderProps {
  variant: AppHeaderVariant;
  titleTa: string;
  titleEn?: string;
  subtitleTa?: string;            // eyebrow/subtitle text, root + hero
  eyebrow?: string;                // "MY PEOPLE · என் மக்கள்" style, root only
  showBack?: boolean;              // required explicitly for variant="hero" (derived from route graph by the caller,
                                    // never defaulted to true); ignored/forced-false for variant="root"; always true
                                    // for variant="nested"
  onBack?: () => void;             // nested + hero(showBack) only; default = navigate(-1); explicit targets MUST be
                                    // a route registered in App.tsx (closes the /welcome/otp dead-route bug, Corrections #1)
  rightActions?: ReactNode;        // 0-2 HeaderAction elements, all variants
  heroImage?: string;              // hero only
  sticky?: boolean;                // root default true, nested/hero default false
}
```
**Behavior**: `variant='nested'` always renders a back button. `variant='root'` never does, full stop — this is a hard rule, not a per-screen choice, and is the direct fix for Corrections #2 (Profile's unguarded `navigate(-1)` on a root tab: Profile becomes `variant="hero"` with `showBack={false}` once it's confirmed reachable only as a root tab). `variant='hero'` takes an explicit `showBack` boolean that the call site must set based on whether that specific route is ever reached as a nested destination (Login, when entered from a flow with a real "back" target) vs. a root tab (Profile, always `false`). `onBack` defaults to `navigate(-1)`, matching the existing, correct default in `ScreenHeader.tsx:15`, but adds the route-must-exist validation described above.
**Accessible-name rule**: back button `aria-label` always resolves through `t('common.back', 'Back')` (already the pattern in `Reports.tsx:65`, `PartyFund.tsx:87` — just needs to become the *only* pattern, replacing `ScreenHeader.tsx:30`'s hardcoded English-only `"Back"`).
**Back-navigation fallback logic**: if `history.state` has no previous entry in this app's session (e.g. a deep link landed directly on a nested screen), fall back to a sensible parent route rather than calling `navigate(-1)` into nowhere. This is new behavior; `ScreenHeader.tsx:15` today always calls `navigate(-1)` unconditionally — a user who deep-links straight to `/events/:id` could back out of the app. **[flag for approval — needs a parent-route map]**.
**Safe-area handling**: all vertical padding must use `--safe-top`, matching `global.css:462,1159` precedent, not hardcoded.
**Tamil long-label handling**: title block must keep the existing `flex: 1; min-width: 0` truncation container (`ScreenHeader.tsx:35`) so long Tamil strings ellipsis rather than push the right action off-screen; English subtitle must remain optional/omittable, as today.

## 2. `BackButton`
**Justification**: Problems #2, #3 — icon (`chevronLeft` vs rotated `chevron`) and size (38/40/44px) vary across `Reports.tsx:63-69`, `PartyFund.tsx:85-91`, `EditProfile.tsx:126-132`, `Profile.tsx:79-86`, `ScreenHeader.tsx:28-34`, plus the stylistically distinct `BackChip` in auth (`parts.tsx:375-386`).

```ts
interface BackButtonProps {
  onClick?: () => void;          // default: navigate(-1)
  onDark?: boolean;               // true on hero/image backgrounds → scrim treatment
  ariaLabel?: string;              // default: t('common.back','Back')
}
```
**Behavior**: fixed 44×44, always `Icon name="chevronLeft"`, never rotation-based. `onDark` swaps icon color to white and adds a subtle scrim circle (generalizing `pf-icon-btn`, `global.css` class referenced at `Profile.tsx:81`) instead of each hero screen inventing its own translucent-button CSS.
**Accessible-name rule**: always bilingual-aware via `t()`, never a bare `"Back"` literal.
**Migration note on `BackChip`** (`parts.tsx:375-386`, used only in `SignUp.tsx:65` and `Forgot.tsx:30` — confirmed by grep this pass, NOT used in `onboarding/*.tsx`, which use `ScreenHeader` instead): per the finalized `DESIGN_LANGUAGE_SPEC.md` §2, `BackChip` is corrected/merged, not left as a fully separate 4th component. It adopts `BackButton`'s 44×44 circular hit target and `chevronLeft` icon (already matches on both counts — `parts.tsx:381` is already 44×44 with `chevronLeft`), and keeps its own `authC` color tokens (pill border + shadow) as a deliberate, documented visual exception for the always-light auth theme — same precedent as `tokens.ts`'s existing "auth is always light" rule. Concretely: `BackChip` becomes a thin wrapper `<BackButton onDark={false} className="auth-pill" />`-equivalent rather than a parallel implementation with its own copy of the back-icon/size logic. Call-site change: none required at `SignUp.tsx:65`/`Forgot.tsx:30` (same `onClick` prop shape); only `parts.tsx`'s internal implementation changes.

## 3. `HeaderAction`
**Justification**: Problem #9 (duplicate settings/language entry points with different icons) plus the general pattern of one-off icon buttons in headers (`Profile.tsx:87-94`'s gear, `HomeTopBar.tsx:28-36`'s bell+lang chip, `Events.tsx:78-80`'s `.ev-iconbtn` search toggle, `Card.tsx:135-139`'s undocumented `RoundButton`).

```ts
interface HeaderActionProps {
  icon: IconName;
  label: string;                  // for aria-label, bilingual-resolved by caller
  onClick: () => void;
  badge?: boolean;                 // red dot, generalizing HomeTopBar's notification dot (HomeTopBar.tsx:30)
  variant?: 'icon' | 'chip';        // 'chip' covers the globe+text+chevron language pattern (HomeTopBar.tsx:32-36)
  onDark?: boolean;
}
```
**Accessible-name rule**: `label` is required (not optional) — forces every call site to supply a real accessible name, closing the gap where some ad hoc icon buttons may have skipped `aria-label` (not individually confirmed missing, but the inconsistency in whether `aria-label` is present should be eliminated by making it a required prop).

## 4. `PageSection`
**Justification**: Problem #6 — `WorkspaceTitle` (`MemberWorkspace.tsx:6`), `cm-head-redesign` (`Community.tsx:131-141`), and the plain `<h1>`/`<p>` pairs in `Events.tsx:69-76` and `Card.tsx:126-134` all implement "eyebrow (optional) + bilingual title + subtitle" with different markup and font sizes.

```ts
interface PageSectionProps {
  eyebrow?: string;
  titleTa: string;
  titleEn?: string;
  subtitleTa?: string;
  subtitleEn?: string;
  size?: 'section' | 'page';       // page = root-title header scale (~24-28px), section = in-page heading scale
}
```
**Tamil long-label handling**: no fixed-width truncation here (unlike `AppHeader`'s title, which must fit beside a back button) — full wrap allowed, since this sits in normal page flow.

## 5. `AppButton` (rename/extend existing `Button`)
**Justification**: Problem #8 — ad hoc icon-buttons (`pf-icon-btn`, `ev-iconbtn`, rotated-chevron back buttons, `RoundButton`) exist only because `Button` in `ui.tsx` has no icon-only variant.

```ts
// Extends existing ButtonVariant union in ui.tsx:12
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'icon';
```
**Behavior**: `variant='icon'` renders a 44×44 circular button with only an `Icon` child, no label, reusing the same `control.hIcon` token proposed in `DESIGN_LANGUAGE_SPEC.md` §4. This absorbs `BackButton`'s and `HeaderAction`'s visual base — `BackButton`/`HeaderAction` become thin semantic wrappers over `AppButton variant="icon"` rather than fully separate implementations, minimizing new surface area.

## 6. `BottomNav` center FAB — no new component, but a routing fix
**Justification**: Problem #5 — `match` arrays in `BottomNav.tsx:13-39` are a hand-maintained shadow of `App.tsx:184-235`'s route table.

Not a new component; a new **data contract**: a single `routeMeta: Record<path, { tab: TabKey }>` module consumed by both `App.tsx` (for route registration, unchanged) and `BottomNav.tsx` (replacing the inline `match` arrays). This directly targets Problem #5's root cause (two hand-synced lists) without touching the FAB's visual design, which is not broken.

## 6b. Existing-component migration mapping (explicit, per-component)

| Existing component/pattern | File:lines | Target | Call-site change |
|---|---|---|---|
| `ScreenHeader` | `ScreenHeader.tsx:13-42` | **Extended in place**, not replaced. Becomes the `variant="nested"` rendering path inside `AppHeader`, or `AppHeader` is implemented as a thin rename of `ScreenHeader` with two new variants added alongside. Preferred: extend, since it is already correct for the majority of screens (incremental consolidation over parallel rebuild, per instruction). | None for existing `ScreenHeader` consumers (`Announcement`, `Survey`, `EventDetail`, `Milestones`, `Referral`, `Courses`, `Ideas`, `Skills`, `Privacy`, `Notifications`, `Language`, `Otp`, `Nic`) — same props, same import, until a later batch renames the import. |
| `BackChip` | `parts.tsx:375-386` | **Wrapped**, not replaced (see §2 note above) — keeps its own file/export, internals delegate to `BackButton`. | None at `SignUp.tsx:65`, `Forgot.tsx:30`. |
| `HomeTopBar` | `HomeTopBar.tsx:18-39` | **Merged into** `AppHeader variant="root"`. `HomeTopBar` becomes a thin call site passing `eyebrow`/`rightActions` to `AppHeader`, or is deleted once `Home.tsx` calls `AppHeader` directly — whichever keeps the diff smaller once implemented; decide at implementation time, not a design-level fork. | `Home.tsx`'s import of `HomeTopBar` either stays (thin wrapper) or is swapped for `AppHeader` — both are compatible with this architecture. |
| `pf-hero-container` (Profile's inline hero markup) | `Profile.tsx:74-147` | **Replaced by** `AppHeader variant="hero" showBack={false}` for the top row + title/subtitle; the avatar/identity row beneath (`Profile.tsx:106-146`) stays screen-specific content rendered below the shared header, not absorbed into `AppHeader` itself (it's profile-specific, not a header concern). | `Profile.tsx`'s back-button JSX (`Profile.tsx:79-86`) is deleted entirely per the `showBack={false}` rule; settings-gear action (`Profile.tsx:87-94`) moves to `rightActions`. |
| Reports/PartyFund gradient-with-tabs header | `Reports.tsx:54-78`, `PartyFund.tsx:82-93` (near-verbatim duplicate) | **Replaced by** `AppHeader variant="hero"` for the back+title row; the gradient wash and tab strip beneath stay screen-specific (tabs are content, not header chrome). | Both files' manual `navigate(-1)` buttons (`Reports.tsx:63-69`, `PartyFund.tsx:85-91`) are deleted and replaced with `<AppHeader variant="hero" onBack={...} />`; fixes the 40×40/rotated-chevron inconsistency in one shared place instead of two duplicated ones. |
| Plain `<header>` in Events/Card/Community/MyArea/Gallery | `Events.tsx:69-82`, `Card.tsx:126-139`, `Community.tsx:131-149`, `MyArea.tsx` (no header read this pass beyond `WorkspaceTitle` import), `Gallery.tsx:66-75` | **Replaced by** `AppHeader variant="root"` (Events, Community — bottom-nav tab targets) or `AppHeader variant="nested"` (Card, MyArea/`/area`, Gallery — all three confirmed this pass to have NO back button today, Corrections #3 for Gallery specifically). This is the single biggest net-new fix: three screens (`Card`, `MyArea`, `Gallery`) gain a back button they currently lack entirely. | Each screen's bespoke header JSX is deleted; `Events.tsx`'s search-icon action and `Card.tsx`'s QR-toggle `RoundButton` move to `rightActions`. |
| `WorkspaceTitle` | `MemberWorkspace.tsx:6` | **Extended**, becomes (or is wrapped by) `PageSection` — not replaced, since it's already close to the target shape (eyebrow + title + sub). | `MyArea.tsx`'s import stays compatible; `Community.tsx`'s bespoke `cm-head-redesign` markup is deleted in favor of calling the same component `MyArea` already uses. |
| `ReportNew.tsx` / `ReportDetail.tsx` | `ReportNew.tsx:13`, `ReportDetail.tsx:9` | **Not migrated — flagged for a product decision, not a design decision.** Confirmed this pass: neither is imported anywhere outside its own file, and neither has a route in `App.tsx`. They already use `ScreenHeader` correctly, so if a future product decision wires them up (e.g. splitting Reports' inline form/detail into real routed sub-screens), no header work is needed — but until that decision is made, they should not be silently deleted during this consistency pass (out of scope) nor assumed reachable. See Approval Checklist. |

## 7. `StatusBadge` — not proposed
No duplication of `StatusPill` (`ui.tsx:298-313`) was found in this pass; it already appears to be the sole status-pill implementation referenced via imports (`EventDetail.tsx:11`, `ReportDetail.tsx:6`, `Referral.tsx`, `Ideas.tsx`). Recommend leaving as-is rather than inventing a parallel `StatusBadge`.

## 8. `AppCard` variants — not proposed as new
`Card` (`ui.tsx:214-233`) with its `cream` boolean already covers the two surface treatments seen in the screens read this pass. No second card implementation was found duplicating it. Recommend no change beyond ensuring new screens keep using it rather than inventing local card markup (not currently a confirmed violation — no evidence found of a duplicate card pattern).

## 9. `EmptyState` / `ErrorState` / `LoadingState`
**Justification**: Problem #10 — `QueryBoundary`'s inline error/loading markup (`ui.tsx:332-343`) duplicates `ScreenFallback`'s spinner (`App.tsx:69-80`) almost exactly, and `EmptyState` (`ui.tsx:316-326`) was not found in active use anywhere in the screens read.

Proposal: extract a `Spinner` primitive (`<Spinner size/>`) consumed by both `ScreenFallback` and `QueryBoundary`'s loading branch, eliminating the duplicate `npmSpin` keyframe + markup (currently defined twice: `App.tsx:77`, `ui.tsx:337`). `QueryBoundary`'s error branch and `EmptyState` are otherwise sufficient as-is — no new `ErrorState`/`LoadingState` component is justified beyond this one extraction, since inventing more would be speculative rather than evidence-based.
