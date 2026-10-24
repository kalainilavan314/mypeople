# My People API (FastAPI)

The new Python backend, built as a modular monolith (BRD v1.1, §15A). It runs
alongside the existing Express API in `server/`, which still serves production
under `/api`. This service only answers under `/v1`. Feature endpoints move here
one module at a time, against the same PostgreSQL database.

Current scope:

| Endpoint | What it does |
|---|---|
| `GET /v1/health` | the process is running (no database access) |
| `GET /v1/health/db` | a query runs on PostgreSQL; `503 {"status":"unavailable"}` otherwise |
| `GET /v1/members/me` | the signed-in member's profile; `401` without a valid session |

## Sessions

Members still sign in and out through the Express API (`/api/auth/login`,
`/api/auth/logout`). It sets the `mp_session` cookie, and this API accepts that
cookie, or the same token in an `Authorization: Bearer` header. Both APIs use
the same `JWT_SECRET`, so a session works in both:

- the token is an HS256 JWT `{sub: member id, sv: session version}`, valid for 30 days;
- signing out increments `npm.member.session_version`, and both APIs then
  refuse older tokens (`401 session_expired`);
- deleted members are refused (`401 unauthorized`).

`app/core/security.py` also ports the NIC hash and bcrypt password checks.
They are used by sign-in, which moves here in a later batch together with the
sign-in throttling from `server/src/throttle.js`.

### Compatibility with the Express API

`tests/test_security.py` checks the Python code against fixed vectors that
`server/src/lib.js` produced (`tests/express/auth_vectors.json`).
`tests/test_express_compat.py` runs `lib.js` and bcryptjs live in both
directions; it needs Node and `npm ci --prefix server`, and is skipped
otherwise. Regenerate the vectors after any change to `lib.js`:

```powershell
node tests/express/auth_helpers.mjs --write-vectors
```

Passwords: bcryptjs uses only the first 72 bytes of a password, so the Python
code cuts passwords at 72 bytes too (a Tamil character is 3 bytes).

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

Tests in `tests/test_database.py` and `tests/test_members_me.py` use the
`DATABASE_URL` from `.env` or the environment and are skipped when none is
set. The member tests write inside a transaction that is always rolled back.
CI runs everything against a fresh PostgreSQL container.

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
| `JWT_SECRET` | long random string (required) | Must equal the Express API's `JWT_SECRET`; production refuses the `dev-secret` fallback |

## Layout

```text
app/
  main.py              builds the FastAPI app (create_app)
  health.py            /v1/health and /v1/health/db
  core/config.py       environment settings
  core/security.py     NIC hash, bcrypt, session tokens (shared with Express)
  db/session.py        engine and per-request sessions (get_db)
  db/base.py           ORM base class and the autogenerate table filter
  db/express_baseline.py   the Express migrations behind revision 0001
  modules/auth/        session check: repository, service, CurrentMember dependency
  modules/membership/  /v1/members/me: router, schemas, repository
alembic/               Alembic environment and revisions
tests/                 pytest tests
tests/express/         Node helper and vectors from server/src/lib.js
```

Each feature module under `app/modules/<name>/` keeps the router thin, puts
rules in `service.py` and SQL in `repository.py`. Tables still owned by the
Express migrations are queried with SQL rather than declared as models, so
Alembic autogenerate leaves them alone.
