-- Make logout actually end the session.
--
-- Sessions are stateless JWTs, so POST /api/auth/logout could only clear the
-- cookie. The token itself stayed valid for its full 30-day life: replaying a
-- captured token after logout still returned 200 from /api/me. On a shared
-- phone or after a device is lost, "log out" hid the session rather than
-- ending it.
--
-- A counter on the member is the smallest thing that fixes it. The token
-- carries the value it was signed with; verification compares the two and
-- rejects anything older. Incrementing the counter invalidates every token
-- issued before that moment, which is exactly what logout, a password change
-- and an administrative lock-out all need.
--
-- A revocation TABLE was the alternative. It would allow revoking one session
-- while leaving others alive, but it needs a row per issued token, a cleanup
-- job, and a lookup on every authenticated request. This costs one integer on
-- a row already being fetched to authenticate.

ALTER TABLE npm.member
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN npm.member.session_version IS
  'Incremented to invalidate every session token issued before now (logout, password change, lock-out).';
