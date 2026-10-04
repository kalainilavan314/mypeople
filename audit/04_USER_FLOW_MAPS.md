# 04 — User Flow Maps

*பாதைகள் — the paths, drawn from the router and server routes actually found.*

## J1 — Signup to active member

```mermaid
flowchart TD
    A[App opens] --> B{hasSeenWelcome?}
    B -- no --> C["/welcome"]
    B -- yes --> D["/login"]
    C --> E["/signup"]
    D -- "Create account" link --> E
    E -- "NIC, name, phone, password" --> F["/signup/profile"]
    F -- "dob, gender, district/ds/gs" --> G["/signup/questions"]
    G -- "custom answers" --> H[POST /api/auth/signup]
    H -- 400 validation error --> G
    H -- success: cookie set --> I["/ (Home)"]
    style H fill:#F6E4E0,stroke:#7B1E2B
```
Evidence: `App.tsx:186-197`, `server/src/index.js:260-384` (signup handler span).

## J2 — Login

```mermaid
flowchart TD
    A["/login"] -- "NIC + password" --> B[POST /api/auth/login]
    B -- "throttle gate fails" --> C[429 too_many_attempts + retry-after]
    B -- "bad credentials" --> D[401 invalid_credentials]
    B -- ok --> E[set HttpOnly cookie + session_version check]
    E --> F["/ (Home)"]
    C --> A
    D --> A
```
Evidence: `server/src/index.js:387-421`.
**Open question**: does the Login screen surface the `retry-after` seconds to the user, or does the button just appear to hang? Not inspected — needs direct screen read before claiming good/bad UX.

## J3 — Event RSVP & check-in — **UPDATED: the gap is now a confirmed functional defect, not an open question**

```mermaid
flowchart TD
    A["/events (list)"] -- "real GET /api/events" --> A
    A -- "tap a card" --> B["/events/:id → EventDetail.tsx"]
    A -- "RSVP toggle in list" --> R1[useSetRsvp → real POST /api/events/:id/rsvp]
    B -- "loads via useEvent(id)" --> M1["api.getEvent(id) — MOCK client, NOT the server"]
    B -- "RSVP toggle in detail" --> M2["currentRsvp()/rsvp.mutate — separate MOCK store"]
    B -- "Check In button" --> M3["useCheckIn → api.checkIn(id) — MOCK client, writes checkInCount to mock state only"]
    M3 --> C["UI shows 'points earned' pill — never reaches server"]
    style M1 fill:#F6E0E0,stroke:#B03A3A,stroke-width:2px
    style M2 fill:#F6E0E0,stroke:#B03A3A,stroke-width:2px
    style M3 fill:#F6E0E0,stroke:#B03A3A,stroke-width:2px
    style C fill:#F6E0E0,stroke:#B03A3A,stroke-width:2px
```
**Follow-up pass finding (DEFECT-03, Critical)**: full reads of both `Events.tsx` and `EventDetail.tsx` confirm the list is genuinely server-backed (`index.js:504-539`) but the detail screen it routes to is entirely mock-backed (`data/mock/client.ts:147-151`) — a full-file grep of `server/src/index.js` for any check-in/points-award route confirms **no such server endpoint exists anywhere**, closing the prior pass's open question: this is a frontend defect (two disconnected data stores for the same event), not a missing/unfound backend route. See 05 DEFECT-03 for the full write-up.

## J4 — Community issue report — **UPDATED: status tracking confirmed working, via a different path than first assumed**

```mermaid
flowchart TD
    A[Community hub tile / Home tile] --> B["/reports → Reports.tsx (VERIFIED, 401 ln)"]
    B -- "compose: category, title, description, district, priority" --> C[POST /api/reports]
    C -- "400 on bad category/priority/district" --> B
    C -- "ok" --> D["My Reports tab — GET /api/reports/mine"]
    D --> E["Each report card shows an inline 4-stage status bar: submitted → under_review → in_progress → resolved"]
    D -. "a SEPARATE legacy pair, unrouted" .-> F{{"ReportNew.tsx + ReportDetail.tsx — orphaned, target an abandoned mock Report type, recommend deletion"}}
    style E fill:#E6F3EA,stroke:#1F8A4C
    style F fill:#F0EDE8,stroke:#8A8577,stroke-dasharray: 5 5
```
**Follow-up pass finding (revises DEFECT-02)**: the real, live `Reports.tsx` already renders an inline per-report status progress bar (lines 372-398) — so the "track my report's status" promise is substantially met today, just not via a dedicated detail screen. `ReportDetail.tsx`/`ReportNew.tsx` are confirmed orphaned *and* built against a different, abandoned mock data contract (`Report`/`ReportCategory`, not `CommunityReport`) — recommended for deletion rather than reconnection. See 05 DEFECT-02 (revised) and 02's corrected inventory.

## J5 — Party Fund donation — **UPDATED: full 798-line screen read confirms disclosure + working admin review**

```mermaid
flowchart TD
    A["/fund"] --> Z{"cardEnabled? (fetched from authApi.config() server flag)"}
    Z -- "false (default)" --> B2["Card method hidden entirely from the UI"]
    Z -- "true" --> B{Method}
    B -- card --> C["Card form shows fund.sandboxNote disclosure text"]
    C --> C1[POST /api/donations/card/start]
    C1 --> C2["OTP sheet shows the literal dev OTP code (fund.otpSandbox)"]
    C2 --> D[POST /api/donations/card/confirm]
    D --> E["status=approved immediately — CARD_SANDBOX, disclosed to the donor on-screen"]
    B -- slip --> F["BankDetails: real account/bank/branch/SWIFT, tap-to-copy"]
    F --> F2[upload photo, camera or gallery]
    F2 --> G[POST /api/donations/slip]
    G --> H["status=pending — success sheet says 'sent for review', not 'approved'"]
    H --> I["ReviewTab — isAdmin-gated, VERIFIED working: fetches pending queue + slip image, Approve/Reject buttons"]
    I -- approve --> J[status=approved, visible on public donor list]
    I -- reject --> K[status=rejected]
    style E fill:#E6F3EA,stroke:#1F8A4C
    style I fill:#E6F3EA,stroke:#1F8A4C
```
Evidence: `server/src/index.js:798-895`, `server/migrations/0006_party_fund.sql`, sandbox comment at `index.js:167-177`, and now `screens/PartyFund.tsx:1-798` (full read, this pass) for every UI node above. **This closes two of the prior pass's open questions**: the sandbox is disclosed, and the admin review screen exists and works. One narrow item remains open: whether `GET /api/donations/pending`/`POST /api/donations/:id/review` independently verify admin role server-side, or only rely on the client hiding the tab (05 UX-21) — not re-confirmed this pass.

## J6 — Language switch

```mermaid
flowchart TD
    A["/profile"] --> B["/language"]
    B -- "pick ta/en/si" --> C[PATCH /api/me language]
    C --> D[local i18n.changeLanguage + savedLang flag set]
    D --> E[UI re-renders in chosen language]
    E -. "future logins" .-> F{App.tsx effect: only re-syncs from server if savedLang() is unset}
```
Evidence: `App.tsx:106-114`, `server/src/index.js:641`.

## Auth gate (cross-cutting)

```mermaid
flowchart TD
    A[Any route under RequireAuth] --> B{authed?}
    B -- no --> C{hasSeenWelcome?}
    C -- no --> D["/welcome"]
    C -- yes --> E["/login"]
    B -- yes --> F[TabLayout: offline banner + Suspense + BottomNav + Outlet]
```
Evidence: `App.tsx:176-180`.
