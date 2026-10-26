# Background tasks

Jobs that run outside a request.

**Status: the notification dispatcher is built (`notifications.py`, Batch 19), as a plain command a systemd timer runs every minute.** Celery and Redis are not part of the project; they are added only when a job needs them. Still to come: deleting identity images when their retention ends, SLA timers, privileged-access review deadlines, the 10-working-day appeal target, event reminders, anonymising closed accounts.

```
python -m app.tasks.notifications
```

BRD v1.1: §13.4 retention (OD-03), FR-IDV-015, FR-WEB-028, FR-AUTH-027, FR-IDV-013, FR-REG-021, FR-ADM-006; NFR-PERF-11.
