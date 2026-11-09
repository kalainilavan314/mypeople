# FastAPI `/v1` go-live runbook

This is the staged production plan for the strangler migration. It does not
change the current live proxy: Express remains the owner of `/api` and the
member PWA until a separately approved deployment.

## Preconditions

- Deploy FastAPI as a dedicated service with the same production PostgreSQL
  database, `JWT_SECRET`, and `NIC_PEPPER` as Express. Never copy secrets into
  this repository or into a release package.
- Run the documented migrations, API tests, and an authenticated smoke test of
  `/v1/health` and `/v1/health/db` on the staging host.
- Create `MEDIA_STORAGE_DIR` and `EVIDENCE_STORAGE_DIR` on encrypted storage;
  set ownership to the API service account, mode 700 for evidence, and add
  both directories to the verified backup set.
- Keep every endpoint owned by exactly one backend. A client moves only after
  its endpoint group is live and verified; `/api` and `/v1` must not implement
  competing writes.
- Record the release commit, migration head, backup ID, storage permissions,
  feature-flag state and responsible operator before staging. Confirm a restore
  of the PostgreSQL backup and the private-file backup in an isolated environment.
- Keep policy-dependent finance, election, assisted-verification and payment
  features disabled until their named owners record approval. A successful
  health check does not authorise those workflows.

## Proxy cutover

The candidate Nginx location is in
`deployment/nginx/my-people-fastapi.conf.example`. Install it on the host only
after staging verification, run `sudo nginx -t`, then reload Nginx. Uvicorn
must run with `--proxy-headers --forwarded-allow-ips=127.0.0.1`; Nginx replaces
client-supplied forwarding headers with `$remote_addr`.

Stage the admin dashboard on an internal address before routing public traffic.
Verify staff MFA, role and area restrictions, sign-out, evidence access and
denied requests with synthetic accounts. Keep its origin and callback settings
in the host-only configuration. Record the Nginx configuration hash and the
result of `nginx -t` before and after the route change.

## Background jobs

Install the notification dispatcher as the one-minute systemd timer in
`deployment/systemd/`. Confirm `systemctl list-timers mypeople-notifications.timer`
shows the next run, inspect its journal after the first execution, and alert on
failed runs. The job is idempotent by design, but a missed timer must be
investigated rather than replayed blindly.

## Verification and rollback

1. Verify `/api/health`, `/v1/health`, `/v1/health/db`, the admin sign-in,
   an authorised `/v1` request, and an unauthorised request over HTTPS.
2. Check API and notification journals for errors without logging personal or
   identity data.
3. If the `/v1` proxy fails, remove only its Nginx location and reload after
   `nginx -t`; Express `/api` remains available. Do not roll back database
   migrations unless their migration-specific rollback procedure says it is safe.
4. Exercise member registration and resumption, staff check-in and scoped lookup,
   and admin review with test identities. Confirm no duplicate write is sent to
   both backends and no private evidence appears in logs or public storage.
5. Capture the error rate, request latency, failed background-job count and
   database connection count before cutover and during the pilot. Assign an
   operator to inspect them and to record the rollback decision and time.

## Open release decisions

Gate G1 and the one-month pilot use the separate
[evidence procedure](../requirements/gate-g1.md). The local validator checks
record completeness but does not approve a release or enable feature flags.

This runbook is a candidate, not evidence of deployment. Before activation,
record the approved host and domain, admin origin, storage and key ownership,
backup/restore owner, notification delivery credentials, mobile internal-test
track, pilot area, and sign-off record. The Phase 1 blocker register also
requires separate finance, staff, governance and card decisions. Until those
are approved, their production feature flags stay off.
