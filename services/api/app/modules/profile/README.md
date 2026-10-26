# profile module

The member's own profile (P01 to P04, P06): what is recorded, the locked legal details, display name and gender, My Activity, the optional survey answers and the identity-data notice; and `area_changes/`, requests to move to another GN division with proof of residence, reviewed in the requested area.

**Status: built (Batch 18).** Changing verified legal details through a new review (FR-PROF-008) is not built yet.

- `rules.py`: locked fields, the masked number, verification validity, area-change checks, the identity-data notice.
- `repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/profile` (Alembic `0016`: `profile.display_name`).
- `area_changes/`: `/v1/profile/area-changes` (`profile.area_change`); proof kept in the identity evidence vault.

BRD v1.1: FR-PROF-001 to 006, 009, 010, 017, BR-073 to BR-076. The password change (FR-PROF-014) lives with recovery in `identity/recovery`; data-subject requests in `privacy`.
