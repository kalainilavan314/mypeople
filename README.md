# Northern Province People's Movement — Membership App

வடமாகாண மக்கள் இயக்கம் · Jaffna, Sri Lanka
Tamil-first membership platform for budget Android phones.

The current member UI follows the NorthUnity home layout with a navy/cyan theme
and raised MedTech-style QR navigation. See `design/medtech-navigation-specification.md`
and `design/northunity-ui-specification.md`; the earlier screen specifications and
React, Flutter and React Native component trees are retained in `design/`.
The five tabs are Home / Events / Card / Gallery / Profile. The public gallery API
reads `server/src/gallery-albums.json` and licensed sample WebP assets. Login and
registration retain their existing theme. Deployment instructions are in `deployment/README.md`.

This repo now holds two things:

| Folder / file | What it is |
|---|---|
| **`app/`** | **The production app.** Installable React + TypeScript PWA (Vite), bilingual, with live APIs and retained mock adapters for planned features. |
| **`server/`** | Express API, Postgres migrations, authentication, member profiles, events/RSVP, reports, donations, and gallery metadata. |
| `PROJECT.md` | Feature scope + the canonical Postgres data model. |
| `NPM App Prototype.dc.html` | Original design-tool **prototype** — the design reference. |
| `NPM Movement App.dc.html` | 5 core screens side-by-side (design reference). |
| `android-frame.jsx`, `support.js` | Prototype runtime only. Not used by `app/`. |

## Run the app

> Requires **Node.js 18+** (`node -v`). If you don't have it: `winget install OpenJS.NodeJS.LTS`, then reopen your terminal.

```bash
cd app
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Run the backend on port 8787
for authentication and live content; follow `server/README.md` for configuration and
migrations. Surveys, ideas, courses, skills, and some activity views retain their
existing mock adapters while their production APIs are planned.

Other scripts: `npm run build` (production bundle + service worker), `npm run preview`
(serve the build), `npm run typecheck`.

## Architecture

```
app/src/
  main.tsx / App.tsx      React Query + Router + bottom-tab shell, language sync, outbox flush
  theme/tokens.ts         shared CSS-variable references, fonts and control sizing
  styles/                 base tokens/global styles, civic components and scoped navy member theme
  i18n/                   i18next; ta.json + en.json string sets, si.json stub (fallback → ta)
  data/
    types.ts              TypeScript types mirroring the Postgres schema (server/migrations)
    api.ts                ApiClient interface — the single contract screens depend on
    index.ts              composite of mockClient and backend-backed httpContent methods
    mock/                 in-memory adapter + seed data (lifted from the prototype)
    queue.ts              IndexedDB outbox, client_uuid idempotency (offline-first reports)
    queries.ts            React Query hooks (queries + mutations)
  components/             Icon, PalmyraMark, ui.tsx primitives, BottomNav, ScreenHeader
  screens/                one file per screen; onboarding/ holds Join/OTP/NIC/Pending
  lib/qr.tsx              real scannable QR (membership card + rotating check-in token)
```

### Design fidelity
The signed-in theme uses navy `#07172D`, cyan `#57D9FF`, and self-hosted Outfit with
Noto Sans Tamil fallback. The NorthUnity photo-led layout preserves all existing
feature links. The MedTech navigation has a raised centre control that opens the
server-issued check-in QR. The Palmyra emblem remains `components/PalmyraMark`.

### Data flow / swapping in the real backend
Screens call **hooks** (`data/queries.ts`) → the **`api`** singleton (`data/index.ts`) →
which combines mock and HTTP methods. Authentication/profile/QR use `authApi`,
events and RSVP use `httpContent`, and the gallery uses its public read-only API.
Remaining planned features can replace individual mock methods with API-backed
implementations while preserving their hooks and screens.

### Offline-first
`data/queue.ts` is an IndexedDB outbox. `submitReport` enqueues with a client-generated
`client_uuid`, optimistically shows the report with a **"saved — will sync"** pill, and flushes
when back online (`App.tsx` listens for `online` and calls `api.flushOutbox()`). The server
upserts on `client_uuid`, so a replayed queue can't duplicate. Same pattern applies to RSVPs
and survey votes.

## Adding / finishing a screen (the pattern)

Every screen follows the same shape, so the remaining detail screens are mechanical:

1. Add a route in `app/src/App.tsx`.
2. Read data with a hook from `data/queries.ts` (add one if needed; it just calls `api`).
3. Wrap async data in `<QueryBoundary>` for loading/error states.
4. Compose from `components/ui.tsx` primitives (`Button`, `Chip`, `Card`, `Toggle`,
   `StatusPill`, `TierBadge`, `LabelPair`, `EmptyState`) + `Icon` + tokens from `theme/tokens`.
5. Bilingual UI strings via `useTranslation()`; bilingual **content** via `pick(lang, ta, en)`.

## Status

Ported end-to-end: onboarding (Join → OTP → NIC → Pending), Home, Card, Events (list + map),
Reports + composer, Profile, Announcement, Survey, Event detail, Report detail, Referral,
Milestones, Notifications, Courses, Ideas, Skills, Privacy, Language.

Not yet done (next passes): real SMS/OTP + NIC review backend, ward-coordinator app, push
delivery, live Postgres deployment, automated tests, full Sinhala translation.
