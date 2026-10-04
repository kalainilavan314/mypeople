# Approval Checklist — Decisions Needed Before Implementation

Each item is a concrete decision only a human stakeholder should make. Nothing in `SCREEN_MIGRATION_PLAN.md` phase B onward should begin until these are answered.

1. **Back icon**: Standardize on `chevronLeft` (`Icon.tsx:107`) everywhere in the app shell, retiring the rotated-`chevron` pattern used in `Reports.tsx:68`, `PartyFund.tsx:90`, `EditProfile.tsx:131`? — Yes / No

2. **Back button size**: Fix the app-shell back button at 44×44px (matching `ScreenHeader.tsx:31`), retiring the 38px (`EditProfile.tsx:129`) and 40px (`Reports.tsx:66`, `PartyFund.tsx:88`) variants? — Yes / No

3. **Bottom nav on nested/detail screens**: Keep the bottom nav visible on every authenticated route including detail screens like `/events/:id` and `/announcement/:id` (current behavior, `App.tsx:142-152`), or hide it on nested/detail screens? — Pick one: "Keep always visible" / "Hide on nested screens"

4. **Root header variant for Events and Community**: Should `/events` and `/community` adopt the `root-hero` style (image/gradient hero like Profile) or the plainer `root-title` style (eyebrow + title, like the current `WorkspaceTitle`/`cm-head-redesign` approach)? — Pick one: "root-hero" / "root-title"

5. **Settings/language entry point**: Consolidate Home's language chip (`HomeTopBar.tsx:32-36`) and Profile's settings gear (`Profile.tsx:87-94`) — both currently navigate to `/language` — into one consistent icon used in both places? — Yes / No, and if Yes, which icon (globe chip / gear / both kept intentionally as "quick" vs "full" settings entry points)?

6. **Auth back button (`BackChip`)**: Leave `BackChip` (`parts.tsx:375-386`) as an intentionally distinct, pill-shaped, always-light-themed back control separate from the app-shell `BackButton`, given auth's documented always-light theme requirement? — Yes (leave distinct) / No (unify styling with app-shell `BackButton`)

7. **`ScreenHeader`'s unused `right` slot**: Should the first real adoption of the `right` slot be a specific action (e.g. share icon on Announcement, edit icon on a profile-adjacent screen), to be named now rather than left to be decided ad hoc during migration? — Name the screen + action, or defer

8. **Material-3 secondary palette** (`c.primary*`, `secondary*`, `tertiary*`, `surfaceVariant` in `tokens.ts`) used by Reports/PartyFund's gradient headers: merge into the primary maroon/ink palette for visual consistency, or keep as an intentional distinct "hero screen" accent family? — Pick one: "merge" / "keep distinct"

9. **FAB elevation/style**: Confirm the current center-FAB treatment (`.work-nav-fab`, `global.css:410-421` — maroon circle, white plus icon, elevated above the bar) is final, or should it change as part of this consistency pass? — "Keep as-is" / "Revise" (if revise, specify what)

10. **Header height**: Should root (`root-brand`/`root-title`) and nested headers share one fixed height token, or is it acceptable for hero variants (image/gradient backgrounds) to be taller than plain nested headers, as they are today? — "One shared height" / "Hero variants may be taller"

11. **Color token naming**: If item 8 results in a merge, should the surviving token names be the existing `maroon*`/`ink*` family, or the newer Material-3-style names (`primary*`/`secondary*`)? — Pick one, or defer to implementation team

12. **Deep-link back-navigation fallback**: When a user lands directly on a nested screen via a deep link (no prior in-app history), should the back button fall back to a defined parent route (requires building a parent-route map) rather than today's unconditional `navigate(-1)` (`ScreenHeader.tsx:15`), which may do nothing or exit the app? — Yes (build fallback map) / No (accept current behavior)

## Added after the evidence-closing pass (Task 1 findings) — all new, none superseding the items above

13. **Header variant count**: Confirm the final header system has exactly three variants (`root`, `nested`, `hero`) as specified in `DESIGN_LANGUAGE_SPEC.md` §1, replacing the five-value draft (`root-brand`/`root-title`/`root-hero`/`nested`/`nested-hero`) that appeared in an earlier pass of `SHARED_COMPONENT_ARCHITECTURE.md`? — Yes (lock at 3) / No (keep more granular sub-variants as caller-facing props)

14. **Nic.tsx / Join.tsx broken back-target**: Confirmed bug — `Nic.tsx:28` and `Join.tsx:22` both target `/welcome/otp`, a route that does not exist in `App.tsx`, so both silently redirect to Home via the catch-all route instead of reaching the OTP screen. Fix by pointing both at the registered `/onboarding/otp` route (preserving the legacy two-step flow), or at `/welcome` (matching `Otp.tsx:31`'s already-correct pattern)? — Pick one: "`/onboarding/otp`" / "`/welcome`" / other (specify)

15. **Profile.tsx back button removal**: Confirmed risk — `Profile.tsx:82`'s `navigate(-1)` has no guard for Profile being reached as a root/entry screen (deep link, PWA relaunch with no prior history). Per the finalized 3-variant header spec, Profile becomes `variant="hero" showBack={false}` and loses its back button entirely, consistent with it being a bottom-nav root tab (same rule as Home/Events/Community, which have never had back buttons). Approve removing Profile's back button as part of this migration? — Yes / No (if No, specify the alternative safeguard — e.g. a fallback target instead of removal)

16. **Gallery / MyArea / Card back button addition**: Confirmed — `/gallery`, `/area`, `/card` currently have NO back button or header-level navigation control at all (not previously documented with this precision). The migration plan adds a back button to all three for the first time. Approve adding back buttons to these three screens as part of this consistency pass, rather than treating "no back button" as acceptable/intentional for them? — Yes (add back buttons) / No (leave as-is, document as intentional)

17. **ReportNew.tsx / ReportDetail.tsx fate**: Confirmed orphaned — no route in `App.tsx`, no import anywhere outside their own files. They correctly use `ScreenHeader` and would need no header rework if ever wired up. Decide: (a) wire them into the router as real `/reports/new` and `/reports/:id` routes, replacing `Reports.tsx`'s inline form/list with navigation to them, (b) delete them as unused dead code, or (c) leave them in place, untouched, undecided, for a future product call outside this consistency pass's scope? — Pick one: "wire up" / "delete" / "leave undecided (out of scope)"

18. **BackChip consolidation approach**: `BackChip` (`parts.tsx:375-386`) already matches `BackButton`'s target geometry (44×44, `chevronLeft`) — the only difference is its pill border/shadow and `authC` color tokens. Approve the "wrap, keep own colors" approach in `SHARED_COMPONENT_ARCHITECTURE.md` §2 (BackChip becomes a thin styled wrapper over the shared back-button logic, no call-site changes) rather than either (a) leaving it as a fully separate, parallel fourth implementation or (b) fully unifying its visuals with the app-shell back button including dropping the pill shape? — Yes (wrap, keep auth's distinct pill look) / No (specify alternative)
