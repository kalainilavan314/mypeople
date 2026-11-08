# privacy module

Data-subject requests (P06): a copy of one's personal data, or closing the account, each with a receipt and a statutory due date, and the DPO's register.

**Status: privacy requests built (Batch 18); M1.6 governance foundation in progress.** Alembic 0024 adds immutable policy versions and consent events. The database rejects mismatched policy actions, future-effective policies and delegated consent. Pure rules distinguish notice acknowledgement from optional consent. No policy-publishing, consent-write or analytics routes are exposed by this foundation. Assembling the copy of the data, anonymising closed accounts after 30 days, and correction and objection requests are not built yet.

GOV-01's group-size 10 is a proposal. Before publishing analytics, approve the threshold, add query-level differencing protection, apply suppression to every API/chart/CSV, and test filtered exports. D35 policy publishing needs DPO/legal approval and an access/audit design; M05/S04 assisted verification needs OD-04 approval. Election content restrictions remain subject to the election policy decision. M44 accessibility and low-bandwidth controls are still pending.

- `rules.py`: the due date (21 working days, unverified), what closing keeps and for how long.
- `repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/privacy` (Alembic `0016`: `privacy.request`).

BRD v1.1: FR-PROF-018, 019, BR-079, NFR-PRV; the DPO holds `privacy.requests.handle` (an assumption: the BRD names no permission).
