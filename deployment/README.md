# Current deployed UI

Live URL: https://178.128.126.35.nip.io

Release `civic-20261025T165334Z` was deployed on 25 October 2026 (17:01 UTC) and verified over public HTTPS at 17:02 UTC. Its source commit is `3a40251` on `main` (not yet pushed to GitHub). It carries:

- the QA audit fixes to the PWA (`ffcdaa8`): one membership status on every screen (Express now sends `membershipStatus`, which is `pending` for everyone until the new API's membership table exists), a provisional card with no QR unless identity is confirmed and membership Active (the server refuses `/api/me/card-token` with `403 card_not_available`; today that is every member), the three verification steps kept separate, no double-tap zoom and no field under 16px on touch screens, the bottom bar stepping aside while typing, a report form with no preselected category or priority and without the location and photo controls that did nothing, wrapping event filters with useful empty states, the gallery note for members, GN division wording and a card icon on the Card tab;
- the Express security fixes from Batches 15b and 15c: tokens naming an ended or idle session of the new API are refused, sign-in attempts are counted before the password check under a lock shared with the new API, sign-out works only with a token that still works, and the public code endpoints accept only `signup`, `login` and `reset`, with per-phone limits counted per purpose.

The FastAPI service (including Batch 16, events) is not part of this release, and no database migrations were required. Verified on production: `/api/auth/request-otp` with another API's purpose answers `invalid_purpose`, and the service log shows no unexpected errors.

Server: `/srv/secure/app/mypeople/current` points to `releases/civic-20261025T165334Z`. Rollback link: `/srv/secure/app/mypeople/previous-civic-20261025T165334Z` points to `releases/civic-20261025T120042Z`. The encrypted off-server backup and its restic integrity check (43 snapshots, no errors) completed at 16:59 UTC, before activation. The uploaded archive matched the package's SHA-256 (`3a792dd8…3484`, 615 files). Staging ran `npm ci` for `server/` and the preflight on port 3002 passed. Production environment configuration and the uploads symlink were preserved. Public verification: health and database writes OK, 8 checked assets byte-identical to the local build, all 5 gallery albums served. See `artifacts/civic-20261025T165334Z-live.json` (kept locally).

Earlier releases: `civic-20261025T120042Z` (from `fdc85e8`, 25 October 12:09 UTC) patched the PWA's dependencies (DOMPurify 3.4.17 and others). `civic-20261024T170606Z` (from `e1dd46a`, 24 October 17:07 UTC) closed the sign-in throttle bypass: Express trusts only the local proxy (`trust proxy` = `loopback`) and `clientIp()` uses `req.ip`, verified on production with a forged `X-Forwarded-For`. `civic-20261024T165759Z` (from `67678d7`, 17:00 UTC) shipped the collaborator's UI fixes and the Express dependency patch (express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8, qs 6.16.1; four advisories, one critical).

Nginx: the My People block (`/etc/nginx/sites-available/default`) now sets `proxy_set_header X-Forwarded-For $remote_addr;` (was `$proxy_add_x_forwarded_for`), changed 24 October 2026 at 17:05 UTC after `nginx -t`. The previous file is kept as `/etc/nginx/sites-available/default.bak-20261024T170517Z` (not loaded by Nginx).

## How to deploy

The release package includes changed app/server source and a built `app/dist`, with SHA-256 checksums. It excludes credentials, uploaded member data and node_modules.

1. Run local QA, then `npm run build --prefix app`.
2. `python deployment/package_release.py` (from the repository root) writes `artifacts/<release>.tar.gz` and its manifest, and stamps `build-marker.txt`.
3. Load the `deploy` key into an SSH agent yourself (the passphrase is never given to scripts or assistants).
4. `python deployment/deploy_release.py <release>` starts the encrypted backup, uploads the package and the stage/activate scripts, verifies the checksum, stages on port 3002, waits for the backup to succeed and activates. It authenticates through the Windows OpenSSH agent. With a Git Bash agent instead, run the same steps with `ssh`/`scp`.
5. `python deployment/verify_public_release.py <release>` checks the public site and writes the `-live.json` record.

`stage-ui-release.sh` copies the previous release, overlays the package and runs `npm ci --omit=dev --ignore-scripts` in `server/`, so lockfile changes reach production. `activate-ui-release.sh` switches the `current` link, restarts `mypeople.service` and rolls back automatically if the health check or release marker fails. The older server `deploy.sh` resets to `origin/main`; use the release-package workflow instead.

The Nginx site in front of the app is kept as a reference copy in `nginx/my-people.conf` (see `nginx/README.md`).

Production does not run on Docker, so there is no production `docker-compose.yml`; one waits on the hosting decision (OD-20). `docker-compose.dev.yml` gives a local PostgreSQL 17 (and the FastAPI image with `--profile api`) for development; `environments/` and `monitoring/` describe what exists today.

## Open security items

- Fixed 24 October 2026: the sign-in throttle bypass through a forged `X-Forwarded-For` (Express used the client-controlled first entry while Nginx kept client headers). Both the Express fix and the Nginx change are live; `npm test --prefix server` covers it.
- Express listens on all interfaces (`*:3001`). UFW blocks the port externally; binding to `127.0.0.1` would add a second layer.
- Before the FastAPI gallery goes live: create `MEDIA_STORAGE_DIR` on `/srv/secure` (owned by the API's service user) and add it to the restic backup.
- Before the FastAPI identity endpoints go live: create `EVIDENCE_STORAGE_DIR` on `/srv/secure` (owned by the API's service user, mode 700), generate `EVIDENCE_ENCRYPTION_KEY` on the server, add the directory to the restic backup and keep a copy of the key apart from it. Without the key the backed-up images cannot be read.
- The `karan-server-admin` key and its passphrase were exposed in a chat on 24 October 2026 and should be replaced.

Visual specification and image/font provenance: `docs/home-design.md`, `docs/assets/community-hero.md` and `app/public/member/ATTRIBUTION.json`. Approved gallery photos can replace the current sample collection via `server/src/gallery-albums.json` without changing the client.
