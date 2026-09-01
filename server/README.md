# NPM — backend foundation

Postgres 16 schema for the membership app. This is the **data foundation**; the API service
(Fastify/Express/PostgREST — TBD) is not built yet. The frontend runs today against the mock
adapter (`app/src/data/mock`) and will swap to a real HTTP client implementing the same
`ApiClient` interface (`app/src/data/api.ts`) with no screen changes.

## Run the schema

```bash
createdb npm_app
psql npm_app -f migrations/0001_init.sql
```

## Implementation notes (from PROJECT.md)

- **Tier is derived, not authored.** Recompute a member's tier from `point_ledger` (+ check-in
  count) on write and cache it on `members.tier`. Never let clients set it directly.
- **Offline-first idempotency.** Field reports arrive with a client-generated `client_uuid`.
  The write endpoint must **upsert on `reports.client_uuid`** (`on conflict (client_uuid) do nothing`
  / `do update`) so a replayed offline queue can never duplicate a report. Apply the same pattern
  to `event_rsvps` (PK `event_id, member_id`) and `survey_responses` (unique `question_id, member_id`).
- **Check-in QR** encodes `member_code` + a rotating `qr_nonce`. The nonce is **single-use per
  event** — enforced by `event_checkins.qr_nonce unique`. Reject reused nonces.
- **Privacy / RLS.** `survey_responses` and `reports` are readable only by the owner and the
  assigned ward coordinator. Enforce with Postgres row-level security keyed on `ward_id`.
  `nic_hash` is encrypted at rest and must **never** leave the server (no API field exposes it).
- **Bilingual columns** are `*_ta` / `*_en`; the client picks by `members.language` and falls
  back to Tamil.

## Suggested next steps

1. Seed reference data (`electorates`, `wards`, `badges`, `skills`, `courses`) — mirror
   `app/src/data/mock/seed.ts`.
2. Stand up the API service implementing `ApiClient` (see `app/src/data/api.ts`).
3. Add RLS policies + a `recompute_tier(member_id)` function/trigger.
4. Wire real SMS OTP and the NIC verification review queue.
