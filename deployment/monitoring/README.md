# Monitoring

What watches the system today:

- `GET /api/health` (Express) and `GET /v1/health`, `GET /v1/health/db` (FastAPI).
- `deployment/verify_public_release.py` after each release.
- Encrypted restic backups with integrity checks (`karan-backup.service`).
- Express 5xx errors in the private `error_log` table.

**Status: not built yet.** The BRD's error tracking, metrics and alerting (Sentry, Prometheus, Grafana) and security monitoring are not set up.

BRD v1.1: INT-11, INT-21; NFR-OBS-01; §15A.12.
