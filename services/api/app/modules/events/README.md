# events module

Events, RSVP, passes, attendance, town halls and appointments.

**Status: events built (Batch 16), with manual check-in by member ID (FR-VOI-007) and silence-period checks on publishing (Batch 20); appointments built (Phase 3, `appointments/`, behind `representatives`); town halls live in `community/townhalls`.** The live Express API (`server/`) still serves the PWA's events under `/api/events`.

- `rules.py`: event types, the check-in window, state changes, RSVP and waitlist, pass eligibility, scan and manual check-in results, SMS notices.
- `repository.py`: SQL for `events.event`, `events.rsvp`, `events.rsvp_change` and `events.attendance` (Alembic `0014`).
- `service.py`, `router.py`, `schemas.py`: `/v1/events` for members, the event console and check-in.
- `appointments/rules.py`: slot series and overlaps, booking checks, contact preference, case link only with consent, follow-up and reminder times.
- `appointments/repository.py`, `service.py`, `router.py`, `schemas.py`: `/v1/appointments` (Alembic `0049`): the representatives' directory and profiles with approved contacts only, booking, cancelling and moving, the representative's own calendar (PRM-56) and the profiles and slots managed for the areas (`appointment.profile.manage`). Reminders run in the notifications task; bookings are deleted two years after the meeting by the cleanup task.

BRD v1.1: FR-EVT-001 to 018, FR-THL-001 to 009, FR-APT-001 to 007, FR-ADM-001, 002, 004, FR-STF-006; `/v1/events`, `/v1/townhalls`, `/v1/appointments`.
