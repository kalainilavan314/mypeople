// The new API's session registry (services/api, identity.session), honoured here too.
//
// Tokens signed by the new API name their session row (`sid`). A member can end
// one session there, and a session unused for 30 days expires. Without this
// check the same cookie kept working against /api after the session was ended
// (security review, 25 October 2026). Tokens this API signs name no session and
// are governed by session_version alone, as before.
const IDLE_LIMIT = '30 days'; // FR-AUTH-025, the same as services/api
const TOUCH_INTERVAL = '5 minutes'; // how often last use is written, to spare the database

/**
 * True when the token's session may still be used. `db` is anything with pg's
 * query(); the session's last use is recorded at most every five minutes.
 */
export async function sessionIsLive(db, payload) {
  if (payload?.sid == null) return true;
  try {
    const r = await db.query(
      `SELECT last_seen_at < now() - $3::interval AS stale
         FROM identity.session
        WHERE id = $1 AND member_id = $2 AND revoked_at IS NULL
          AND last_seen_at >= now() - $4::interval`,
      [payload.sid, payload.sub, TOUCH_INTERVAL, IDLE_LIMIT],
    );
    if (r.rowCount === 0) return false;
    if (r.rows[0].stale) {
      await db.query('UPDATE identity.session SET last_seen_at = clock_timestamp() WHERE id = $1', [payload.sid]);
    }
    return true;
  } catch {
    // A malformed id, or a database without the registry: a token naming a
    // session that cannot be found is refused, never waved through.
    return false;
  }
}
