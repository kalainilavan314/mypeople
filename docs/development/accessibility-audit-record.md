# My People (என் மக்கள்) — Accessibility Audit & Verification Record
**Milestone:** M1.0 — Foundations, Accessibility Kit & Go-Live Infrastructure
**Specification:** WCAG 2.2 Level AA, BRD MP-BRD-001 v1.1, Delivery Batches F2 & F3
**Status:** Foundation checks implemented; screen-level and assistive-technology audits pending

---

## 1. Scope Reconciliation

The Phase 1 plan records 54 implemented screens: 38 member, 7 staff and 9 admin. The candidate audit table below contains 74 entries (50 member, 8 staff, 16 admin entries including the shared admin shell). Those entries are not evidence that 74 distinct screens are built or accessible. Several IDs share a route and require separate state-level review. Reconcile each entry with the current screen map before release.

| Surface | Plan's implemented baseline | Candidate audit entries | Screen-level result |
|---|---|---|---|
| **Member Mobile App** (`apps/member-mobile`) | 38 | 50 | Pending |
| **Staff Mobile App** (`apps/staff-mobile`) | 7 | 8 | Pending |
| **Admin Web Dashboard** (`apps/admin-web`) | 9 | 16 (includes shell) | Pending |
| **Total** | **54** | **74 entries** | **No screen-level pass claimed** |

---

## 2. Automated Accessibility Enforcement Architecture

The configured CI workflow runs these checks on pull requests and pushes to `main`:

1. **Design Tokens Contrast Contract** (`scripts/accessibility/contrast-contract.mjs`):
   - Computes relative luminance and contrast ratios using the W3C WCAG formula:
     $$\text{Contrast} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
   - Enforces $\ge 4.5:1$ for all text/background pairs and status tags (`success`, `warning`, `error`, `neutral`).
   - Enforces $\ge 3.0:1$ for large text, icons, and UI boundaries.

2. **Mobile UI Component Contract** (`scripts/accessibility/mobile-ui-contract.mjs`):
   - Enforces 48 px minimum height (`control.height = 48`) and 44 px touch minimums (`control.touchMin = 44`) on `Button`, `TextField`, `SelectField`, `Checkbox`.
   - Verifies explicit accessibility attributes: `accessibilityRole`, `accessibilityState`, `aria-invalid`, `aria-checked`, `aria-expanded`, and `accessibilityLiveRegion="polite"`.
   - Prevents `SurfaceCard` from setting `accessible={true}` when non-interactive, preventing accidental screen-reader shielding of nested child elements.
   - Enforces 200% dynamic font scaling (`maxFontSizeMultiplier={2}`) and Tamil leading ratio $\ge 1.4$ in `AppText`.

3. **React Native Accessibility Linter** (`scripts/accessibility/mobile-a11y-lint.mjs`):
   - Static AST inspection of all `.tsx`/`.ts` files across `apps/member-mobile` and `apps/staff-mobile`.
   - Checks image labels and decorative hiding (`importantForAccessibility="no"` / `accessible={false}`).
   - Prohibits unauthorized font families outside the locked tokens (`Noto Sans Tamil`, `Inter`, `JetBrains Mono`).

4. **Admin Web JSX-A11y Rules** (`apps/admin-web/eslint.config.mjs`):
   - Enforces 16 core WCAG AA rules: `alt-text`, `anchor-has-content`, `anchor-is-valid`, `aria-props`, `aria-proptypes`, `aria-role`, `aria-unsupported-elements`, `heading-has-content`, `html-has-lang`, `interactive-supports-focus`, `label-has-associated-control`, `no-autofocus`, `no-redundant-roles`, `role-has-required-aria-props`, `role-supports-aria-props`, `tabindex-no-positive`.

5. **Admin source contracts** (`apps/admin-web/src/lib/sourceAccessibility.test.mjs`):
   - Eight source and token checks. These do not render the application or establish screen-level accessibility.

6. **Rendered public admin sweep** (`scripts/browser/admin-rendered-dom.mjs`):
   - CI starts the built admin app in headless Chrome and checks the public sign-in route and its error state for document language, landmarks, headings, accessible control names, broken descriptions, target size, and computed text contrast. Authenticated admin routes still require a safe test account and a separate rendered audit.

**Local verification, 9 November 2026:** The browser sweep passed against both the development server and a production build for `/sign-in` and `/sign-in?error=invalid_credentials`. It inspected 12 visible text nodes per route in the production build. The admin test suite passed 27 tests in total, including eight source contracts; these are separate from the browser sweep. CI execution itself and authenticated-route coverage remain to be confirmed on a pull request.

---

## 3. Screen-by-Screen Reconciliation & Audit Record

### Member Mobile App (50 Candidate Entries)

| ID | Screen Name | Route / Component File | Screen-level status | Source note | Device Testing | Assigned Role |
|---|---|---|---|---|---|---|
| A01 | Welcome & Language | `app/(auth)/welcome.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A02 | Sign In | `app/(auth)/sign-in.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A03 | Register Account | `app/(auth)/register.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A04 | Document Route Selection | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A05 | NIC Upload | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A06 | Passport Upload | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A07 | Before Selfie Intro | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A08 | Take Selfie Camera | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A09 | Review & Submit | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A10 | Team Review Pending | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A11 | Item Needs Updating | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A12 | Identity Approved | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A13 | Basic Profile Entry | `app/(auth)/register.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A14 | Area Selection | `app/(auth)/register.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A15 | Optional Survey | `app/(member)/setup/survey.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A16 | Recover Account | `app/(auth)/recover.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A16b| Assisted Recovery | `app/(auth)/assisted-recovery.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A17 | Upload Interrupted | `app/(member)/verify.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| A18 | Resume Setup | `app/(member)/setup/index.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| H01 | Home (Active Member) | `app/(member)/(tabs)/index.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| H02 | Home (Awaiting Review) | `app/(member)/(tabs)/index.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| H03 | Notifications List | `app/(member)/notifications.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| H04 | Community Hub | `app/(member)/hub.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E01 | Events List | `app/(member)/(tabs)/events.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E02 | Events Map / Location | `app/(member)/events/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E03 | Event Filters | `app/(member)/events/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E04 | Event Detail | `app/(member)/events/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E05 | Event RSVP | `app/(member)/events/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| E06 | Event Pass | `app/(member)/events/[id]/pass.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C01 | Member Card | `app/(member)/(tabs)/card.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C02 | Show Secure Code | `app/(member)/card/code.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C03 | Offline Card State | `app/(member)/(tabs)/card.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C04 | Wallet & Share | `app/(member)/card/share.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C05 | Membership Progress | `app/(member)/card/progress.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| C06 | Card Not Available | `app/(member)/(tabs)/card.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| G01 | Gallery Albums | `app/(member)/(tabs)/gallery.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| G02 | Album Detail | `app/(member)/gallery/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| G03 | Photo Viewer & Removal | `app/(member)/gallery/photo.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| P01 | Member Profile Hub | `app/(member)/(tabs)/profile.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| P02 | Edit Profile | `app/(member)/profile/edit.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| P03 | Verification Activity | `app/(member)/profile/activity.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| P04 | Account Settings | `app/(member)/profile/settings.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| P06 | Privacy & Account | `app/(member)/profile/privacy.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M06 | Household Overview | `app/(member)/household/index.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M07 | Add Household Member | `app/(member)/household/add.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M08 | Invite Adult Member | `app/(member)/household/invite.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M09 | Invitation Response | `app/(member)/household/invitations.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M10 | Household Consent | `app/(member)/household/privacy.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M49 | Security Devices | `app/(member)/profile/security.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |
| M50 | Security Alerts | `app/(member)/profile/security.tsx` | Pending screen test | Source note not independently verified | Pending | Mobile QA |

---

### Staff Mobile App (8 Screens)

| ID | Screen Name | Route / Component File | Screen-level status | Source note | Device Testing | Assigned Role |
|---|---|---|---|---|---|---|
| S01 | Staff Sign In & Role | `app/(auth)/sign-in.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S02 | Staff Tasks Dashboard | `app/(staff)/(tabs)/index.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S03 | Member Support Lookup | `app/(staff)/lookup.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S08 | Attendance Scanner | `app/(staff)/(tabs)/check-in.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S09 | Attendance Roster | `app/(staff)/roster/[id].tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S13 | Approvals & Escalations | `app/(staff)/(tabs)/approvals.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S14 | Operational Alerts | `app/(staff)/(tabs)/alerts.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |
| S-Card| Staff Card Check | `app/(staff)/card-check.tsx` | Pending screen test | Source note not independently verified | Pending | Staff Mobile QA |

---

### Admin Web Dashboard (16 Entries, Including Shell)

| ID | Screen Name | Route / Component File | Screen-level status | Source note | Device Testing | Assigned Role |
|---|---|---|---|---|---|---|
| D-Sign| Staff Sign In | `src/app/sign-in/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D01 | Admin Work Queues | `src/app/(staff)/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| W01 | Verification Queue | `src/app/(staff)/verification/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| W02/D03| Identity Decision Panel| `src/app/(staff)/verification/[id]/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| W09 | Role & Area Assignment | `src/app/(staff)/access/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D02 | Household Admin | `src/app/(staff)/members/households/` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D04 | Duplicate Investigation | `src/app/(staff)/duplicates/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D05 | Verification Appeals | `src/app/(staff)/appeals/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D06 | Membership Activation | `src/app/(staff)/membership/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D07 | Event Console | `src/app/(staff)/events/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D08 | Gallery Console | `src/app/(staff)/gallery/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D09 | Messaging Composer | `src/app/(staff)/messages/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D31 | Security Reviews | `src/app/(staff)/access-reviews/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D33 | Audit Log Viewer | `src/app/(staff)/audit/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| D34 | Geography & Settings | `src/app/(staff)/settings/page.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |
| Shell | Staff Navigation Shell | `src/components/StaffSidebar.tsx` | Pending screen test | Source note not independently verified | Pending | Admin QA / NVDA |

---

## 4. Physical Device & Native Accessibility Protocols (Pending Verification)

The source contracts and public sign-in browser sweep do not prove accessibility for the candidate screens above. The following human device and screen-reader tests remain necessary before release:

| Test Protocol | Device Environment | Target Criteria | Assigned Role |
|---|---|---|---|
| **Android TalkBack Navigation** | Samsung Galaxy S23 (Android 14) | Linear navigation swipe order; audible announcements for busy states; touch target accuracy on 48 px controls. | Mobile QA Lead |
| **iOS VoiceOver Navigation** | iPhone 15 Pro (iOS 18) | Rotor navigation by headings and form controls; zero trapped focus in modals; correct announcement of `aria-invalid`. | iOS QA Specialist |
| **Tamil Font Rendering & Leading** | Android & iOS real devices | No truncation of vowel signs (combining characters) at 100%, 150%, and 200% dynamic font scaling; line height $\ge 1.4$. | Tamil Localization Specialist |
| **Admin Web Screen Reader & Keyboard** | Windows 11 (NVDA 2024.1 + Firefox / Chrome) | Complete tab navigation without mouse; skip links to invalid form fields; dialog focus trapping. | Web Accessibility Engineer |
