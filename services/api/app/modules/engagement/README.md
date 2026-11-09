# engagement module

Participatory-budgeting cycles and ballots, committees, volunteering, field visits and blood donors.

**Status: M1.5 staff-operation schema and provisional rules in progress.** Alembic 0023 adds volunteer assignments and immutable history, registered staff-device records, and a scan-event inbox. Offline check-in is built in `events/offline` (device registration, batch sync judged at the recorded time, a review queue for managers) and in the staff app's scanner. No volunteer-assignment routes are exposed yet (S10 waits for H10 to H12). The 72-hour replay window is a sandbox proposal, pending STF-01 approval.

Before enabling offline attendance: approve device binding and public-key verification or treat every queued scan as provisional; implement encrypted on-device queueing, authenticated idempotent batch sync, server QR and membership revalidation, a conflict queue and manual review. Never distribute the HMAC signing secret to devices. S10 also needs the member accept/decline flow, scoped staff permissions and API audit events.

BRD v1.1: FR-PBG-001 to 010, FR-COM-001 to 009, FR-VOL-001 to 008, FR-FLD-001 to 009, FR-BLD-001 to 008; `/v1/pb`, `/v1/committees`, `/v1/field`, `/v1/donors`.
