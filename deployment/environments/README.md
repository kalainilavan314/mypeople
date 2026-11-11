# Environments

Where each environment runs and where its settings live. Settings are never stored here; only their names.

| Environment | Where | Settings |
|---|---|---|
| Development | Your computer | `server/.env`, `services/api/.env`, each app's `.env.local`; `deployment/docker-compose.dev.yml` can provide PostgreSQL |
| CI | GitHub Actions | Test-only values inside `.github/workflows/ci.yml` |
| Staging | The same Linux server, beside production, with its own database, secrets and services (see `deployment/staging/README.md`); synthetic data only | `/srv/secure/app/mypeople-staging-api/shared/.env`, `/srv/secure/app/mypeople-staging-admin/shared/.env` |
| Production | The Linux server (see `deployment/README.md`) | The server's environment files on `/srv/secure` |

Production runs the Express API and the PWA, and since 10 November 2026 the FastAPI service, the dashboard and the apps' web versions. Staging runs the new stack only.

BRD v1.1: §15A.10 environment diagram, §15A.12 DevOps; OD-20 (hosting location).
