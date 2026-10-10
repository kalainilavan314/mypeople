# Current deployed UI

Live URL: https://178.128.126.35.nip.io

Release `civic-20261010T080157Z` was deployed on 10 October 2026 and verified over public HTTPS. The home UI follows the supplied NorthUnity Flutter project; all existing feature routes and the original authentication UI are retained. Local QA passed 34 mobile/behavior checks and 8 additional reference-UI checks. See `artifacts/civic-20261010T080157Z-live.json` for public verification.

Server: `/srv/secure/app/mypeople/current` points to `releases/civic-20261010T080157Z`. Rollback link: `/srv/secure/app/mypeople/previous-civic-20261010T080157Z` points to the previous release. A fresh encrypted backup completed successfully before activation. No database migrations were required. Production environment configuration and the uploads symlink were preserved.

The release package includes changed app/server source and a built `app/dist`, with SHA-256 checksums. It excludes credentials, uploaded member data, and node_modules. Packaging/staging/activation/public-verification scripts are stored here. Future deployments should complete local QA/build, create a package, verify its upload checksum, stage on port 3002, then activate the release and verify public HTTPS assets.

This deployment packages the local working tree; it does not push Git commits. The older server `deploy.sh` resets to `origin/main`. Reconcile these changes with that branch before using that older deployment path, or continue the release-package workflow.

Visual specification and image/font provenance: `design/northunity-ui-specification.md` and `app/public/member/ATTRIBUTION.json`. Approved gallery photos can replace the current sample collection via `server/src/gallery-albums.json` without changing the client.
