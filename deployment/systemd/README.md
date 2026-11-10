# FastAPI Background Tasks & Systemd Timers (Production)

This directory contains the systemd units installed on the production server on 10 November 2026: the FastAPI service, the notification scheduler and the admin dashboard (`mypeople-admin.service`, Next.js on `127.0.0.1:3003`). They run as `app` from `/srv/secure/app/mypeople-api/current` and `/srv/secure/app/mypeople-admin/current`, with settings in each one's `shared/.env` (see `deployment/README.md`).

---

## 1. Unit Overview

| Unit | Type | Interval / Lifecycle | Purpose |
|---|---|---|---|
| `mypeople-api.service` | `simple` | Continuous daemon | Uvicorn server running FastAPI on `127.0.0.1:8000`. |
| `mypeople-notifications.timer` | `timer` | Every 1 minute (`*:0/1:00`) | Triggers the dispatcher oneshot service. `AccuracySec=5s`, `Persistent=true`. |
| `mypeople-notifications.service` | `oneshot` | Runs per timer trigger | Executes `python -m app.tasks.notifications`. `TimeoutStartSec=45s`. |

---

## 2. Dispatcher Operations & Concurrency Safety

The dispatcher cycle performs three synchronized actions every minute:
1. **Due Broadcasts:** Evaluates scheduled staff announcements. If an election silence window is active over the target area, the broadcast is marked `held` with an audit trail entry (`election.silence.held`) unless marked emergency. Otherwise, fans out in-app notices to members in scope and marks state `sent`.
2. **Photo Removal Escalations:** Scans open photo removal requests (`FR-ADM-006`). If open longer than 18 hours without resolution, alerts Tier 5 media takedown holders via in-app notification.
3. **Push Delivery:** Dispatches pending push notices (up to 500 per cycle) to registered APNs/FCM tokens respecting member topic preferences and quiet hours. Stale/unregistered tokens rejected by push gateways are automatically retired.

### Concurrency Protection
- All database queries use `FOR UPDATE SKIP LOCKED`.
- If a previous cycle takes longer than expected, a concurrent run skips currently locked rows and never double-sends broadcasts or duplicate push alerts.
- `TimeoutStartSec=45s` enforces termination before the subsequent 60-second cycle begins, preventing worker accumulation.

---

## 3. Operational Commands

### A. Pre-flight Verification (Manual Checks)
Before enabling the background timer, verify database connectivity and dry-run execution as the service user:

```bash
# 1. Readiness & configuration probe
sudo systemd-run --pipe --wait --uid=app --gid=app -p EnvironmentFile=/srv/secure/app/mypeople-api/shared/.env -p WorkingDirectory=/srv/secure/app/mypeople-api/current /srv/secure/app/mypeople-api/current/.venv/bin/python -m app.tasks.notifications --check
# Expected: {"status": "ready", "database": "connected", "push": "configured"}

# 2. Dry-run inspection (queries counts without mutating rows or acquiring write locks)
sudo systemd-run --pipe --wait --uid=app --gid=app -p EnvironmentFile=/srv/secure/app/mypeople-api/shared/.env -p WorkingDirectory=/srv/secure/app/mypeople-api/current /srv/secure/app/mypeople-api/current/.venv/bin/python -m app.tasks.notifications --dry-run
# Expected: {"dryRun": true, "dueBroadcasts": 0, "overdueRemovals": 0, "pendingPushes": 0}
```

### B. Installation & Service Activation
```bash
# Copy unit files to systemd system directory
sudo cp deployment/systemd/mypeople-api.service /etc/systemd/system/
sudo cp deployment/systemd/mypeople-notifications.service /etc/systemd/system/
sudo cp deployment/systemd/mypeople-notifications.timer /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable and start the timer
sudo systemctl enable --now mypeople-notifications.timer

# Confirm timer status and next trigger time
systemctl list-timers mypeople-notifications.timer
```

### C. Monitoring & Journal Inspection
The dispatcher writes structured JSON event logs to the systemd journal. No personal information, names, phone numbers, or message content is logged:

```bash
# Follow live dispatcher execution
sudo journalctl -u mypeople-notifications.service -f

# Filter by error level
sudo journalctl -u mypeople-notifications.service -p err -n 50
```

---

## 4. Troubleshooting & Recovery

| Symptom | Probable Cause | Action |
|---|---|---|
| `TimeoutStartSec` exceeded (Job killed after 45s) | Database connection pool exhaustion or network lock contention. | Inspect active PostgreSQL locks (`pg_stat_activity`). Run `--dry-run` to test query speed. |
| `task_failed` with `config_error` | Missing or unreadable `/srv/secure/app/mypeople-api/shared/.env`. | Verify permissions: `chmod 600` and ownership `app:app`. |
| Pushes marked `skipped` | Member has disabled push notifications for the category, or device is currently in quiet hours. | Normal behavior per specification; notices remain accessible in the member's in-app inbox. |
| Pushes marked `waiting` | Push notification service temporarily unreachable. | Stored in outbox; will be re-attempted automatically on next 1-minute cycle. |
