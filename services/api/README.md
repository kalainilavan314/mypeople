# My People API (FastAPI)

The new Python backend, built as a modular monolith (BRD v1.1, §15A). It runs
alongside the existing Express API in `server/`, which still serves production
under `/api`. This service only answers under `/v1`. Feature endpoints move here
one module at a time, against the same PostgreSQL database.

Current scope:

| Endpoint | Checks |
|---|---|
| `GET /v1/health` | the process is running (no database access) |
| `GET /v1/health/db` | a query runs on PostgreSQL; `503 {"status":"unavailable"}` otherwise |

## Run locally (Windows PowerShell)

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
copy .env.example .env    # then set DATABASE_URL to your local database
uvicorn app.main:create_app --factory --reload --port 8000
```

Open http://localhost:8000/v1/health and http://localhost:8000/v1/health/db.
Interactive docs are at http://localhost:8000/docs outside production.

## Test

```powershell
python -m pytest
```

Tests in `tests/test_database.py` use the `DATABASE_URL` from `.env` or the
environment and are skipped when none is set. CI runs them against a fresh
PostgreSQL container.

## Database migrations (Alembic)

Before Alembic, the Express API built the schema with `server/migrations/*.sql`.
Alembic revision `0001` is a baseline that stands for all twelve of those files
and changes nothing. Alembic refuses to run (even `stamp`) on a database where
any of them is missing, so a database that is behind is never marked current.

| Database | Commands |
|---|---|
| Existing, with all Express migrations applied | `python -m alembic stamp 0001` |
| Existing, behind on Express migrations | `npm run migrate --prefix ../../server`, then `python -m alembic stamp 0001` |
| New and empty | `npm run migrate --prefix ../../server`, then `python -m alembic upgrade head` |

Check the state with `python -m alembic current`. From now on, every schema
change is a new Alembic revision, never a new file in `server/migrations`:

```powershell
python -m alembic revision --rev-id 0002 -m "describe the change"
python -m alembic upgrade head --sql    # review the SQL before applying it
python -m alembic upgrade head
```

Autogenerate (`--autogenerate`) only compares tables declared on
`app.db.base.Base`. Tables created by the Express migrations are ignored, so it
never proposes dropping them.

## Settings

Settings are read from environment variables, falling back to `services/api/.env`.
`.env.example` lists every name; the real `.env` is never committed.

| Variable | Values | Effect |
|---|---|---|
| `APP_ENV` | `development` (default), `staging`, `production` | `production` hides `/docs` and `/openapi.json` |
| `DATABASE_URL` | PostgreSQL URL (required) | The same value the Express API uses; `postgres://` and `postgresql://` both work |

## Layout

```text
app/
  main.py              builds the FastAPI app (create_app)
  health.py            /v1/health and /v1/health/db
  core/config.py       environment settings
  db/session.py        engine and per-request sessions (get_db)
  db/base.py           ORM base class and the autogenerate table filter
  db/express_baseline.py   the Express migrations behind revision 0001
alembic/               Alembic environment and revisions
tests/                 pytest tests
```

Feature modules go under `app/modules/<name>/` (router, schemas, service,
repository, models) as they are migrated.
