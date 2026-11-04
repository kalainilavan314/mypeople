# FastAPI background-job units

These are installable templates, not evidence of a live deployment. Copy the
required unit files to `/etc/systemd/system/` on an approved Linux host, review
the paths, service account, and storage permissions, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mypeople-api.service
sudo systemctl enable --now mypeople-notifications.timer
sudo systemctl status mypeople-api.service
sudo systemctl status mypeople-notifications.timer
sudo systemctl list-timers mypeople-notifications.timer
```

The API environment file is host-only. It must contain the normal FastAPI
runtime configuration and must not be added to Git.
