# engagement module

Participatory-budgeting cycles and ballots, committees, volunteering, field visits and blood donors.

**Status: P2 operational closure implemented.** Alembic 0023 provides volunteer assignments, immutable history, registered staff devices and the scan inbox. Alembic 0030 adds versioned operational controls. `/v1/operations` exposes area-scoped assignment workflows, member accept/decline and the registered-device lifecycle. Offline check-in sync and the managers' review queue are in `events/offline`, used by the staff app's scanner.

Offline attendance remains fail-closed until an exact replay duration is recorded from the current approved STF-01 revision. Devices receive a one-time opaque credential whose hash is stored server-side; the app keeps the credential and bounded queue in the operating-system secure store. Every scan stays provisional on-device and becomes attendance only after server pass, event, membership, area, replay and duplicate checks. The HMAC signing secret is never distributed to devices. Ambiguous clock events route to review; expired queues are retained as evidence rather than accepted.

BRD v1.1: FR-PBG-001 to 010, FR-COM-001 to 009, FR-VOL-001 to 008, FR-FLD-001 to 009, FR-BLD-001 to 008; `/v1/pb`, `/v1/committees`, `/v1/field`, `/v1/donors`.
