# Notification and messaging composer (GAP-05, D09)

BRD v1.1 §11.13, §15A.6; screen D09; requirements FR-MSG-007, FR-ADM-007, BR-083, BR-145.

**Status: Built.**

Broadcast messaging composer:
- Staff broadcast authoring with audience visibly scoped to the staff member's assigned geography and optional effective staff authorization tiers
- Immediate reach estimates that use the same predicate as preview and final delivery
- Validation enforcing prohibition of National Identity Card (NIC) numbers, passport numbers, and sensitive personal details
- Broadcast preview showing estimated member reach and automated rule verification
- Two-tier workflow: scope wider than a district requires second-person approval by Tier 4 or 5 staff
- Two-step explicit dispatch confirmation preventing accidental transmission or double-sends
- Scheduled and immediate transmission workflows with full backend audit trail
- Paginated operational list across draft, approval, scheduled, sent, and cancelled states

## Audience-tier meaning

“Tier” in D09 means an effective `access.staff_assignment` authorization tier (`1`, `2A`, `2B`, `3A`, `3B`, `4`, `5`) in the selected geography. It never means the removed referral ranks and must never be presented as a member score, status or ranking. “All active members” is the default audience.

Reach is recalculated on preview, submit, approval and dispatch so a stale browser estimate cannot determine delivery. Audience tier, area, estimated reach, lifecycle decisions and final recipient count are recorded in the audit trail.

## Dispatch Worker Requirement

Broadcasts marked "Send immediately" or scheduled for a specific time are transitioned to `scheduled` state with `send_at`. Actual delivery fan-out is executed by the background notifications worker (`python -m app.tasks.notifications`).

In local development, run:
```bash
python -m app.tasks.notifications
```
or run a polling loop. In production, run via the systemd timer `mypeople-notifications.timer` every minute (see `services/api/app/tasks/README.md`).
