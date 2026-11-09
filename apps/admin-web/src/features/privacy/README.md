# Privacy requests register (D35)

BRD v1.1 D35; requirements FR-PROF-018, 019, BR-079; permission `privacy.requests.handle` (the DPO, an explicit Tier 5 grant).

**Status: Built** (data-subject request register), on `/v1/privacy/requests`.

- `/privacy`: the register, soonest due first, filtered by status; member ID only, never identity documents; each open request is marked by how far it is from its statutory due date, with an alert when any is overdue.
- `/privacy/[id]`: the request, the member's note, what closing an account keeps; complete or refuse it with a note the member sees. The API has no single-request read for staff, so the page finds the request in the register (the first 500 open, then the first 500 closed).

Policy approvals and consent statistics have no API yet (`docs/requirements/post-launch-placeholders.md`).
