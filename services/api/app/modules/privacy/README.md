# privacy module

Data-subject requests (P06): a copy of one's personal data, or closing the account, each with a receipt and a statutory due date, and the DPO's register.

**Status: privacy requests built (Batch 18); P2 governance operations implemented.** Alembic 0024 adds immutable policy versions and consent events; Alembic 0030 adds approval references, immutable machine controls and separate Tier 5 certification evidence. `/v1/operations` publishes approved policy versions, lets members acknowledge notices or grant/withdraw optional consent, records policy-version-bound evidence and exposes privacy-safe volunteer aggregates. The database still rejects mismatched actions, future-effective policies and delegated consent. Assembling the copy of the data, anonymising closed accounts after 30 days, and correction and objection requests remain separate work.

GOV-01's group-size 10 remains a proposal until an exact value is recorded from the current approved decision revision. Aggregate routes fail closed without it and apply primary plus secondary suppression at the API query boundary; suppressed totals are not returned. Policy publication requires `system.configure`, an external approval reference, explicit immutable-publication confirmation and an audit entry. Election rules additionally require GOV-02 approval. M05/S04 assisted verification still needs OD-04 approval. M44 accessibility and low-bandwidth controls remain pending.

- `rules.py`: the due date (21 working days, unverified), what closing keeps and for how long.
- `repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/privacy` (Alembic `0016`: `privacy.request`).

BRD v1.1: FR-PROF-018, 019, BR-079, NFR-PRV; the DPO holds `privacy.requests.handle` (an assumption: the BRD names no permission).
