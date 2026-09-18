-- Integrity constraints and the tables needed to throttle authentication.
--
-- Addresses findings from the September 2026 audit. The theme is that the
-- application was the only thing enforcing rules that the database should be the
-- final authority on.

-- ---------------------------------------------------------------------------
-- One active member per NIC.
--
-- signup did a SELECT on nic_hash and returned 409 if it found a row, which is
-- a check-then-insert race: two concurrent requests both see nothing and both
-- insert, producing two members for one national identity number. In a system
-- where the NIC *is* the identity, that is the most damaging duplicate possible.
--
-- The index is PARTIAL on deleted_at IS NULL, deliberately. Every lookup in
-- db.js already qualifies with "AND deleted_at IS NULL", so the application's
-- notion of "already registered" means an active member. A total unique index
-- would additionally make a soft-deleted member's NIC permanently unusable,
-- which is a different policy than the code currently implements — if that is
-- wanted, it should be a deliberate decision, not a side effect of this fix.
--
-- Fails loudly rather than silently skipping if duplicates already exist.
DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT nic_hash FROM npm.member
    WHERE nic_hash IS NOT NULL AND deleted_at IS NULL
    GROUP BY nic_hash HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique index: % nic_hash value(s) are already used by more than one active member. Resolve them first.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS member_nic_hash_active_key
  ON npm.member (nic_hash)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Bounded text.
--
-- full_name and phone were unbounded text, so a 5000-character name was
-- storable through the API. Limits are generous enough for Tamil and Sinhala
-- names, which take more characters than their English transliterations.
--
-- CHECK constraints rather than varchar(n): the npm.member_survey view selects
-- from these columns, and ALTER COLUMN TYPE against a column a view depends on
-- fails with "cannot alter type of a column used by a view or rule". Dropping
-- and recreating the view inside this migration would work but puts a view
-- definition this migration does not own at risk. A CHECK enforces the same
-- bound, needs no table rewrite, and leaves the view untouched.
ALTER TABLE npm.member
  DROP CONSTRAINT IF EXISTS member_full_name_len_chk,
  DROP CONSTRAINT IF EXISTS member_phone_len_chk;

ALTER TABLE npm.member
  ADD CONSTRAINT member_full_name_len_chk
    CHECK (full_name IS NULL OR char_length(full_name) BETWEEN 1 AND 150),
  ADD CONSTRAINT member_phone_len_chk
    CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 25);

-- A sanity range only. "Not in the future" belongs in the application, because
-- a CHECK constraint cannot reference now() — it must be immutable, and a row
-- valid when written would otherwise become invalid as time passes.
ALTER TABLE npm.member
  DROP CONSTRAINT IF EXISTS member_dob_range_chk;
ALTER TABLE npm.member
  ADD CONSTRAINT member_dob_range_chk
  CHECK (dob IS NULL OR (dob > DATE '1900-01-01' AND dob < DATE '2100-01-01'));

-- ---------------------------------------------------------------------------
-- One-time codes: record the requesting address so requests can be limited per
-- IP as well as per phone number.
ALTER TABLE npm.otp ADD COLUMN IF NOT EXISTS ip text;

CREATE INDEX IF NOT EXISTS otp_ip_idx ON npm.otp (ip, created_at DESC);

-- ---------------------------------------------------------------------------
-- Authentication attempts, for throttling sign-in.
--
-- Stored in the database rather than in process memory on purpose: the API runs
-- as multiple instances (and today as serverless functions), so an in-memory
-- counter would be per-instance and trivially bypassed by spreading attempts
-- across them. It also has to survive a restart, or a restart clears a lockout.
--
-- identifier is a NIC hash, never a NIC. A failed attempt for an account that
-- does not exist is recorded too, so probing cannot be distinguished from a
-- wrong password by timing the response.
CREATE TABLE IF NOT EXISTS npm.auth_attempt (
  id          bigserial PRIMARY KEY,
  identifier  text        NOT NULL,
  ip          text,
  succeeded   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempt_identifier_idx ON npm.auth_attempt (identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_attempt_ip_idx         ON npm.auth_attempt (ip, created_at DESC);

COMMENT ON TABLE npm.auth_attempt IS
  'Sign-in attempts for rate limiting. Prune rows older than 30 days; nothing reads further back than one hour.';
