# System overview

My People (என் மக்கள்) is the Tamil-first membership and community platform of the Northern Province People's Movement. The requirements are the BRD v1.1 (MP-BRD-001, see `docs/requirements/README.md`); its technical architecture is §15A.

## What runs today

```text
Member's browser (PWA, app/)
        │ HTTPS 443
        ▼
Nginx on the DigitalOcean server (TLS; X-Forwarded-For = $remote_addr)
        │ http://127.0.0.1:3001
        ▼
Express API, server/  (/api/*, also serves app/dist)  ── systemd mypeople.service
        │
        ▼
PostgreSQL 16 (schemas npm, geo) on the encrypted /srv/secure volume
```

Daily encrypted off-server backups run with restic (`karan-backup.service`); every release takes one first. Releases are described in `deployment/README.md`.

## What is being built

The BRD's target, and the folders that hold it:

| Part | Technology | Folder | Status |
|---|---|---|---|
| Member app (Android, iOS) | React Native, Expo SDK 58, Expo Router | `apps/member-mobile` | Member screens on `/v1`: sign-in, registration, verification, Home, Events, Card, Gallery, Profile (Batch 21) |
| Staff app | Separate Expo app, same shared packages (OD-26 pending) | `apps/staff-mobile` | Staff core on `/v1`: second factor, tasks, check-in, roster, approvals, alerts, member look-up (Batch 23) |
| Admin dashboard | Next.js 16, Tailwind CSS 4 | `apps/admin-web` | Verification, appeals, duplicates, membership, roles and audit on `/v1` (Batch 22); live at https://admin.tmk.lk since 12 Nov 2026 |
| API | FastAPI modular monolith, SQLAlchemy 2, Alembic | `services/api` | Live on the production server at `/v1` since 10 Nov 2026; v1.1 modules off until Gate G1 |
| Background jobs | systemd timer commands (no Redis/Celery) | `services/api/app/tasks` | Notification dispatcher built; install with the FastAPI go-live runbook |
| AI inference | Private worker, no internet egress | `services/ai-worker` | Planned (Phase 3) |
| Shared code | Design tokens, i18n, typed API client, mobile components | `packages/*` | Built and tested |

## Moving from Express to FastAPI

The Express API is replaced one group of endpoints at a time ("strangler" migration), against the same database:

1. FastAPI serves `/v1/...`; Express keeps `/api/...` until each group has moved.
2. Both APIs share the session: the same `mp_session` cookie, `JWT_SECRET` and `NIC_PEPPER`, and the same `npm.auth_attempt` throttle rows. A member signed in through either API is signed in to both, and signing out of either ends both.
3. Each endpoint group has exactly one owner at a time, so the two APIs never write the same rows with different rules.
4. Schema changes after the baseline are Alembic revisions only (`docs/database/database-guide.md`).
5. When an app no longer calls an `/api` route, that route is removed from Express. When none remain, `server/` and `app/` are retired.

Moved so far: health checks, sign-in, sign-out, session checks and the member's own profile. New in FastAPI only: staff access and the audit log (`docs/api/api-reference.md`).

## Backend modules

Each module in `services/api/app/modules/` has a thin `router.py` (HTTP, permissions), `service.py` (rules), `repository.py` (SQL) and `schemas.py` (request and response models). The BRD's module list (§15A.7) is identity, membership, access, community, assistance, household, events, engagement, finance, content, messaging, ai and admin. Built: `auth` (sessions, sign-in, throttling), `membership` (own profile), `access` (staff assignments, permission and area checks, RB-01 to RB-07) and `audit` (append-only, hash-chained log).

## Principles from the BRD (§15A.1)

- **Server-side authority:** every permission, scope and purpose check runs in the API; apps only hide controls.
- **Purpose separation:** identity, assistance, household and finance data live apart, with no cross-purpose joins.
- **AI is advisory:** people decide identity, assistance, moderation and fact-checks.
- **Offline-tolerant, not offline-sensitive:** identity files, contributions and case data never queue offline.
- **Modular monolith first:** one deployable API with clear module boundaries.
- **Tamil-first parity:** Tamil and English ship together.
- **Auditable by default.**

## Decisions still open

These BRD open decisions affect the next batches: OD-26 (one app or two), OD-01 and OD-02 (who verifies identity and activates membership), OD-03 (document retention), OD-28 (biometric processing), OD-42 (AI provider and hosting) and OD-20 (hosting location). See BRD §22.

## Related documents

- `docs/architecture/member-pwa.md`: structure of the live PWA
- `docs/development/setup.md`: running everything locally
- `docs/security/security-rules.md`: security rules and their status
