# events / offline check-in

Scans a staff phone queues without a connection, judged by the server when it reconnects (MP-DEC-001 4.3 to 4.5, FR-STF-005). Nothing the phone decided is final.

- `POST /v1/events/scanner-devices`: binds the phone (its own id and a random secret; only the secret's SHA-256 is stored in `staff_ops.registered_device`). Needs `events.checkin_scan`.
- `POST /v1/events/{id}/checkin/offline`: a batch of up to 200 queued scans. Each is judged as at the time the phone recorded it: the pass code's own signature and 60-second expiry, the member's Going answer, this event and its check-in window. Outcomes: `ACCEPTED` (attendance recorded with the phone's time), `DUPLICATE`, `REJECTED` with the reason, or waiting for a person: `NEEDS_REVIEW` (the phone's clock more than 5 minutes ahead) and `EXPIRED_QUEUE` (older than the 72-hour window, STF-01 proposed). The same scan sent again returns its first outcome (idempotency key).
- `GET /v1/events/{id}/checkin/exceptions` and `POST /v1/events/checkin/exceptions/{scanId}/decision`: an event manager (`events.manage`), never the scanner, accepts or rejects a waiting scan with a reason; accepting still needs a genuine pass at the recorded time.

The HMAC signing secret never reaches a device (MP-DEC-001 4.4), so a phone can only queue, never verify. Only the opaque pass code is kept, never a name, photo or NIC. Uses Alembic 0023's `staff_ops` tables; the rules come from `engagement/staff_operations_rules.py`.
