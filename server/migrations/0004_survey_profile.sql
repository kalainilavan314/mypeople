-- ============================================================================
-- 0004_survey_profile.sql
--
-- 1) Sign-up no longer collects a mobile number or an OTP — identity is the NIC.
--    `phone` therefore becomes NULLABLE. The UNIQUE index stays: Postgres allows
--    many NULLs in a unique index, so members without a phone don't collide, and
--    anyone who does supply one is still deduped.
-- 2) DS division is now asked explicitly during sign-up (district -> DS -> GS),
--    so store it on the member rather than only deriving it from the GS division.
-- 3) The joining survey (alcohol / betel / marital status / blood group) is stored
--    in the existing npm.onboarding_answer key-value table; a view pivots it into
--    one readable row per member.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1) phone optional -----------------------------------------------------------
ALTER TABLE npm.member ALTER COLUMN phone DROP NOT NULL;

-- 2) DS division --------------------------------------------------------------
ALTER TABLE npm.member ADD COLUMN IF NOT EXISTS ds_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_ds_code_fkey'
  ) THEN
    ALTER TABLE npm.member
      ADD CONSTRAINT member_ds_code_fkey
      FOREIGN KEY (ds_code) REFERENCES geo.ds_division(ds_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS member_ds_idx ON npm.member(ds_code);

-- Backfill ds_code for existing members from their GS division.
UPDATE npm.member m
   SET ds_code = g.ds_code
  FROM geo.gn_division g
 WHERE g.gn_code = m.gs_code
   AND m.ds_code IS NULL;

-- 3) Joining-survey view ------------------------------------------------------
-- Question ids written by the sign-up flow:
--   alcohol      -> 'yes' | 'no'
--   betel        -> 'yes' | 'no'
--   marital      -> 'married' | 'single'
--   blood_group  -> 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-'
CREATE OR REPLACE VIEW npm.member_survey AS
SELECT
  m.id                                        AS member_id,
  m.member_code,
  m.full_name,
  d.name_en                                   AS district,
  ds.name_en                                  AS ds_division,
  g.name_en                                   AS gs_division,
  MAX(a.answer) FILTER (WHERE a.question_id = 'alcohol')     AS alcohol,
  MAX(a.answer) FILTER (WHERE a.question_id = 'betel')       AS betel,
  MAX(a.answer) FILTER (WHERE a.question_id = 'marital')     AS marital_status,
  MAX(a.answer) FILTER (WHERE a.question_id = 'blood_group') AS blood_group,
  m.created_at
FROM npm.member m
LEFT JOIN npm.onboarding_answer a ON a.member_id = m.id
LEFT JOIN geo.district    d  ON d.district_code = m.district_code
LEFT JOIN geo.ds_division ds ON ds.ds_code      = COALESCE(m.ds_code, (SELECT ds_code FROM geo.gn_division WHERE gn_code = m.gs_code))
LEFT JOIN geo.gn_division g  ON g.gn_code       = m.gs_code
WHERE m.deleted_at IS NULL
GROUP BY m.id, m.member_code, m.full_name, d.name_en, ds.name_en, g.name_en, m.created_at;
