-- Explicit membership verification states + an audit trail.
--
-- Until now signup wrote nic_status='verified' with no identity check of any
-- kind — the server never even validated the NIC *format*. The UI could then
-- imply a member was "verified" when, at best, a client-side format check had
-- passed. This introduces honest, explicit states that a coordinator moves a
-- member through, plus an append-only audit of every change.
--
-- States:
--   unverified          nothing checked
--   nic_format          the NIC matches the expected format (self-service)
--   review_pending      submitted for coordinator identity review
--   identity_confirmed  a coordinator confirmed identity against records
--
-- The legacy nic_status column is left untouched; verification_status is the
-- new authoritative field the app reads.

ALTER TABLE npm.member
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE npm.member DROP CONSTRAINT IF EXISTS member_verification_status_chk;
ALTER TABLE npm.member
  ADD CONSTRAINT member_verification_status_chk
  CHECK (verification_status IN ('unverified', 'nic_format', 'review_pending', 'identity_confirmed'));

-- Backfill: existing members only ever had their NIC format considered (there
-- has never been an identity-review step), so the honest state is 'nic_format',
-- never 'identity_confirmed'. Only rows still at the column default are touched.
UPDATE npm.member
  SET verification_status = 'nic_format'
  WHERE verification_status = 'unverified' AND nic_hash IS NOT NULL;

-- Append-only audit of verification changes: who changed what, when, and why.
CREATE TABLE IF NOT EXISTS npm.verification_audit (
  id          bigserial PRIMARY KEY,
  member_id   uuid        NOT NULL REFERENCES npm.member(id) ON DELETE CASCADE,
  from_status text,
  to_status   text        NOT NULL,
  method      text,
  changed_by  uuid        REFERENCES npm.member(id),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_audit_member_idx
  ON npm.verification_audit (member_id, created_at DESC);

COMMENT ON COLUMN npm.member.verification_status IS
  'unverified | nic_format | review_pending | identity_confirmed. Never claim identity_confirmed without a coordinator review recorded in npm.verification_audit.';
