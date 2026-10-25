# Development setup

Commands are for Windows PowerShell from the repository root unless noted.

## Prerequisites

- Node.js 24 and npm 11
- Python 3.12
- PostgreSQL 16 or later, running locally, with an empty database for the app
- Git (Git Bash also provides `ssh`/`scp` for deployments)

## 1. Install

```powershell
npm install                  # workspaces: packages/* and apps/*
npm --prefix app install     # live PWA (own lockfile, React 18)
npm --prefix server install  # live Express API (own lockfile)
```

`app/` and `server/` are deliberately outside the npm workspaces; see `CLAUDE.md`.

## 2. Configure

Copy the examples and fill in local values. The real `.env` files are git-ignored.

```powershell
copy server\.env.example server\.env
copy services\api\.env.example services\api\.env
```

`services/api/.env` must use the same `DATABASE_URL`, `JWT_SECRET` and `NIC_PEPPER` as `server/.env`, so the two APIs share members and sessions.

## 3. Database

```powershell
npm run migrate --prefix server       # Express migrations 0000-0011
npm run seed:demo --prefix server     # optional: one demo member (see server/src/seed-demo.js)
```

Then, in `services/api` with its virtual environment active (step 4):

```powershell
python -m alembic upgrade head        # new database
python -m alembic current             # should print 0001 (head)
```

An existing database that already has every Express migration uses `python -m alembic stamp 0001` instead. Alembic refuses both commands while an Express migration is missing; see `docs/database/database-guide.md`.

## 4. FastAPI environment

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

## 5. Run

| What | Command | Address |
|---|---|---|
| Live PWA (Vite) | `npm run dev` | http://localhost:5173 (proxies `/api` to 8787) |
| Express API | `npm run dev:api` | http://localhost:8787/api/health |
| FastAPI | `uvicorn app.main:create_app --factory --reload --port 8000` (in `services/api`) | http://localhost:8000/v1/health, docs at `/docs` |

The same three servers are defined in `.claude/launch.json` (`my-people-web`, `my-people-express`, `my-people-api`).

## 6. Test

| What | Command |
|---|---|
| Live PWA | `npm run typecheck` and `npm run build` |
| Express API | `npm test --prefix server` |
| FastAPI | `python -m pytest` in `services/api` |
| Shared packages | `npm run test:packages` and `npm run typecheck:packages` |
| PWA browser checks | `node scripts/verify-home.mjs` and the other `scripts/verify-*.mjs` (need Playwright) |

FastAPI database tests use `DATABASE_URL` and roll back everything they write; without a database they are skipped. Tests that compare with the Express code (`tests/test_express_compat.py`) need Node and `npm --prefix server install`.

CI (`.github/workflows/ci.yml`) runs the PWA build, the Express tests, the package tests, and the FastAPI tests against a fresh PostgreSQL built from the Express migrations plus Alembic.

## 7. After changing an API endpoint

```powershell
cd services/api; python scripts/export_openapi.py; cd ../..
npm run generate -w @my-people/api-client
```

Commit `packages/api-client/openapi.json` and `src/schema.ts` with the API change.
