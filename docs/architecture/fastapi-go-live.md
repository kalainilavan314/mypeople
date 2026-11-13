# FastAPI `/v1` Go-Live Runbook & Strangler Proxy Protocol
**Document Code:** MP-OPS-001
**Milestone:** M1.0 — Foundations, Accessibility Kit & Go-Live Infrastructure (Batch F3)
**Target:** DigitalOcean Production Host (`178.128.126.35.nip.io`)
**Status:** Candidate configuration; staging syntax, routing and release approval pending

---

## 1. Operational Preconditions & Security Baseline

Before any proxy configuration is touched or services are enabled, the operator must verify:

1. **Shared Secrets & Database Parity:**
   - FastAPI and Express connect to the **same** PostgreSQL database.
   - FastAPI environment file (`/srv/mypeople/services/api/.env`) defines exact matching `JWT_SECRET` and `NIC_PEPPER` from Express.
   - Never commit or log real secrets, keys, or member data. File permissions on `.env` must be `0600`, owned by `mypeople:mypeople`.

2. **Database Migrations:**
   - Express migrations run first (`server/migrations/`).
   - Alembic migrations run to head (`services/api/alembic/versions/`):
     ```bash
     cd /srv/mypeople/services/api
     ./.venv/bin/alembic current
     ./.venv/bin/alembic upgrade head
     ```
   - Verify zero unapplied migrations before proxy cutover.

3. **Private Media & Evidence Storage Permissions:**
   - `MEDIA_STORAGE_DIR` (public re-encoded gallery media): mode `0755`, owned by `mypeople:mypeople`.
   - `EVIDENCE_STORAGE_DIR` (private NIC, passport, selfie biometrics): mode `0700`, owned by `mypeople:mypeople`.
   - Both directories reside on encrypted storage and are included in the daily verified backup snapshot.
   - Direct web access to evidence is blocked at the Nginx layer (`location ^~ /evidence/ { deny all; return 403; }`).

4. **Policy-Dependent Feature Flags (Must Remain OFF):**
   - Per Gate G1 and BRD rules, the following feature flags MUST remain disabled during Phase 1:
     - G2 (Household Management - scoped to staff pilot)
     - G3 (Elections)
     - G4 (Assisted Verification)
     - G5 (Payment Gateway)
     - G6 (Tamil AI Assistant)

---

## 2. Staging Validation & Smoke Check Sequence

Run this sequence on staging (or on production localhost prior to Nginx reload):

```bash
# A. Service Startup Check
sudo systemctl status mypeople-api.service

# B. Local Health Probes
curl -sS -f http://127.0.0.1:8000/v1/health | jq .
# Expected: {"status": "ok"}

curl -sS -f http://127.0.0.1:8000/v1/health/db | jq .
# Expected: {"status": "ok"}

# C. Notification Task Health Probe
sudo -u mypeople /srv/mypeople/services/api/.venv/bin/python -m app.tasks.notifications --check
# Expected: status=ready, database=connected; push may be configured or inbox_fallback.

# D. Notification Task Dry-Run Probe
sudo -u mypeople /srv/mypeople/services/api/.venv/bin/python -m app.tasks.notifications --dry-run
# Expected: dryRun=true and numeric counts; counts depend on current data.

# E. Authenticated Staff & Member Smoke Checks
# 1. Sign in with synthetic staff account -> receive JWT access token
# 2. Query /v1/identity/reviews with staff token -> verify role and area scoping
# 3. Request /evidence/path/to/sample.jpg directly -> verify 403 Forbidden
# 4. Request /v1/identity/evidence/... with staff token -> verify authenticated streaming
```

---

## 3. Nginx Strangler Cutover Protocol

The strangler pattern enables `/v1/` routes to point to FastAPI while `/api/` and the member PWA (`/`) remain on Express.

1. **Install Nginx Drop-In Snippet:**
   ```bash
   sudo cp /srv/mypeople/deployment/nginx/fastapi-v1-snippet.conf.example /etc/nginx/snippets/mypeople-fastapi-v1.conf
   ```

2. **Verify Snippet Rules:**
   - Route ownership: `/v1/` -> `127.0.0.1:8000`.
   - Max body size: 15 MB proxy ceiling for upload endpoints (`/v1/identity/me/documents/{kind}`, including selfie kind, and `/v1/content/albums/{id}/photos`), 2 MB default. FastAPI applies its own per-file limits.
   - Header hardening: `proxy_set_header X-Forwarded-For $remote_addr;` (replaces client header to protect lockout counters).
   - Fast timeouts on `/v1/health`: 2s connect, 3s read.
   - Private media blocked: `location ^~ /evidence/ { deny all; return 403; }`.

3. **Include Snippet in Active Site:**
   In `/etc/nginx/sites-available/default`, inside the `server { ... listen 443 ssl ... }` block:
   ```nginx
   include /etc/nginx/snippets/mypeople-fastapi-v1.conf;
   ```

4. **Syntax Check & Reload:**
   ```bash
   sudo nginx -t
   # MUST output: syntax is ok / test is successful
   sudo systemctl reload nginx
   ```
   CI syntax-checks the drop-in snippet in an isolated Nginx server block. That does not validate the live host's complete configuration; the operator must run `nginx -t` there before any reload.

5. **External Verification Over HTTPS:**
   ```bash
   # Check Express is intact:
   curl -fsS https://178.128.126.35.nip.io/api/health
   # Check FastAPI is responding:
   curl -fsS https://178.128.126.35.nip.io/v1/health
   # Check evidence blocking:
   curl -sS -o /dev/null -w '%{http_code}\n' https://178.128.126.35.nip.io/evidence/test.jpg # Must be 403
   ```

---

## 4. Background Notification Scheduler Activation

Once API traffic is verified:

1. **Install and Enable Systemd Units:**
   ```bash
   sudo cp /srv/mypeople/deployment/systemd/mypeople-notifications.service /etc/systemd/system/
   sudo cp /srv/mypeople/deployment/systemd/mypeople-notifications.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now mypeople-notifications.timer
   ```

2. **Verify Timer Schedule:**
   ```bash
   systemctl list-timers mypeople-notifications.timer
   # Verify NEXT time is within 60 seconds
   ```

3. **Check First Execution in Journal:**
   ```bash
   sudo journalctl -u mypeople-notifications.service -n 20 --no-pager
   # Confirm JSON log output: {"event": "dispatch_complete", ...}
   ```

---

## 5. Post-Cutover Monitoring & Operational Thresholds

Monitor the following metrics for the first 2 hours post-cutover:

| Metric | Source | Normal Range | Alert Threshold | Action if Exceeded |
|---|---|---|---|---|
| **API Error Rate** | Nginx `access.log` (`/v1/`) | 5xx $< 0.1\%$ | 5xx $> 1\%$ for 3 mins | Check `journalctl -u mypeople-api.service` |
| **Response Latency** | `/v1/health` probe | $p_{95} < 50\text{ ms}$ | $p_{95} > 250\text{ ms}$ | Inspect PostgreSQL connections and lock waits |
| **PostgreSQL Pool** | `pg_stat_activity` | $< 25$ connections | $> 80$ connections | Check connection leak; restart API if pool exhausted |
| **Scheduler Runtime** | Systemd journal | $< 2\text{ s}$ per cycle | $> 30\text{ s}$ per cycle | Job timeout kills at 45s; inspect row lock contention |
| **Failed Pushes** | Systemd journal | `skipped` or `sent` | `waiting` $> 100$ | Inspect network connectivity to push gateways |

---

## 6. Instant Rollback Procedure (Zero Downtime)

If any critical issue is discovered with `/v1/`:

1. **Disable Nginx `/v1/` Proxy:**
   In `/etc/nginx/sites-available/default`, comment out the snippet line:
   ```nginx
   # include /etc/nginx/snippets/mypeople-fastapi-v1.conf;
   ```

2. **Test and Reload Nginx:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
   *Express `/api/` and the member PWA on `/` remain 100% active and unaffected.*

3. **Disable Background Scheduler:**
   ```bash
   sudo systemctl stop mypeople-notifications.timer
   sudo systemctl disable mypeople-notifications.timer
   ```

4. **Database Rollback Policy:**
   - **DO NOT** roll back PostgreSQL migrations unless explicit data corruption has occurred and a verified database backup exists.
   - Alembic migrations in Phase 1 are additive (backward compatible with Express queries).

5. **Incident Record:**
   Record timestamp, rollback trigger reason, operator identity, and log excerpts in the incident register.

---

## 7. Gate G1 Sign-Off & Release Governance

Per `docs/requirements/gate-g1.md`:
- Running this runbook does **not** bypass Gate G1.
- Gate G1 validator (`python -m unittest discover -s deployment/tests -p 'test_gate_g1.py'`) verifies evidence readiness.
- The 30-day pilot remains confined to the designated pilot district under Tier 4/5 staff supervision.
