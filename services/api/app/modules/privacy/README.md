# privacy module

Data-subject requests (P06): a copy of one's personal data, or closing the account, each with a receipt and a statutory due date, and the DPO's register.

**Status: built (Batch 18).** Assembling the copy of the data, anonymising closed accounts after 30 days, and correction and objection requests are not built yet.

- `rules.py`: the due date (21 working days, unverified), what closing keeps and for how long.
- `repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/privacy` (Alembic `0016`: `privacy.request`).

BRD v1.1: FR-PROF-018, 019, BR-079, NFR-PRV; the DPO holds `privacy.requests.handle` (an assumption: the BRD names no permission).
