# content module

Gallery, official content and its signing, fact-checks, the livelihood guide and official alerts.

**Status: gallery built (Batch 17, `gallery/`); official content and its signing built (Phase 3, `official/`, behind `official_content`); the guide and alerts not built yet.** Fact-checks live in `community/factchecks`. The live Express API still serves the PWA's sample gallery.
**Status: gallery built (Batch 17, `gallery/`); the livelihood guide built (Phase 3, `guide/`, behind `livelihood_guide`); official content and alerts not built yet (fact-checks live in `community/factchecks`).** The live Express API still serves the PWA's sample gallery.

- `gallery/rules.py`: album states, submission checks, the two-person publish rule, removal decisions and the 24-hour clock. Publishing is refused during an election silence window for the album's area (`election` module, NFR-ELC-03).
- `gallery/images.py`: decoding and re-encoding uploads as WebP without metadata; blurring.
- `gallery/media_store.py`: the WebP files in `MEDIA_STORAGE_DIR`.
- `gallery/repository.py`, `service.py`, `router.py`, `schemas.py`, `dependencies.py`: `/v1/content` (Alembic `0015`).
- `official/` (D30, M47, M48 check part; FR-AUT-001 to 005, BR-148, BR-150, INT-22, INT-24; Alembic `0050`): Tier 5
  (system.configure) registers approved publishers, who must hold `content.sign_publish` (PRM-57) and never register
  themselves. A registered publisher signs each statement and its image (by SHA-256) with Ed25519 and publishes it with
  a public check code (`TMK-XXXX-XXXX`). Corrections are new signed revisions with their reason; revisions and keys
  cannot be changed (triggers). Every signature is checked again when shown, so only verifying content is "signed"
  (the "Official statement" label). `GET /v1/content/official/check?code=` and `/keys` and published images need no
  session (INT-22); checks are limited per address in memory (`check_limiter.py`). Publishing and corrections are
  refused while any election silence window is in force (NFR-ELC-03); withdrawal stays possible.
  - `signing.py`: the Signer interface. [ASSUMPTION] INT-24: its only implementation reads the key from
    `CONTENT_SIGNING_KEY` (a 32-byte Ed25519 seed, base64) until a KMS is chosen; without it publishing answers 503
    `signing_unavailable`. Each key's public half is recorded at first use, so older statements verify after rotation.
- `guide/rules.py`: categories, what an entry needs before review (source link, both languages, dates), the eligibility disclaimer and the check that no wording says a person qualifies (FR-LIV-004), expiry.
- `guide/repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/guide` (Alembic `0049`): search, entry detail, reports of outdated entries, and for editors (`guide.edit`) and reviewers (`guide.review`) drafts, second-person review, re-check, withdrawal and the report queue.

BRD v1.1: FR-GAL-001 to 007, FR-AUT-001 to 009, FR-LIV-001 to 006, FR-ADM-005, 006, 009, 013; `/v1/content`, `/v1/factcheck`, `/v1/guide`; MOD-01 to MOD-06.
