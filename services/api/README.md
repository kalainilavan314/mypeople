# My People API (FastAPI)

The new Python backend, built as a modular monolith (BRD v1.1, §15A). It runs
alongside the existing Express API in `server/`, which still serves production
under `/api`. This service only answers under `/v1`. Feature endpoints move here
one module at a time.

Current scope: `GET /v1/health`, which confirms the process is running. It does
not connect to PostgreSQL yet.

## Run locally (Windows PowerShell)

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/v1/health, which returns `{"status":"ok"}`. Interactive
docs are at http://localhost:8000/docs outside production.

## Test

```powershell
python -m pytest
```

## Settings

Settings are read from environment variables, falling back to `services/api/.env`.
`.env.example` lists every name; the real `.env` is never committed.

| Variable | Values | Effect |
|---|---|---|
| `APP_ENV` | `development` (default), `staging`, `production` | `production` hides `/docs` and `/openapi.json` |

## Layout

```text
app/
  main.py          builds the FastAPI app and the /v1/health route
  core/config.py   environment settings
tests/             pytest tests
```

Feature modules go under `app/modules/<name>/` (router, schemas, service,
repository, models) as they are migrated.
