# WCAG 2.2 AA Accessibility Acceptance Checklist & Enforcement Protocol

**Document ID:** MP-A11Y-001
**Standard:** W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
**Scope:** My People Platform — Member Mobile (`apps/member-mobile`), Staff Mobile (`apps/staff-mobile`), Admin Web (`apps/admin-web`), and Shared Mobile UI (`packages/mobile-ui`).
**Status:** Canonical Acceptance Gate for Milestone 1.0 (Batch F2) and Gate G1.

---

## 1. Governance & Core Non-Negotiable Invariants

Every screen, dialog, and shared component across all three client applications must satisfy this checklist before release. Automated linting and tests provide baseline guardrails; manual assistive technology verification on physical devices is mandatory for final acceptance.

### 1.1 Typography Lock
* **Tamil Text:** Strictly `Noto Sans Tamil` (`--font-ta` / `font.ta`, weights 400, 600, 700).
* **English & UI Text:** Strictly `Inter` (`--font-ui` / `font.ui`, weights 400, 600, 700).
* **Monospace Identifiers:** Strictly `JetBrains Mono` (`--font-mono` / `font.mono`, weight 400).
* **Rule:** Zero tolerance for ad-hoc font imports, `@font-face` redeclarations, or system font substitutions (`CLAUDE.md`).

### 1.2 Language Presentation Invariants
* **Admin Web (`apps/admin-web`):** English-only interface per developer specification. All accessible names, button labels, validation messages, and ARIA attributes must be rendered in English.
* **Member & Staff Mobile (`apps/member-mobile`, `apps/staff-mobile`):** Strict Tamil-first presentation where bilingual labels appear:
  * Primary Tamil text on top (`lang="ta"`).
  * Supporting English label directly beneath in secondary tone (`lang="en"`).
  * When single-language mode is selected, all accessible labels and status cues must match the active locale.

---

## 2. Measurable Acceptance Criteria & Test Methods

### 2.1 Touch Target & Control Sizing (WCAG 2.5.5, 2.5.8 Level AA)
* **Criterion 2.1.1 (Control Height):** All primary interactive controls (buttons, text inputs, selects, option rows) must have a minimum height of **48 pixels / units** (`control.height = 48` in `@my-people/design-tokens`).
* **Criterion 2.1.2 (Minimum Touch Area):** Every interactive tap target must provide a bounding box of at least **44 × 44 pt** (`control.touchMin = 44`). Where visual elements are smaller (e.g. 20px icons), hit slop (`hitSlop={spacing[2]}`) or padding must expand the touch target to at least 44×44 pt.
* **Criterion 2.1.3 (Target Spacing):** Adjacent interactive targets must maintain at least **8 pixels** (`spacing[2]`) of clearance to prevent accidental touches.
* **Test Method:** Automated inspection via `scripts/accessibility/mobile-ui-contract.mjs` and bounding box measurement in React Native inspector and Chrome DevTools.

### 2.2 Color Contrast & Visual Presentation (WCAG 1.4.3, 1.4.11 Level AA)
* **Criterion 2.2.1 (Body Text Contrast):** All standard text below 18pt regular (or below 14pt bold) must achieve a contrast ratio of at least **4.5:1** against its backing surface.
* **Criterion 2.2.2 (Large Text Contrast):** Headings and large text (>= 18pt regular or >= 14pt bold) must achieve a contrast ratio of at least **3.0:1** against its backing surface.
* **Criterion 2.2.3 (Non-Text Contrast):** User interface component boundaries (input borders, active checkboxes), focus indicators, and graphical icons conveying state must achieve a contrast ratio of at least **3.0:1** against adjacent backgrounds.
* **Criterion 2.2.4 (Approved Token Pairs):**
  * Primary Text on Page: `#0f172a` on `#f8fafc` (**16.5:1** — PASS)
  * Primary Text on Card: `#0f172a` on `#ffffff` (**17.3:1** — PASS)
  * Secondary Text on Card: `#334155` on `#ffffff` (**10.5:1** — PASS)
  * Muted Text on Card: `#475569` on `#ffffff` (**7.4:1** — PASS)
  * On-Primary on Civic Navy: `#ffffff` on `#0f2942` (**14.8:1** — PASS)
  * Success Text on Success Pale: `#047857` on `#ecfdf5` (**5.2:1** — PASS)
  * Warning Text on Warning Pale: `#92400e` on `#fffbeb` (**7.1:1** — PASS)
  * Error Text on Error Pale: `#b91c1c` on `#fef2f2` (**6.8:1** — PASS)
* **Test Method:** Automated mathematical contrast validation in `scripts/accessibility/contrast-contract.mjs` and a computed-style sweep of the public admin sign-in route in `scripts/browser/admin-rendered-dom.mjs`. Authenticated admin screens still need rendered and manual review.

### 2.3 Non-Color State Signaling (WCAG 1.4.1 Level A)
* **Criterion 2.3.1 (Multi-Cue Status):** Color must **never** be used as the sole visual means of conveying status, success, warning, or error.
* **Criterion 2.3.2 (Status Components):** Every `StatusTag` and `StateTag` must pair:
  1. Semantic color tint (green, amber, red, slate);
  2. Distinct visual icon (`checkmark-circle` for verified, `time-outline` for pending, `alert-circle` for error, `ellipse-outline` for neutral);
  3. Explicit text label (e.g. "Approved", "Action Needed", "Rejected").
* **Test Method:** Monochromatic display test (grayscale mode in Android Developer Options / iOS Accessibility) — all states must remain unambiguously distinguishable.

### 2.4 Text Scaling & Reflow (WCAG 1.4.4, 1.4.10 Level AA)
* **Criterion 2.4.1 (200% Text Scaling):** Interfaces must scale cleanly up to 200% without truncation, text overlap, clipping of characters, or loss of functionality.
* **Criterion 2.4.2 (Max Font Size Multiplier):** Mobile components wrapping React Native `Text` (`AppText.tsx`) must set `maxFontSizeMultiplier={2}` to support Android font scaling and iOS Dynamic Type.
* **Criterion 2.4.3 (No Fixed Container Heights):** Text containers, cards, and buttons must use `minHeight` rather than fixed `height` so containers expand vertically as text scales.
* **Test Method:** Set device font size to maximum (200% on iOS / 1.3x–2.0x on Android); verify no ellipsis clipping (`...`) or overflowing buttons.

### 2.5 Tamil Text Rendering & Glyph Clearance
* **Criterion 2.5.1 (Line Height Ratio):** Tamil Unicode glyphs include vertical ascenders (pulli, kombu) and descenders (u-karam, oo-karam). Line height for Tamil text must be at least **1.4x** font size minimum (standard tokens enforce `lineHeightRatio.tamil = 1.65`).
* **Criterion 2.5.2 (Vertical Padding):** Action buttons, input fields, and tags rendering Tamil must provide at least **8px** (`spacing[2]`) vertical padding or centered flex layout to prevent glyph boundary clipping.
* **Test Method:** Visual inspection of vowel markers on characters like `கொ`, `ஸ்ரீ`, `ணு`, `தி` under maximum zoom.

### 2.6 Keyboard Navigation, Focus & Modals (WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7 Level AA)
* **Criterion 2.6.1 (Logical Focus Order):** Tab order must match the natural reading order (left-to-right, top-to-bottom).
* **Criterion 2.6.2 (Focus Visible):** Every interactive control on Admin Web must expose a prominent focus indicator with at least 3:1 contrast against adjacent background (enforced via `focus:ring-2 focus:ring-primary focus:outline-none`).
* **Criterion 2.6.3 (Modal Dialog Trapping):** Modals and slide-overs (`SelectField` picker, decision modals) must trap keyboard focus while open, provide `aria-modal="true"`, prevent background scrolling, and dismiss cleanly via the `Escape` key.
* **Criterion 2.6.4 (Focus Return):** When a modal closes, keyboard focus must return to the trigger element that launched it.
* **Test Method:** Full workflow execution using only `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape` without a mouse.

### 2.7 Form Accessibility, Labels & Error Announcements (WCAG 3.3.1, 3.3.2, 3.3.3, 4.1.3 Level AA)
* **Criterion 2.7.1 (Explicit Labels):** Every input field must have an explicit programmatic label.
  * Web: `<label htmlFor="id">` or `aria-labelledby`.
  * React Native: `accessibilityLabel` or `aria-label`.
* **Criterion 2.7.2 (Error Association):** When validation fails, the invalid input must:
  * Expose invalid state: `aria-invalid="true"` (web) or `accessibilityState={{ invalid: true }}` (mobile).
  * Associate the error message via `aria-describedby="error-id"` or `accessibilityErrorMessage`.
* **Criterion 2.7.3 (Live Region Error Announcement):** Error summaries and dynamic status changes must be announced to screen readers without stealing user focus via `role="alert"` (web) or `accessibilityLiveRegion="polite"` (mobile).
* **Criterion 2.7.4 (Password Reveal Security & Semantics):** Password show/hide toggles must expose `accessibilityRole="button"`, accessible name ("Show password" / "Hide password"), and state `accessibilityState={{ checked: !hidden }}`.
* **Test Method:** Automated form audit and screen-reader test filling invalid forms to ensure errors are announced immediately.

### 2.8 Native Screen Reader Verification (TalkBack & VoiceOver)
* **Criterion 2.8.1 (TalkBack - Android):**
  * Gesture swipe forwards (`Right`) and backwards (`Left`) navigates all content in sequence.
  * Double-tap activates every action.
  * Form inputs announce: Label + Type + Current Value + Hint/Error.
  * Status changes (e.g. countdown timers, upload progress) announce politely.
* **Criterion 2.8.2 (VoiceOver - iOS):**
  * Rotor navigation by Headings (`H1`, `H2`), Form Controls, and Links operates correctly.
  * Semantic roles (Button, Checkbox, Header, Text) announced accurately.
* **Criterion 2.8.3 (No Accidental Shielding):** Non-interactive parent containers must **never** specify `accessible={true}` mechanically, as doing so groups and conceals child text and inputs from assistive technology.
* **Test Method:** Verification on physical devices (Android 14+ with TalkBack, iOS 17+ with VoiceOver).

---

## 3. Screen Acceptance Audit Protocol

For every screen reviewed for release, complete the following evidence checklist:

| Verification Dimension | Automated Tooling | Manual Testing Procedure | Pass Threshold |
|---|---|---|---|
| **Typography** | `npm run test:packages` | Visual inspection of fonts | 100% token usage (`Noto Sans Tamil`, `Inter`, `JetBrains Mono`) |
| **Language** | CI dictionary test | Visual review of labels | Admin: English-only; Mobile: Tamil-first |
| **Touch Targets** | `mobile-ui-contract.mjs` | Physical screen measurement | All touch targets >= 44×44 pt; control height >= 48px |
| **Contrast** | `contrast-contract.mjs`; public sign-in browser sweep | Review each remaining screen and state | Text >= 4.5:1 (3:1 large); Non-text >= 3:1 |
| **Text Scaling** | Max font multiplier tests | Device font scaled to 200% | No clipped text, horizontal overflow, or lost buttons |
| **Keyboard / Focus** | `eslint-plugin-jsx-a11y` | Hardware keyboard navigation | Full tab navigation; visible ring on every control |
| **Screen Reader** | Component role contracts | TalkBack & VoiceOver pass | All roles, labels, hints, and errors vocalized clearly |

---

## 4. Evidence & Release Sign-Off Requirement

No screen may be marked as WCAG 2.2 AA compliant based on automated linters alone. Full certification for Gate G1 requires:
1. Automated CI check suite passing with zero violations.
2. Screen-by-screen audit record documented in `docs/development/accessibility-audit-record.md`.
3. Physical device test run on Android (TalkBack) and iOS (VoiceOver) logged with OS version, device model, and auditor sign-off.
