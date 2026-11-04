# Background tasks

Jobs that run outside a request.

**Status: the notification dispatcher is built (`notifications.py`, Batch 19), as a plain command a systemd timer runs every minute.** `cleanup.py` removes expired or terminal role-assignment previews daily. Celery and Redis are not part of the project; they are added only when a job needs them. Still to come: deleting identity images when their retention ends, SLA timers, privileged-access review deadlines, the 10-working-day appeal target, event reminders, anonymising closed accounts.

### 1. Local Development Dispatch Runner

When testing staff broadcasts or gallery escalations locally, run:

```bash
# Single execution:
python -m app.tasks.notifications
```

To run a continuous polling worker in development (e.g. checking every 10 seconds):

**PowerShell**:
```powershell
while ($true) { python -m app.tasks.notifications; Start-Sleep -Seconds 10 }
```

**Bash**:
```bash
while true; do python -m app.tasks.notifications; sleep 10; done
```

### 2. Production Deployment (Systemd Timer)

In production Linux hosts, configure a systemd service and timer to trigger `app.tasks.notifications` every minute:

**`/etc/systemd/system/mypeople-notifications.service`**:
```ini
[Unit]
Description=My People Notification & Escalation Dispatcher
After=network.target postgresql.service

[Service]
Type=oneshot
User=mypeople
WorkingDirectory=/srv/mypeople/services/api
EnvironmentFile=/srv/mypeople/services/api/.env
ExecStart=/srv/mypeople/services/api/.venv/bin/python -m app.tasks.notifications
StandardOutput=journal
StandardError=journal
```

**`/etc/systemd/system/mypeople-notifications.timer`**:
```ini
[Unit]
Description=Run My People notifications worker every minute

[Timer]
OnCalendar=*:0/1:00
AccuracySec=5s
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start it after adding both units:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mypeople-notifications.timer
```

### Assignment-preview cleanup

Run the same container/image command once per day. Expired previews are rejected by every read, confirm, and cancel request even if this timer is delayed; the timer only removes stale records.

```ini
# /etc/systemd/system/mypeople-preview-cleanup.service
[Service]
Type=oneshot
User=mypeople
WorkingDirectory=/srv/mypeople/services/api
EnvironmentFile=/srv/mypeople/services/api/.env
ExecStart=/srv/mypeople/services/api/.venv/bin/python -m app.tasks.cleanup
```

```ini
# /etc/systemd/system/mypeople-preview-cleanup.timer
[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

### 3. Container / Kubernetes CronJob

For Kubernetes deployments:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mypeople-notifications-worker
spec:
  schedule: "* * * * *"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: worker
              image: mypeople-api:latest
              command: ["python", "-m", "app.tasks.notifications"]
              envFrom:
                - secretRef:
                    name: api-secrets
```

BRD v1.1: §13.4 retention (OD-03), FR-IDV-015, FR-WEB-028, FR-AUTH-027, FR-IDV-013, FR-REG-021, FR-ADM-006; NFR-PERF-11.
