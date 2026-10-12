# My People / என் மக்கள்

Tamil-first membership and community PWA for the Northern Province People's Movement.

The frontend uses Vite, React and TypeScript. The existing backend uses Express and PostgreSQL. Home follows the supplied MedTech reference: navy panels, pale blue activity surfaces, compact Inter/Noto Sans Tamil type and short feature captions. Its navigation colours are scoped to Home. Events, Card, Gallery, Profile and authentication retain their existing appearance and behaviour, including Card's `/card?qr=1` entry.

## Run locally

```powershell
npm --prefix app install
npm --prefix app run dev
```

Vite prints its local URL. Run the backend using the configuration and migrations in [server/README.md](server/README.md). Authentication and live content require that backend.

```powershell
npm --prefix app run typecheck
npm --prefix app run build
npm --prefix app run preview
```

## Project layout

```text
app/
  public/                 logos, fonts/images, licensed gallery assets and PWA metadata
  src/
    main.tsx              providers, language, fonts and viewport setup
    App.tsx               route entry
    core/
      theme/              CSS and TypeScript design tokens
      i18n/               English/Tamil resources and retained Sinhala resource
      lib/                QR, images, NIC and viewport helpers
      api/                HTTP contracts/adapters, models, queries and outbox
    shared/
      components/         navigation, primitives, icons and shared overlays
      hooks/              authentication, member, theme and network hooks
    features/
      home/ events/ card/ gallery/ profile/ auth/
      community/ reports/ surveys/ ideas/ learning/ fundraising/ referrals/
server/                   existing API, database migrations and gallery metadata
docs/                     architecture, Home specification and refactor handoff
scripts/                  local browser checks and refactor tooling
deployment/               existing deployment, backup and rollback tooling
design/                   retained design history and fixture QA outputs
```

Screens own feature orchestration; local components render feature sections. Shared components and core services remain independent of screen entry points. Vite and TypeScript resolve `@/` to `app/src/`. Theme CSS loads through a single entry point preserving its original cascade.

## Feature status

Authentication, member profiles, card credentials, events/RSVP, community reports, donations and gallery retain their existing HTTP adapters. Surveys, ideas, skills, courses and some historical activity views retain the existing prototype adapter while their production APIs are planned. This refactor preserves those flows; it does not make prototype data server-backed.

Gallery photos are licensed sample assets. Their credits and licences are recorded in `app/public/gallery/ATTRIBUTION.json` and exposed through the existing gallery API. Home labels its photo as illustrative.

## Documentation and verification

- [Architecture](docs/architecture.md)
- [Home and navigation specification](docs/home-design.md)
- [Migration commands and code handoff](docs/refactor/README.md)
- [Deployment, backup and rollback](deployment/README.md)

Local browser checks live in `scripts/verify-home.mjs`, `scripts/verify-civic.mjs` and `scripts/verify-membership-card.mjs`. They use fixture members and mocked API responses. The Home matrix covers English/Tamil at 320, 375, 390, 768 and 1280 pixels, search, long names, navigation alignment and clearance. Membership checks include viewer/QR behaviour, long Tamil text and PDF export.

The initial directory moves are already applied. Do not rerun `docs/refactor/move-files.ps1` on this checkout. Deployment artifacts and the unused Flutter/React Native design folders were removed as requested. Backend migrations, runtime certificates, uploads and deployment scripts were preserved.
