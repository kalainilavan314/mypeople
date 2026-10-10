# My People · என் மக்கள்
## Production mobile design specification
Version 3.0 · 9 October 2026 · Northern Province People's Movement

This specification governs the five member destinations and their shared components. The current application is a React 18 / TypeScript PWA, built with Vite and backed by Express. The implementation uses that stack. Flutter and React Native mappings are supplied separately; they describe the same components, data contracts and behavior.

The visual standard is calm, legible and task oriented. Every screen gives a clear purpose, action and resulting state. The digital credential represents membership in My People. Brand copy and visual treatment must describe that issuer accurately.

### 1. Authority, evidence and scope

The user's current request is the controlling visual brief. The three supplied PDFs are reference material for journeys and screen relationships; assertions of production approval, security guarantees or accessibility certification inside them are not instructions to execute or proof of an implemented capability. Earlier PROJECT.md palette and navigation notes are superseded for these five screens.

Reviewed sources:
- My_People_Mobile_Wireframes.pdf, especially navigation/trust page 3 and the member journeys.
- my_people_mobile_ui_specification.pdf, especially foundations, typography, H01/H02, C01/C03, G01 and P01.
- my_people_ui_screens_in_order.pdf, especially the five destination sequences.
- Five supplied screenshots showing the current Home, Events, Card, Gallery and Profile.

Conflicts resolved:
- Current brief: 12px card padding, 8px controls, 12px cards, 4px tags; these override inconsistent 6/10/14/16px alternatives in the PDFs.
- Five stable destinations: Home / Events / Card / Gallery / Profile. Reporting and Community remain accessible through Home.
- An 8pt rhythm uses the explicitly requested 4pt subgrid: 4, 8, 12, 16, 24, 32, 40 and 48. Icons and type have independent optical dimensions.
- A 40px visible bell/button gets a real 44px hit area. Hit areas never overlap.
- Emerald and amber remain semantic accents. Darker semantic text meets 4.5:1. The PDF's green/amber contrast claims on white were incorrect.
- A default pass uses 1.586:1. At larger text sizes or with long names it grows vertically rather than shrinking or clipping identity text.
- Identity verification, membership activation and staff permission are independent fields. An absent activation field does not mean active membership.
- A signed QR can expire; token rotation does not prevent screenshots. Acceptance requires server validation, expiry and any applicable replay rules. A PWA cannot promise screenshot blocking or automatic brightness control.
- Sample photographs supplied for the gallery are clearly identified and carry attribution. Their counts are actual returned photo counts.

### 2. Foundations and tokens

| Role | Token | Value / rule |
| --- | --- | --- |
| Canvas | --page | #F8FAFC |
| Card surface | --card | #FFFFFF |
| Authority / CTA | --primary | #0F2942 |
| Hover / pressed | --maroon-hover / --maroon-pressed | #1B3A57 / #091D30 |
| Primary text | --ink | #0F172A |
| Secondary text | --ink-2 | #334155 |
| Metadata | --ink-3 | #475569 |
| Decorative chevron | --icon-muted | #94A3B8; never essential text |
| Card outline | --hairline | #E2E8F0, 1px |
| Inactive chip outline | --hairline-2 | #CBD5E1, 1px |
| Input boundary | control border | #64748B for an identifiable field boundary |
| Icon well / date badge | --surface-variant | #F1F5F9 |
| Verified accent | --success | #059669 |
| Verified text / tint | --success-text / --success-bg | #047857 / #ECFDF5 |
| Pending accent | --warning | #D97706 |
| Pending text / tint | --warning-text / --warning-bg | #92400E / #FFFBEB |
| Error | --error / --error-bg | #DC2626 / #FEF2F2 |
| Cards / controls / tags | radii | 12px / 8px / 4px |
| Chips / avatar / security pill | shape exceptions | capsule / circle / capsule |
| Card shadow | --shadow-card | 0 1px 2px rgba(15,23,42,0.04) |
| Gutters / card padding / label gap | spacing | 16px / 12px / 8px |
| Hit area / list row | minimum | 44×44px / 48px |
| Bottom navigation | height | 56px minimum + bottom safe inset |

No decorative gradients on cards, navigation, passes or hero surfaces. The gallery image counter may use a localized bottom scrim over a photograph. State is communicated with icon and words, not color alone. Hairline containment borders are decorative; actionable fields and focus indicators need sufficient non-text contrast.

The CSS retains legacy variable names as aliases so existing secondary screens continue to work. New components use semantic names. The navy pass remains navy in dark mode. Dark surfaces and lifted action colors are an optional alternate appearance; light is the acceptance baseline in the user's brief.

#### Measured contrast
Calculated with the WCAG relative luminance formula, not estimates.

| Pair | Foreground | Background | Ratio |
| --- | --- | --- | --- |
| Navy on white | #0F2942 | #FFFFFF | 14.83:1 |
| Primary text on canvas | #0F172A | #F8FAFC | 17.06:1 |
| Muted on white | #475569 | #FFFFFF | 7.58:1 |
| Emerald on white | #059669 | #FFFFFF | 3.77:1 |
| Amber on white | #D97706 | #FFFFFF | 3.19:1 |
| Verified text on tint | #047857 | #ECFDF5 | 5.21:1 |
| Pending text on tint | #92400E | #FFFBEB | 6.84:1 |
| Pass metadata on navy | #CBD5E1 | #0F2942 | 9.99:1 |
| Pass verified pill | #A7F3D0 | #064E3B | 7.58:1 |
| Silver tier | #0F2942 | #E2E8F0 | 12.03:1 |

#059669 and #D97706 are not used as small text on white, nor behind small white text. Verified status on the navy pass uses #A7F3D0 on #064E3B. Metadata uses #CBD5E1 on navy. Each text/background pairing must be rechecked when tokens or media scrims change.

#### Typography
Inter for Latin UI, Noto Sans Tamil for Tamil, JetBrains Mono only for identifiers. Self-host the fonts. Native implementations can substitute platform UI fonts for Latin while keeping Noto Sans Tamil and the same metrics. Do not convert pt to px by an assumed multiplier; all specified sizes are logical UI units.

| Style | Size / Latin line height | Weight | Application |
| --- | --- | --- | --- |
| Page / greeting | 22 / 30 | 700 | Screen identity |
| Section | 16 / 24 | 700 | Functional groups |
| Hero title | 14 / 21 | 700 | Next step |
| Card / event / action label | 13 / 20 | 600–700 | Core scanning |
| Body | 15 / 23 | 400 | Explanations and forms |
| Native pass legal name | 16 / 24 | 700 | Name without truncation |
| Metadata | 11 / 17 | 400–600 | Date, geography, photo captions |
| Quick action caption | 10 / 16 | 400 | Supporting label |
| Calendar month | 9 / 12 | 700 | Month paired with date |
| Tab label | 10 / 15 | 600 | Persistent navigation |

Small metadata follows the explicit compact brief, has high contrast, and supports enlargement. No primary task depends on a 9–11px label alone. Web inputs remain at least 16px to avoid unwanted mobile browser zoom. Tamil uses normal tracking and 1.55–1.65 line height; use script-aware labels and explicit language tags on bilingual parts. Do not reduce font size to make Tamil fit.

### 3. Shared layout and components

Baseline 375×812 CSS pixels; verify at 320, 375, 390 and 430 logical widths. A 375px screen has 343px content width. Two equal columns with a 12px gap produce 165.5px cells. Pages use one vertical scroll container; chips have an independent horizontal scroll only. Bottom navigation participates in the app shell layout so it never covers content.

Respect safe top and bottom insets. Top content starts 16px below the safe status area. At 200% text, fixed-height content becomes a minimum, grids can collapse to one column, title/action groups can wrap, and passes expand.

Shared component contracts:
- ScreenTitle(title, subtitle?, action?): one h1, optional descriptive subtitle, trailing 44px control.
- SurfaceCard(children, accent?): white, 1px border, 12px radius, micro shadow, 12px padding.
- IconButton(icon, label, onPress, pressed?): 44px target, 40px visible surface, 20px icon, 2px stroke.
- DateBadge(ISO timestamp): 44×50px well, month 9px bold, day 16px bold; full date accessible name.
- StatusTag(label, tone): 4px radius, icon + text; verified/pending/neutral palettes.
- QuickAction(destination, icon, label, caption): whole card is one link/pressable.
- PrimaryAction(label, busy, onPress): 8px radius, navy, white; 44px touch target, optional 40px visible fill.
- AlbumCard(album): whole card button, photograph and caption regions; no nested buttons.
- MenuRow(icon, label, hint?, destination): 48px minimum, 20px left icon and right chevron.
- QueryBoundary: skeleton, content, empty, error + retry. Cached content must explain freshness when materially relevant.

Button states: default navy; hover #1B3A57; pressed #091D30; busy retains label and adds Saving/Preparing; focus uses 3px contrast ring with offset. Avoid changing control width while loading. Disabled states explain the cause nearby. Use real buttons for actions and links for navigation.

### 4. Home dashboard · H01 / H02

1. Greeting header: “Good afternoon, Kalai”, 22px bold, and location “Jaffna / Analaitivu North”, 13px, separated by 8px. Use one outlined pin from the shared icon family. Bell aligns at the trailing edge with 40px visible container inside 44px target. Show an unread dot only from a real unread count.
2. Next step: 24px below header. White SurfaceCard with 4px navy left rule, 12px content padding, 10px eyebrow, 14px bold task title. Venue row follows with an 8px gap. One primary action, 40px visible height inside 44px area.
3. Quick actions: 2×2, 12px gaps, 24px section separation. Tiles use 36×36px #F1F5F9 icon wells, 20px navy icons, 13px semibold labels and 10px muted captions. Report issue / Volunteer / My area / Community. Whole tiles remain large touch targets.
4. Coming up nearby: 16px section heading and “See all” 44px link. White event preview with DateBadge, 13px title, time and venue metadata, and Going ✓ only from confirmed member RSVP.
5. Empty event result: offer the Community hub and an explicit Browse all events link; do not imply the profile is incomplete without profile-completeness data.
6. Pending verification: amber notice with darker pending text; review explanation and View verification action. Server permission checks remain authoritative for restricted participation.

Next-step selection currently prefers an upcoming event marked as the member's area, then the earliest upcoming event. Production prioritization can add actual missing-document and report-action records; it must not manufacture tasks.

### 5. Digital member card · C01–C06

Replace the reduced PVC artwork with native UI text and a native digital pass. Use 1.586:1 at normal type. At 343px width, nominal height is approximately 216px.

Pass anatomy:
- Solid #0F2942, 12px radius, 12px padding, micro shadow.
- Bilingual “MY PEOPLE • என் மக்கள்”, 11px bold. TIER 0 in a flat silver badge (#E2E8F0 with navy text), 4px radius. Display the server-assigned tier level; do not derive staff access from badge styling.
- 48×48px circular portrait; request an image suitable for at least 144×144px pixels at 3×. A missing portrait gets a neutral person silhouette, never an invented likeness.
- Legal name 16px white bold, followed by the actual member ID (example WTL-26-5401749) and district / DS / GN hierarchy in 11px slate #CBD5E1. Wrap the full legal name; no ellipsis that hides identity.
- Bottom status pill: ✓ Identity Verified • Active Member only when both fields explicitly support it. Otherwise show the supported identity state; absent membership state is an integration gap, not an active assertion.
- Bottom-right 44px white QR entry affordance. It opens the enlarged secure code. Do not shrink a complex signed token into an unreliable tiny QR.

Action row:
View QR / Download PDF / Add to Wallet / Share each has a 44px control with a 20px shared-weight icon and label below. Default is four equal columns; use two columns below 360px or when text requires it. The title and accessible label are identical. Buttons have 8px radius.

QR: black modules on white with an adequate quiet zone and large display. Use only the backend-issued opaque token. Display a retry/unavailable state if the token cannot be issued. A refresh interval must come from server expiry, not invented timing. The existing endpoint currently issues a short-lived token; changing its lifetime or scanner behavior is a backend integration task.

PDF: download a CR80 85.6×53.98mm copy. Never stretch an expanded accessible pass into the ratio; capture a separate standard-size export layout when UI text has enlarged. No active QR token in a static public export. Sharing uses a preview disclosing name, member ID and identity status; the native share sheet or explicitly confirmed clipboard fallback follows.

Wallet: the current backend has no Apple/Google Wallet provisioning service. The UI explains availability rather than claiming an added pass. Production integrations require signed provider assets and success/cancel/error responses. Offline cached presentation is labeled with freshness; it is not a guarantee of accepted check-in.

### 6. Events · E01–E06

- Screen title 22px with concise 13px context; search is a 44px control. The search input is labeled and matches title/venue.
- List / Map are two 44px segmented buttons with 8px radii. Keep the list available without map load or GPS permission.
- Filters: All / My area / This week / This month, horizontally scrollable. 44px targets; active solid navy and white; inactive white, 1px #CBD5E1 outline, #334155 text. Capsule shape is an explicit chip exception.
- Cards: white, 12px padding/radius, 1px border and micro shadow. 44×50px date badge on the left; 12px gap to content. 13px bold title can wrap. Venue is single-line with ellipsis but full value is available in event detail. Time displays 08:00 – 11:00 in Asia/Colombo.
- Bookmark has its own 44px target and pressed state. RSVP sits on the right, 44px minimum, 8px radius. Labels RSVP / Saving… / Going ✓ are explicit.
- Changes display success only after mutation confirmation. On failure retain the last confirmed state and provide a visible retry message. Event count and member response come from the same API response. No nested controls inside a clickable whole-card button.
- No dark split blocks, oversized calendar art or promotional gradients.

Events detail, comprehensive filters, three-state RSVP sheets and scoped event check-in retain their reference journey relationships. The list/map visual refactor does not claim those entire broader flows were rebuilt in this pass.

### 7. Gallery · G01–G03

Grid: two columns with 12px gap; each white card has a 4:3 photo region and a separate clean caption. Radius 12px on the exterior. Real image data uses object-fit:cover. Count sits over a localized bottom scrim; counter text is white over sufficiently dark pixels. Caption uses 13px title and 11px publication metadata in dark text. Loading reserves the 4:3 region to prevent layout shifts.

Album detail/photo viewer: show title, publisher, location, sample designation where relevant, actual photo count, bilingual alt/caption and source attribution. Previous / next / close controls are 44px. Dialog supports Escape, focus containment and focus return. Image failure gets a light neutral “Photo unavailable” region, not dark artwork pretending to be a photo.

New read-only public API:
- GET /api/gallery/albums
- GET /api/gallery/albums?category=all|events|community
- GET /api/gallery/albums/:id
- Invalid category: 400; unknown album: 404; unreadable manifest: 503.
- Read from server/src/gallery-albums.json. Filter draft albums, omit empty albums, derive count from photos.length and return only gallery fields.
- Static WebP files live at app/public/gallery/. Local loading avoids an external-host dependency. PWA precaches WebP assets.
- Five replaceable sample collections contain licensed photographs of Jaffna and northern landscapes. They are not evidence of organization events. API and UI keep sample:true until replaced.
- Attribution JSON preserves author, source, license and processing notes. Keep license links when distributing derived assets.

Replacement workflow: add approved image files, edit bilingual album/photo metadata and real publication date in the server manifest, mark publicationState:published, and set sample:false. Rebuild/deploy the app when adding bundled image files. Never post private incident evidence into this public gallery.

Removal requests need a real retained request/receipt service before the app promises receipt or an SLA. The current viewer opens My area for the coordinator contact route; it does not invent a recorded request. A publishing/upload administrative API is outside this read-only implementation.

### 8. Profile and settings · P01–P06

Compact SurfaceCard: 48px avatar, 12px spacing, 16px bold legal/display name, 11–13px member ID + assigned tier, then separate identity and membership status tags. No decorative cover. Full area hierarchy is accessible from My area.

Five primary menu rows: My Area / My Activity / Edit Profile / Verification / Community Hub. Each has minimum 48px height, 20px navy monochrome icon, 13px medium label and 20px decorative #94A3B8 chevron. One #E2E8F0 separator between rows; no extra first/last divider. Optional longer hints belong in the destination or accessible description rather than increasing standard row size.

Account settings uses the same rows for Language / Notifications / Privacy and consent / Appearance / Help. The appearance switch has a 44px hit area. Sign out is a clearly labeled action. Keep destructive account deletion behind the account flow's deliberate confirmation.

The current My Activity destination exposes Reports and receipts, not a complete cross-feature ledger. Broader activity aggregation, reviewer history, formal legal-name changes and relocation approval need separate data services. The specification must not mislabel these existing destinations as completed services.

### 9. State, accessibility and performance acceptance

- All normal text: at least 4.5:1. Keep 44×44 targets as this system's stronger touch standard. In WCAG 2.1, 2.5.5 Target Size is AAA, not AA.
- Essential icons, boundaries and state indicators: at least 3:1 where WCAG non-text contrast applies. Decorative hairlines/chevrons are not the only means of recognizing a control.
- Text enlargement at 200%: no horizontal page scrolling, clipped labels, obscured actions or overlapping legal-name/status content. Permit vertical scroll and flexible card height.
- Screen reader headings: one h1 per page, sequential h2 sections. Every icon-only button has a localized name. Filters announce pressed state; status changes use restrained polite live regions; errors use alert.
- Keyboard: visible focus, no traps outside dialogs, Escape dismisses modal content and focus returns to the opener.
- Use native HTML form and button semantics, or equivalent native accessibility roles, labels and state.
- Respect reduced motion; no mandatory shimmer/scale motion. Transition budgets 120–160ms, no animation essential to understanding.
- Skeletons preserve geometry, never invent a verified card. Error state has Retry. Empty state explains context. Connection failures explain whether an action was saved or remains unsent.
- Images: local WebP, lazy loading, 4:3 reserved cover; full view is constrained by viewport. Avoid heavyweight native-library changes for a visual refactor.
- Locale: times in Asia/Colombo for local events; translate UI labels and gallery metadata; English and Tamil get equal hierarchy.
- Shared tokens propagate to existing secondary screens, but visual/contrast regression review of every legacy/auth screen remains required before claiming app-wide WCAG conformance.

### 10. Delivery status and release requirements

Implemented locally: tokens; shared Civic primitives; Home; compact Events and server-confirmed RSVP state; native-style Card pass and honest wallet/share behavior; API-backed photo Gallery; compact Profile; five stable bottom tabs; public gallery read API and licensed local sample assets.

Production dependencies still needing backend/product work: independent membership activation in /api/me; authenticated identity-gated credential issuance policy; provider-signed Wallet services; full activity ledger; photo-removal receipt/SLA service; complete coordinator/publishing workflows. Preserve those distinctions during release review.

The provided server handover is access context. No production SSH session or deployment was performed for this design change. Existing worktree edits were retained and extended.

Validation results and screenshots are in design/qa. Browser tests use synthetic member/event fixtures; gallery HTTP tests use the new real local router and local assets. Production member records and database were not contacted by those tests. A passed typecheck/build and these tests are release evidence, not accessibility certification.

### 11. Benchmark sources

The following are supporting design references, not claims of equivalent identity authority or technical capability:
- [GOV.UK button guidance](https://design-system.service.gov.uk/components/button/): clear action labels and purposeful button hierarchy.
- [GOV.UK colour guidance](https://design-system.service.gov.uk/styles/colour/): functional color and contrast.
- [LifeSG](https://www.life.gov.sg/): personalized services, inbox and appointments as task organization.
- [myGov app](https://my.gov.au/en/about/help/mygov-app): a digital wallet for supported cards.
- [myGov QR guidance](https://my.gov.au/en/about/help/mygov-app/using-qr-codes-in-the-mygov-app): card QR interactions.
- [Singpass brochure](https://www.tech.gov.sg/files/products-and-services/Singpass___English_Brochure___Feb_2022.pdf): native digital identity presentation as visual reference.
- [WCAG 2.1 contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) and [target size](https://www.w3.org/WAI/WCAG21/Understanding/target-size): actual criteria and levels.
