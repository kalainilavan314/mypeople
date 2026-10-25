# Environments

Where each environment runs and where its settings live. Settings are never stored here; only their names.

| Environment | Where | Settings |
|---|---|---|
| Development | Your computer | `server/.env`, `services/api/.env`, each app's `.env.local`; `deployment/docker-compose.dev.yml` can provide PostgreSQL |
| CI | GitHub Actions | Test-only values inside `.github/workflows/ci.yml` |
| Production | The Linux server (see `deployment/README.md`) | The server's environment files on `/srv/secure` |

There is no staging environment yet.

Production runs the Express API and the PWA. The FastAPI service and the new apps are not deployed.

BRD v1.1: §15A.10 environment diagram, §15A.12 DevOps; OD-20 (hosting location).
