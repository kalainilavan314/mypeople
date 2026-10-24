# Current deployed UI

Live URL: https://178.128.126.35.nip.io

Release `civic-20261024T165759Z` was deployed on 24 October 2026 (17:00 UTC) and verified over public HTTPS. Its source commit is `67678d7` on `main` (not yet pushed to GitHub). Compared with the previous release (`0f841b1`) it ships the collaborator's UI fixes (Home greeting and GN line removed, instant language switching, Toggle proportions, font-token cleanup, phone-frame border) and the Express dependency security patch: express 4.22.3, body-parser 1.20.9, proxy-addr 2.0.8 and qs 6.16.1, clearing four npm audit advisories (one critical). The FastAPI service in `services/api` is not part of this release. No database migrations were required. See `artifacts/civic-20261024T165759Z-live.json` for the public verification record.

Server: `/srv/secure/app/mypeople/current` points to `releases/civic-20261024T165759Z`. Rollback link: `/srv/secure/app/mypeople/previous-civic-20261024T165759Z` points to `releases/civic-20261012T060314Z`. An encrypted off-server backup and restic integrity check (39 snapshots, no errors) completed at 16:59 UTC, before activation. All 608 packaged files and the uploaded archive passed SHA-256 verification. Staging ran `npm ci` for `server/` and confirmed the patched versions, then the preflight on port 3002 passed (health, database writes, release marker, gallery, hero images, font, service worker). Production environment configuration and the uploads symlink were preserved. Public verification: health and database writes OK, 8 checked assets byte-identical to the local build, all 5 gallery albums served.

## How to deploy

The release package includes changed app/server source and a built `app/dist`, with SHA-256 checksums. It excludes credentials, uploaded member data and node_modules.

1. Run local QA, then `npm run build --prefix app`.
2. `python deployment/package_release.py` (from the repository root) writes `artifacts/<release>.tar.gz` and its manifest, and stamps `build-marker.txt`.
3. Load the `deploy` key into an SSH agent yourself (the passphrase is never given to scripts or assistants).
4. `python deployment/deploy_release.py <release>` starts the encrypted backup, uploads the package and the stage/activate scripts, verifies the checksum, stages on port 3002, waits for the backup to succeed and activates. It authenticates through the Windows OpenSSH agent. With a Git Bash agent instead, run the same steps with `ssh`/`scp`.
5. `python deployment/verify_public_release.py <release>` checks the public site and writes the `-live.json` record.

`stage-ui-release.sh` copies the previous release, overlays the package and runs `npm ci --omit=dev --ignore-scripts` in `server/`, so lockfile changes reach production. `activate-ui-release.sh` switches the `current` link, restarts `mypeople.service` and rolls back automatically if the health check or release marker fails. The older server `deploy.sh` resets to `origin/main`; use the release-package workflow instead.

## Open security items

- **Sign-in throttle bypass (found 24 October 2026).** The site's Nginx block (`/etc/nginx/sites-available/default`) sets `X-Forwarded-For $proxy_add_x_forwarded_for`, which keeps a client-supplied header and appends the real address. Express `clientIp()` reads the first entry, so a client can choose the address the sign-in and OTP limits count against. Fix: `app.set('trust proxy', 'loopback')` with `req.ip` in Express, and `proxy_set_header X-Forwarded-For $remote_addr;` in Nginx.
- Express listens on all interfaces (`*:3001`). UFW blocks the port externally; binding to `127.0.0.1` would add a second layer.
- The `karan-server-admin` key and its passphrase were exposed in a chat on 24 October 2026 and should be replaced.

Visual specification and image/font provenance: `docs/home-design.md`, `docs/assets/community-hero.md` and `app/public/member/ATTRIBUTION.json`. Approved gallery photos can replace the current sample collection via `server/src/gallery-albums.json` without changing the client.
