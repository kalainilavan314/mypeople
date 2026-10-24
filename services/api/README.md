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
| `POST /v1/auth/sign-in` | `{nic, password}` → sets the session cookie, returns `{token, member}`; `401 invalid_credentials`, `429 too_many_attempts` |
| `POST /v1/auth/sign-out` | ends every session of the member (`204`) and clears the cookie |

## Sessions

Members can sign in through either API (`/api/auth/login` or
`/v1/auth/sign-in`). Both set the same HttpOnly, SameSite=Lax `mp_session`
cookie (Secure outside development), and both accept that cookie or the same
token in an `Authorization: Bearer` header. Both use the same `JWT_SECRET` and
`NIC_PEPPER`, so a session from either works in both:

- the token is an HS256 JWT `{sub: member id, sv: session version}`, valid for 30 days;
- signing out through either API increments `npm.member.session_version`, and
  both then refuse every older token (`401 session_expired`);
- deleted members are refused (`401 unauthorized`).

Sign-in throttling follows `server/src/throttle.js`, and both APIs count the
same `npm.auth_attempt` rows. Failures are counted per NIC hash and client IP
together over 15 minutes: from 5 failures each attempt waits 0.4 s more (up to
2 s), from 10 attempts are refused for 15 minutes with `Retry-After: 900`. A
correct password clears the failures. The wait is asynchronous, so throttled
attempts do not tie up the server.

Two deliberate differences from the Express API:

- An unknown NIC still runs a bcrypt check, so the response time does not
  reveal which NICs are registered.
- The client IP is not read from `X-Forwarded-For` directly, because a client
  can forge it and get unlimited attempts. **Behind Nginx, start uvicorn with
  `--proxy-headers --forwarded-allow-ips=127.0.0.1`** (Nginx's address), so the
  real client address is used. Without that, every request appears to come
  from Nginx, and ten wrong passwords for one NIC would lock that member out
  for everyone.

Cookie-authenticated `POST`/`PUT`/`PATCH`/`DELETE` requests from another site
are refused with `403 csrf_origin_mismatch`, as in the Express API. Requests
without the cookie (mobile apps) or without an `Origin` header are not
affected; `ALLOWED_ORIGINS` adds trusted origins. Every `/v1` response carries
`Cache-Control: no-store` and the Express API's security headers.

### Compatibility with the Express API

`tests/test_security.py` checks the Python code against fixed vectors that
`server/src/lib.js` produced (`tests/express/auth_vectors.json`).
`tests/test_express_compat.py` runs `lib.js`, `throttle.js` and bcryptjs live:
tokens and password hashes in both directions, and the throttle decision for 0
to 11 failures against the same database rows. It needs Node and
`npm ci --prefix server`, and is skipped otherwise. Regenerate the vectors
after any change to `lib.js`:

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
| `NIC_PEPPER` | string (required) | Must equal the Express API's `NIC_PEPPER`, and never change; production refuses `dev-pepper` |
| `ALLOWED_ORIGINS` | comma-separated origins (optional) | Other sites allowed to send cookie-authenticated writes |

## Layout

```text
app/
  main.py              builds the FastAPI app (create_app)
  health.py            /v1/health and /v1/health/db
  core/config.py       environment settings
  core/security.py     NIC hash, bcrypt, session tokens (shared with Express)
  core/middleware.py   cross-origin write check and security headers
  db/session.py        engine and per-request sessions (get_db)
  db/base.py           ORM base class and the autogenerate table filter
  db/express_baseline.py   the Express migrations behind revision 0001
  modules/auth/        sign-in, sign-out, throttle, CurrentMember dependency
  modules/membership/  /v1/members/me: router, schemas, repository
alembic/               Alembic environment and revisions
tests/                 pytest tests
tests/express/         Node helper and vectors from server/src/lib.js
```

Each feature module under `app/modules/<name>/` keeps the router thin, puts
rules in `service.py` and SQL in `repository.py`. Tables still owned by the
Express migrations are queried with SQL rather than declared as models, so
Alembic autogenerate leaves them alone.
