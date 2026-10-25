# content module

Gallery, official content and its signing, fact-checks, the livelihood guide and official alerts.

**Status: gallery built (Batch 17, `gallery/`); official content, fact-checks, the guide and alerts not built yet.** The live Express API still serves the PWA's sample gallery.

- `gallery/rules.py`: album states, submission checks, the two-person publish rule, removal decisions and the 24-hour clock.
- `gallery/images.py`: decoding and re-encoding uploads as WebP without metadata; blurring.
- `gallery/media_store.py`: the WebP files in `MEDIA_STORAGE_DIR`.
- `gallery/repository.py`, `service.py`, `router.py`, `schemas.py`, `dependencies.py`: `/v1/content` (Alembic `0015`).

BRD v1.1: FR-GAL-001 to 007, FR-AUT-001 to 009, FR-LIV-001 to 006, FR-ADM-005, 006, 009, 013; `/v1/content`, `/v1/factcheck`, `/v1/guide`; MOD-01 to MOD-06.
