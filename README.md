# My People / என் மக்கள்

Tamil-first membership and community platform for the Northern Province People's Movement. Requirements: BRD v1.1 (MP-BRD-001), summarised in [docs/requirements](docs/requirements/README.md).

Production today is the member PWA (`app/`, Vite + React) served by the Express API (`server/`) on PostgreSQL. The repository is becoming a monorepo for the BRD's target platform, one tested batch at a time: Expo member and staff apps, a Next.js admin dashboard and a FastAPI backend. See [docs/architecture/system-overview.md](docs/architecture/system-overview.md).

## Repository layout

```text
app/                  live member PWA (production; do not move)
server/               live Express API /api and SQL migrations 0000-0011 (production; do not move)
services/
  api/                FastAPI modular monolith /v1, Alembic, pytest
  ai-worker/          planned private AI worker (README only, BRD Phase 3)
packages/
  design-tokens/      colours, spacing, type scale, locked fonts
  i18n/               Tamil, English and Sinhala UI text
  api-client/         typed /v1 client generated from OpenAPI
  mobile-ui/          shared React Native components and the locked fonts
apps/
  member-mobile/      Expo member app (shell: five tabs, API connection check)
  staff-mobile/       Expo staff app (shell)
  admin-web/          Next.js admin dashboard (shell: live API status; not for deployment)
docs/                 architecture, development, api, database, security, requirements
deployment/           release packaging, staging, activation and verification
design/               design history and fixture QA screenshots
scripts/              PWA browser checks
.github/workflows/    CI
```

`app/` and `server/` stay outside the npm workspaces and keep their own lockfiles. Production releases run from those exact paths, and the PWA uses React 18. Full tree: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md). Conventions for contributors and AI agents: [CLAUDE.md](CLAUDE.md).

## Quick start

```powershell
npm install
npm --prefix app install
npm --prefix server install
npm run dev        # PWA on http://localhost:5173
npm run dev:api    # Express API on http://localhost:8787
```

Database, FastAPI and test setup: [docs/development/setup.md](docs/development/setup.md).

## Documentation

- [System overview](docs/architecture/system-overview.md) and [member PWA structure](docs/architecture/member-pwa.md)
- [Development setup](docs/development/setup.md)
- [API reference](docs/api/api-reference.md)
- [Database guide](docs/database/database-guide.md)
- [Security rules](docs/security/security-rules.md)
- [Requirements and status](docs/requirements/README.md)
- [Deployment, backup and rollback](deployment/README.md)
- [Home and navigation specification](docs/home-design.md), [Profile layout](docs/profile-design.md)

## Member PWA notes

Authentication, member profiles, card credentials, events/RSVP, community reports, donations and gallery use the Express API. Surveys, ideas, skills, courses and some activity views still use the prototype adapter until their APIs are built; they are not server-backed.

Gallery photos are licensed sample assets; credits are in `app/public/gallery/ATTRIBUTION.json`. Home labels its images as illustrative; prompts and originals are in `docs/assets/`.

Browser checks (`scripts/verify-*.mjs`) use fixture members and mocked API responses, and can target a production preview with `MY_PEOPLE_BASE_URL`. They cover Home in English and Tamil at five widths, Profile and photo upload, membership card, civic system and feature routes.

The initial directory moves are already applied. Do not rerun `docs/refactor/move-files.ps1` on this checkout.
