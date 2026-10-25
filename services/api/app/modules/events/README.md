# events module

Events, RSVP, passes, attendance, town halls and appointments.

**Status: events built (Batch 16); town halls and appointments not built yet.** The live Express API (`server/`) still serves the PWA's events under `/api/events`.

- `rules.py`: event types, the check-in window, state changes, RSVP and waitlist, pass eligibility, scan results, SMS notices.
- `repository.py`: SQL for `events.event`, `events.rsvp`, `events.rsvp_change` and `events.attendance` (Alembic `0014`).
- `service.py`, `router.py`, `schemas.py`: `/v1/events` for members, the event console and check-in.

BRD v1.1: FR-EVT-001 to 018, FR-THL-001 to 009, FR-APT-001 to 007, FR-ADM-001, 002, 004, FR-STF-006; `/v1/events`, `/v1/townhalls`, `/v1/appointments`.
