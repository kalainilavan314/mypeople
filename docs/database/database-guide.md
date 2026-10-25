# Database guide

PostgreSQL 16 on the server (17 locally is fine). Production data lives on the encrypted `/srv/secure` volume and is backed up daily, and before every release, with restic (`karan-backup.service`, off-server, encrypted, integrity-checked).

## Schemas and tables today

| Schema | Tables | Created by |
|---|---|---|
| `geo` | `province`, `district`, `ds_division`, `gn_division` (Northern Province reference data) | Express `0000` |
| `npm` | `member`, `otp`, `auth_attempt`, `verification_audit`, `onboarding_answer`, `referral_event`, `event`, `event_rsvp`, `community_report`, `donation` | Express `0001`–`0011` |
| `public` | `error_log` (Express 5xx errors), `schema_migrations` (Express ledger), `alembic_version` (Alembic) | Express, Alembic |

Sensitive columns: `npm.member.nic_hash` (peppered SHA-256, never the NIC itself) and `password_hash` (bcrypt). OTP codes are stored only as HMACs.

## Migrations

Two runners, one rule: **new schema changes are Alembic revisions only.**

- `server/migrations/0000`–`0011` are frozen. They built the schema before Alembic and are still applied by `npm run migrate --prefix server` on a new database.
- Alembic revision `0001` (`services/api/alembic/versions/0001_baseline_express_schema.py`) is a no-op baseline that stands for those twelve files. `alembic/env.py` refuses every command, `stamp` included, while any of them is missing from the Express ledger, so a database that is behind can never be marked current.
- `tests/test_express_baseline.py` fails if a new file appears in `server/migrations`.

| Situation | Commands |
|---|---|
| New, empty database | `npm run migrate --prefix server`, then `python -m alembic upgrade head` |
| Existing database with all Express migrations | `python -m alembic stamp 0001` |
| Existing database that is behind | `npm run migrate --prefix server`, then `python -m alembic stamp 0001` |
| A schema change | `python -m alembic revision --rev-id 0002 -m "what changes"`, review `python -m alembic upgrade head --sql`, then upgrade |

Autogenerate compares only tables declared on `app.db.base.Base`, so it never proposes dropping the Express tables. Until a module takes over a table, FastAPI reads and writes it with SQL in that module's `repository.py`.

Rules from BRD §13.8 for every new revision: forward-only and peer-reviewed; expand-and-contract for zero-downtime changes; a verified backup before every production migration; data migrations separate from schema migrations.

## Conventions

- Tables and columns `snake_case`; UUID primary keys; `timestamptz` for times; soft delete with `deleted_at` where records must stay auditable.
- Every status column gets a `CHECK` constraint (or enum) listing its states.
- API sessions run in UTC (`timezone=UTC` on each connection), so timestamps leave the API as `...Z`.

## Where the schema is going (BRD §13.5–13.8)

The BRD separates data by purpose: schemas `core`, `community`, `assistance`, `household`, `finance`, `content`, `ai` and `ops`, with the identity vault (ID images, biometric data) in a separate database with its own credentials and keys. Assistance and household tables get row-level security. Audit logs are append-only and hash-chained. Today's `npm` tables move into those schemas gradually, through Alembic, as each module is rebuilt. No cross-purpose joins are allowed (AP-02, NFR-PRV-07).

## Tests and the database

FastAPI tests that need PostgreSQL read `DATABASE_URL` and run inside one transaction that is rolled back, so they leave nothing behind. The few that must commit (the Express throttle comparison) use unique test identifiers and delete their rows. CI builds a fresh PostgreSQL 17 database from the Express migrations plus Alembic for every run.
