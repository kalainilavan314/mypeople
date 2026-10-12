# Current deployed UI

Live URL: https://178.128.126.35.nip.io

Release `civic-20261012T045612Z` was deployed on 12 October 2026 (Asia/Colombo) and verified over public HTTPS. Its source commit is `834cccf` on `codex/feature-first`. Home follows the latest compact MedTech reference with an illustrative community image. Existing feature routes, the restored detailed membership card and authentication UI are retained. Local QA passed 10 responsive Home layouts, 34 civic checks, membership QR/viewer/PDF checks, login and 10 feature routes. See `artifacts/civic-20261012T045612Z-live.json` for public asset and health verification.

Server: `/srv/secure/app/mypeople/current` points to `releases/civic-20261012T045612Z`. Rollback link: `/srv/secure/app/mypeople/previous-civic-20261012T045612Z` points to `releases/civic-20261011T091132Z`. A fresh encrypted backup completed successfully before activation. All 599 packaged files passed SHA-256 verification and staging checks. No database migrations were required. Production environment configuration and the uploads symlink were preserved. The stage overlays the previous release, retaining older source and hashed assets for compatibility; active HTML and service worker assets match the new build.

The release package includes changed app/server source and a built `app/dist`, with SHA-256 checksums. It excludes credentials, uploaded member data, and node_modules. Packaging/staging/activation/public-verification scripts are stored here. Future deployments should complete local QA/build, create a package, verify its upload checksum, stage on port 3002, then activate the release and verify public HTTPS assets.

Post-deployment browser checks passed for 10 English/Tamil Home layouts, search and the Card QR entry. These rendering checks use fixture member data with service workers blocked so Playwright can intercept the API consistently. A separate fresh-browser check verified actual production Welcome/Login redirects, the Login form and Card authentication guard without submitting credentials. Public health, gallery images, service worker and the new community image passed their HTTP/checksum checks.

This deployment packages the local working tree. The source branch is pushed and draft pull request https://github.com/kalainilavan314/northunity/pull/2 is open for default-branch review. The older server `deploy.sh` resets to `origin/main`, which still contains the previous code. Use the release-package workflow until that pull request is merged.

Visual specification and image/font provenance: `docs/home-design.md`, `docs/assets/community-hero.md` and `app/public/member/ATTRIBUTION.json`. Approved gallery photos can replace the current sample collection via `server/src/gallery-albums.json` without changing the client.
