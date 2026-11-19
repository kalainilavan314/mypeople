# content module

Gallery, official content and its signing, fact-checks, the livelihood guide and official alerts.

**Status: gallery built (Batch 17, `gallery/`); the livelihood guide built (Phase 3, `guide/`, behind `livelihood_guide`); official content and alerts not built yet (fact-checks live in `community/factchecks`).** The live Express API still serves the PWA's sample gallery.

- `gallery/rules.py`: album states, submission checks, the two-person publish rule, removal decisions and the 24-hour clock. Publishing is refused during an election silence window for the album's area (`election` module, NFR-ELC-03).
- `gallery/images.py`: decoding and re-encoding uploads as WebP without metadata; blurring.
- `gallery/media_store.py`: the WebP files in `MEDIA_STORAGE_DIR`.
- `gallery/repository.py`, `service.py`, `router.py`, `schemas.py`, `dependencies.py`: `/v1/content` (Alembic `0015`).
- `guide/rules.py`: categories, what an entry needs before review (source link, both languages, dates), the eligibility disclaimer and the check that no wording says a person qualifies (FR-LIV-004), expiry.
- `guide/repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/guide` (Alembic `0049`): search, entry detail, reports of outdated entries, and for editors (`guide.edit`) and reviewers (`guide.review`) drafts, second-person review, re-check, withdrawal and the report queue.

BRD v1.1: FR-GAL-001 to 007, FR-AUT-001 to 009, FR-LIV-001 to 006, FR-ADM-005, 006, 009, 013; `/v1/content`, `/v1/factcheck`, `/v1/guide`; MOD-01 to MOD-06.
