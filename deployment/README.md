# Current deployed UI

Live URL: https://178.128.126.35.nip.io

Release `civic-20261024T170606Z` was deployed on 24 October 2026 (17:07 UTC) and verified over public HTTPS. Its source commit is `e1dd46a` on `main` (not yet pushed to GitHub). It closes the sign-in throttle bypass: Express trusts only the local proxy (`trust proxy` = `loopback`) and `clientIp()` uses `req.ip`, so a forged `X-Forwarded-For` no longer chooses the address the sign-in and OTP limits count against. Verified on production: a failed sign-in sent with a forged `X-Forwarded-For` was recorded against the caller's real public address (the test row was then deleted). See `artifacts/civic-20261024T170606Z-live.json`.

It follows `civic-20261024T165759Z` (from `67678d7`, deployed the same day at 17:00 UTC), which shipped the collaborator's UI fixes (Home greeting and GN line removed, instant language switching, Toggle proportions, font-token cleanup, phone-frame border) and the Express dependency security patch: express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8 and qs 6.16.1, clearing four npm audit advisories (one critical). The FastAPI service in `services/api` is not part of either release. No database migrations were required.

Server: `/srv/secure/app/mypeople/current` points to `releases/civic-20261024T170606Z`. Rollback link: `/srv/secure/app/mypeople/previous-civic-20261024T170606Z` points to `releases/civic-20261024T165759Z`. Encrypted off-server backups with restic integrity checks completed before each activation (16:59 and 17:07 UTC). Packaged files and uploaded archives passed SHA-256 verification. Staging ran `npm ci` for `server/` and confirmed the patched versions, then the preflight on port 3002 passed (health, database writes, release marker, gallery, hero images, font, service worker). Production environment configuration and the uploads symlink were preserved. Public verification: health and database writes OK, 8 checked assets byte-identical to the local build, all 5 gallery albums served.

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
- Before the FastAPI identity endpoints go live: create `EVIDENCE_STORAGE_DIR` on `/srv/secure` (owned by the API's service user, mode 700), generate `EVIDENCE_ENCRYPTION_KEY` on the server, add the directory to the restic backup and keep a copy of the key apart from it. Without the key the backed-up images cannot be read.
- The `karan-server-admin` key and its passphrase were exposed in a chat on 24 October 2026 and should be replaced.

Visual specification and image/font provenance: `docs/home-design.md`, `docs/assets/community-hero.md` and `app/public/member/ATTRIBUTION.json`. Approved gallery photos can replace the current sample collection via `server/src/gallery-albums.json` without changing the client.
