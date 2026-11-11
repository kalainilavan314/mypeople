# Staging

A copy of the new stack for user acceptance testing and the Gate G1 candidate checks ([gate-g1.md](../../docs/requirements/gate-g1.md)). It runs on the production server beside production but shares nothing with it except the machine: its own PostgreSQL database and login role, its own secrets, files, services, ports and addresses. It holds synthetic data only.

| What | Staging | Production, for comparison |
|---|---|---|
| Member app (web) | https://staging-app.178.128.126.35.nip.io | https://app.178.128.126.35.nip.io |
| Staff app (web) | https://staging-staff.178.128.126.35.nip.io | https://staff.178.128.126.35.nip.io |
| Dashboard | https://staging-admin.178.128.126.35.nip.io | https://admin.178.128.126.35.nip.io |
| API | `mypeople-staging-api.service`, 127.0.0.1:8001, `/srv/secure/app/mypeople-staging-api` | `mypeople-api.service`, 127.0.0.1:8000 |
| Dashboard service | `mypeople-staging-admin.service`, 127.0.0.1:3005, `/srv/secure/app/mypeople-staging-admin` | `mypeople-admin.service`, 127.0.0.1:3003 |
| Web files | `/var/www/mypeople-staging/current/{app,staff}` | `/var/www/mypeople-mobile/current/{app,staff}` |
| Database | `mypeople_staging`, role `mypeople_staging` | `mypeople`, role `mypeople_app` |
| Identity images and gallery files | `/srv/secure/app/mypeople-staging-data/{evidence,media}` | `/srv/secure/app/mypeople-data` |
| Web server | site `mypeople-staging`, snippet `mypeople-staging-v1.conf`, certificate `staging-app.178.128.126.35.nip.io` (all three names) | sites `mypeople-mobile`, `mypeople-admin`, `default` |

## How it differs from production

- `APP_ENV=staging`: feature flags are **not enforced**, so testers can try every v1.1 module that production keeps off until Gate G1. Everything else behaves as in production: secure cookies, the staff second factor, no development SMS or push.
- No SMS provider (INT-01), no push (INT-02) and finance intake off (FIN-01 to FIN-05 and ClamAV), exactly as in production. The [test checklist](../../docs/testing/phase1-uat-checklist.md) marks those cases Blocked.
- No notification timer: notices reach the in-app inbox when they are written; the escalation dispatcher does not run on staging.
- Every page sends `X-Robots-Tag: noindex, nofollow`.

## Test accounts

`scripts/seed_staging.py` (in `services/api`) created twelve synthetic people when staging was set up: four members (registered, verified and waiting for activation, active, and a second active one for households) and eight staff covering every tier in Jaffna district, two of them Tier 3A reviewers so "someone else decides" can be tested. Each staff account holds every permission its tier may hold, apart from the RB-12 rule. Their sign-in details are only in `/srv/secure/app/mypeople-staging-api/shared/uat-accounts.tsv` (mode 0600, owner `app`). The release operator hands them to testers; staff add their own authenticator at their first sign-in. The script refuses any database whose name does not end in `_staging`.

## Setting up, updating and resetting

The scripts in this folder run on the server as `deploy`, each with `REL` (the release name) and `SUM` (the package's sha256) in the environment, the same way as the production release steps in [the deployment README](../README.md):

| Script | Does |
|---|---|
| `setup-api.sh` | Creates the role, database and `.env` (random secrets, generated on the server) if missing; runs the Express migrations and Alembic; installs the release with its own virtualenv; starts the service; seeds the test accounts once |
| `setup-dashboard.sh` with `build-dashboard.sh` | Builds the dashboard on the server in a new release folder, then switches to it and checks the sign-in page |
| `setup-web.sh` with the three `.conf` files | Installs the web builds (`npx expo export --platform web --clear` with `EXPO_PUBLIC_API_URL` set to the staging address), the web-server site and, the first time, the certificate; every reload is checked first and the staging site is removed again if the check fails |

To update staging to a new candidate, run the same scripts with a new release: `setup-api.sh` installs it beside the old one and switches `current`; the database keeps its data. To start again from an empty database:

```
sudo systemctl stop mypeople-staging-api mypeople-staging-admin
sudo -u postgres psql -c "DROP DATABASE mypeople_staging" -c "DROP ROLE mypeople_staging"
sudo rm /srv/secure/app/mypeople-staging-api/shared/.env /srv/secure/app/mypeople-staging-api/shared/uat-accounts.tsv
sudo rm -rf /srv/secure/app/mypeople-staging-data/evidence/* /srv/secure/app/mypeople-staging-data/media/*
```

then run `setup-api.sh` again (and restart `mypeople-staging-admin`). New secrets sign every tester out and make old staging images unreadable, which is what a reset should do.

## Taking staging down

`sudo systemctl disable --now mypeople-staging-api mypeople-staging-admin`, remove `/etc/nginx/sites-enabled/mypeople-staging`, `nginx -t`, reload. Production is not affected by any of these steps.
