# 03 — User Personas & Journeys

*பயனர் யார் என்பதை குறியீட்டில் இருந்து கண்டறிதல் — personas derived from actual access rules, not imagination.*

## Personas

### P1 — The Member (primary, VERIFIED from auth model)
Registers with NIC + password (`server/src/index.js:260-421`), no SMS gate required at login. Likely profile: a party/movement supporter in the Northern Province, on a budget Android phone (PROJECT.md), who wants to: view their digital card, RSVP to events, report local civic issues, see movement news, optionally donate. Tamil is their default reading language; `si.json` being a stub means Sinhala-reading members get a materially worse experience (INFERRED impact, not measured).

### P2 — The Prospective Member / Unverified Signup (VERIFIED)
Anyone who completes `/signup` with *any* NIC number — the server performs no OTP or identity check at signup (explicit comment, `server/src/index.js:23-28`). This persona is important because of a **trust/abuse risk**: nothing stops someone from registering under a NIC they don't own. `verification_status` starts at `unverified` or `nic_format` (format-only check) and only a coordinator can escalate it to `identity_confirmed` (`0009_verification.sql:9-13`) — but there is no UI route found for that review step (see 02). So today this persona can get a membership card and use the app fully while sitting at `nic_format` verification indefinitely.

### P3 — The Admin / Coordinator (VERIFIED existence; **scope now partly resolved**)
Flat `is_admin` flag (`0006_party_fund.sql:9`), used by `requireAdmin()` in two places: verification review and donation review. No ward/district scoping found on the flag itself — an admin can review verification and donation requests for *any* member, not just their own ward. PROJECT.md's separate "ward-coordinator side" is explicitly listed as **not built**. **Updated after full screen reads**: donation review *does* have in-app tooling — `PartyFund.tsx`'s `ReviewTab`, gated on `me.isAdmin` — found and verified this pass. Identity-verification review still has **no frontend screen anywhere in this repo**, confirmed by reading all 28 screen files, not just the ones found before. The admin persona today can review donations in-app but must use some other means (separate tool, DB console, or manual process) for verification review.

### P4 — The Anonymous Visitor (VERIFIED)
`GET /api/events` and `GET /api/events/:id` work without a session (`reqContext()` degrades to `memberId: null`, `server/src/index.js:492-502`). This supports a "browse before you join" moment, though there is no public landing page found in `app/src` distinct from the gated app shell — `RequireAuth` (`App.tsx:176-180`) redirects every non-event, non-auth route to `/welcome` or `/login`. So in practice the only pre-auth content a visitor can reach through the UI is Welcome/Login/Signup; the open events API is unused by any pre-auth screen. **Confirm with user**: is this an intentional unused-capability, or a planned (not-yet-wired) public events page?

### P5 — The Returning-but-Locked-Out Member (INFERRED, partially unsupported)
A member who forgets their password reaches `/forgot` (`App.tsx:48,196`), but no corresponding server route exists (`grep` for `forgot`/`reset-password` in `server/src/index.js` returns nothing). This is a **functional dead end** — see Defect D-02 in 05/09.

## Journeys

### J1 — First-time signup → active member
Entry: app install / first open → `/welcome` (if `hasSeenWelcome()` is false, `App.tsx:178`) → `/signup` → `/signup/profile` → `/signup/questions` → account created, session cookie set (`server/src/index.js:387-421` pattern mirrored at signup) → lands on Home (`/`).
States: loading (signup POST in flight — **not inspected** whether SignUp.tsx shows a spinner/disables double-submit), error (`ApiError` thrown with `data.error` code, e.g. `phone_exists`, `bad_gs` — **UNVERIFIED** whether each code has a human/Tamil message in the signup screen, flag for 05), success (redirect to Home).
Friction points (INFERRED from data contract, not yet from rendered UI):
- Signup asks for `dob`, `gender`, `districtCode/dsCode/gsCode`, custom `answers` across three screens — a three-step form on a low-end Android phone is a drop-off risk if any step lacks progress indication or back-navigation. **NOT INSPECTED** per-screen; flag for validation.
- No OTP/identity gate at signup, yet the UI likely implies some verification occurred (Home shows a verification badge, `Home.tsx:31-38,93-96`) — risk of member confusion about what "Not verified" / "NIC format checked" actually means to them politically (a flagged member might feel distrusted without explanation). Needs copy/UX review, not just engineering.

### J2 — Returning member login
Entry: `/login` → NIC + password → throttled by NIC-hash+IP (`server/src/index.js:391-409`) → Home.
Friction: progressive delay on repeated failed attempts (`sleep(gate.delayMs)`, line 409) is good anti-abuse but **UI must communicate why login is slow/locked** — not inspected whether `Login.tsx` surfaces `retry-after` to the user or just hangs. Flag for 05/08.

### J3 — Check in at an event — **UPDATED: confirmed defect, not an open question**
Entry: Events list (`Events.tsx`, real server data) → tap a card → `EventDetail.tsx` → RSVP → (at the venue) check-in.
**Confirmed this pass**: `EventDetail.tsx` was fully read and is entirely mock-backed — `useEvent`/`useCheckIn` call `api.getEvent`/`api.checkIn` against `data/mock/client.ts`, never the real `/api/events/:id` the list screen uses. A full-file grep of `server/src/index.js` for check-in/points found nothing beyond `card-token` issuance (`index.js:449-452`), confirming no server-side check-in redemption endpoint exists at all. **This is now DEFECT-03 (Critical) in 05**, not an unresolved question: a member who checks in at a real event sees a convincing success state and a "points earned" pill that never reaches the server, on a live, routed, frequently-used screen.

### J4 — Report a civic issue
Entry: Home Quick Access "Report Issue" (`Home.tsx:22`) → Reports (`/reports`) → compose → submit → `POST /api/reports` (server-backed, real Postgres row, `index.js:570-593`) → appears in "my reports" (`/api/reports/mine`).
Strength: this journey is **fully server-backed**, not mock — a real production path end to end, including input validation (category/priority enums, trimmed non-empty title/description, FK-checked district).
Gap, **revised after full reads**: `ReportDetail.tsx` has no route (confirmed again), but `Reports.tsx` itself (now fully read) already shows an inline 4-stage status progress bar per report in the "My Reports" list — so the status-visibility promise is substantially met without a detail screen. `ReportDetail.tsx`/`ReportNew.tsx` are confirmed orphaned *and* built against an abandoned mock `Report` contract different from the live `CommunityReport` model — recommend deletion, not reconnection (see 05 DEFECT-02, revised). The clearer broken journey in this product, after the full pass, is **J3 (event check-in)** above, not this one.

### J5 — Donate to the Party Fund — **RESOLVED after full 798-line read**
Entry: Community hub → `/fund` → choose card (sandbox, hidden unless server-enabled) or bank-slip upload → for slip, admin approval required before it's public.
**Confirmed this pass**: `cardPaymentsEnabled` not only gates the card button's presence, the card form itself shows an explicit sandbox-disclosure note and the OTP step displays the literal dev code in a labelled box — a donor cannot mistake this for a silent real charge. The admin review screen (`ReviewTab`, gated on `isAdmin`) is real and functional: it fetches the pending queue, shows the uploaded slip image, and lets an admin approve/reject. **This closes what was the single highest-stakes open question in the prior pass.** One narrower item remains: whether the server independently re-checks admin role on the review endpoints rather than trusting the client's hidden tab (05 UX-21).

### J6 — Language switch
Entry: Profile → Language (`/language`) → pick ta/en/si → `PATCH /api/me {language}` + local i18n change.
Note: `App.tsx:106-114` only syncs UI language from the server's stored preference when the user has **not** made a local explicit choice (`savedLang()` check) — a deliberate, good design decision to avoid snapping the language back after a manual toggle. Documented here as a **strength**.
