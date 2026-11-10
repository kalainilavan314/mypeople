# events / offline check-in

Scans a staff phone queues without a connection, judged by the server when it reconnects (MP-DEC-001 4.3 to 4.5, FR-STF-005). Nothing the phone decided is final.

- Phones are registered, listed and revoked through `/v1/operations/devices` (the `operations` module): the server issues the phone's id and a one-time token and keeps only the token's SHA-256. Needs `events.checkin_scan`.
- `POST /v1/events/{id}/checkin/offline`: a batch of up to 200 queued scans. Each is judged as at the time the phone recorded it: the pass code's own signature and 60-second expiry, the member's Going answer, this event and its check-in window. Outcomes: `ACCEPTED` (attendance recorded with the phone's time), `DUPLICATE`, `REJECTED` with the reason, or waiting for a person: `NEEDS_REVIEW` (the phone's clock more than 5 minutes ahead) and `EXPIRED_QUEUE` (older than the approved replay window). The same scan sent again returns its first outcome (idempotency key).
- `GET /v1/events/{id}/checkin/exceptions` and `POST /v1/events/checkin/exceptions/{scanId}/decision`: an event manager (`events.manage`), never the scanner, accepts or rejects a waiting scan with a reason; accepting still needs a genuine pass at the recorded time.

The HMAC signing secret never reaches a device (MP-DEC-001 4.4), so a phone can only queue, never verify. Only the opaque pass code is kept, never a name, photo or NIC. Uses Alembic 0023's `staff_ops` tables. Offline check-in stays off (`409 offline_attendance_not_approved`, the phone keeps its scans) until the replay window is recorded from the current approved STF-01 revision (`/v1/operations/controls`); the clock and replay checks are `operations/rules.py`'s `queued_scan_problem`.
