# features module

Feature flags for v1.1 modules (BRD FR-ARCH-011, §20.2, D34, PRM-26).

**Status: built (Batch 20).**

Each v1.1 module stays off in production until a Tier 5 holder of `system.configure` records the phase gate it belongs to (G1 for Phase 1 modules, G2 for Phase 2) with the approval behind it, and then turns it on. A module that is off answers `404 feature_unavailable` on every route, so members never see a half-available feature. It can be turned off again at any time. Outside production the flags are not enforced unless `ENFORCE_FEATURE_FLAGS=true`, so development and tests see every module.

- `rules.py`: the registry of v1.1 modules and their phase, the gate and enable checks.
- `repository.py`: SQL for `ops.feature_flag` and the append-only `ops.feature_flag_change` (Alembic `0018`).
- `service.py`, `router.py`, `schemas.py`: `/v1/features` (public list of modules that are on) and the registry, gate, enable and disable endpoints.
- `dependencies.py`: `require_feature("<key>")`, added to a module's router.

Gated today: `identity_appeals` (G1), `duplicate_investigations` (G1), `election_mode` (G2, what members see of elections). A new v1.1 module adds its key to `FEATURES` and gates its router.
