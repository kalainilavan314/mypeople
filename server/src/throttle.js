// Rate limiting for authentication, backed by the database.
//
// In-memory counters were the obvious alternative and are wrong here: the API
// runs as several instances (serverless functions today), so a per-process
// counter limits each instance separately and is bypassed by spreading requests
// across them. It also resets on deploy, which clears every lockout.
//
// Limits are layered rather than single, because each layer stops a different
// abuse. A per-phone cooldown stops one number being flooded; a per-IP limit
// stops one attacker walking through many numbers; a daily cap stops slow,
// patient abuse that never trips either.
import { pool } from './db.js';

/** Client address, honouring a reverse proxy but never trusting it blindly. */
export function clientIp(req) {
  // Only the FIRST hop in x-forwarded-for is meaningful, and only when the app
  // sits behind a proxy we control (nginx, Vercel). A client can append entries,
  // so later ones are attacker-controlled and must not be used.
  const fwd = req.headers['x-forwarded-for'];
  const first = typeof fwd === 'string' ? fwd.split(',')[0].trim() : null;
  return first || req.socket?.remoteAddress || 'unknown';
}

/* ------------------------------------------------------------------ OTP */

/**
 * Layered limits on requesting a one-time code.
 *
 *   per phone   1 / minute, 5 / hour, 10 / day
 *   per IP      10 / 10 minutes
 *
 * Returns { ok: true } or { ok: false, retryAfter, reason }. retryAfter is
 * seconds, for a Retry-After header.
 */
export async function checkOtpRequest(phone, ip) {
  const r = await pool.query(
    `SELECT
       count(*) FILTER (WHERE phone = $1 AND created_at > now() - interval '1 minute')  AS phone_minute,
       count(*) FILTER (WHERE phone = $1 AND created_at > now() - interval '1 hour')    AS phone_hour,
       count(*) FILTER (WHERE phone = $1 AND created_at > now() - interval '1 day')     AS phone_day,
       count(*) FILTER (WHERE ip    = $2 AND created_at > now() - interval '10 minutes') AS ip_window
     FROM npm.otp
     WHERE created_at > now() - interval '1 day'`,
    [phone, ip],
  );
  const c = r.rows[0];

  if (Number(c.phone_minute) >= 1) return { ok: false, retryAfter: 60, reason: 'cooldown' };
  if (Number(c.phone_hour) >= 5) return { ok: false, retryAfter: 3600, reason: 'hourly_limit' };
  if (Number(c.phone_day) >= 10) return { ok: false, retryAfter: 86400, reason: 'daily_limit' };
  if (Number(c.ip_window) >= 10) return { ok: false, retryAfter: 600, reason: 'ip_limit' };
  return { ok: true };
}

/**
 * Issue a code, invalidating any code still outstanding for the same phone and
 * purpose. Without this, every code ever sent stays valid until it expires, so
 * requesting ten codes gives an attacker ten simultaneous guesses.
 */
export async function issueOtp({ phone, code, purpose, ip, ttlMinutes = 5 }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE npm.otp SET consumed = true
       WHERE phone = $1 AND purpose = $2 AND consumed = false`,
      [phone, purpose],
    );
    await client.query(
      `INSERT INTO npm.otp (phone, code, purpose, ip, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
      [phone, code, purpose, ip, String(ttlMinutes)],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Consume a code. Counts wrong guesses against the code itself and burns it
 * after MAX_ATTEMPTS, so a 6-digit code cannot be brute-forced within its life.
 *
 * Returns { ok } or { ok: false, reason: 'invalid' | 'too_many_attempts' }.
 */
const MAX_ATTEMPTS = 5;

export async function consumeOtp({ phone, code, purpose }) {
  const live = await pool.query(
    `SELECT id, code, attempts FROM npm.otp
     WHERE phone = $1 AND purpose = $2 AND consumed = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose],
  );
  const row = live.rows[0];
  if (!row) return { ok: false, reason: 'invalid' };

  if (row.attempts >= MAX_ATTEMPTS) {
    await pool.query(`UPDATE npm.otp SET consumed = true WHERE id = $1`, [row.id]);
    return { ok: false, reason: 'too_many_attempts' };
  }

  if (String(row.code) !== String(code)) {
    const upd = await pool.query(
      `UPDATE npm.otp SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
      [row.id],
    );
    if (upd.rows[0].attempts >= MAX_ATTEMPTS) {
      await pool.query(`UPDATE npm.otp SET consumed = true WHERE id = $1`, [row.id]);
    }
    return { ok: false, reason: 'invalid' };
  }

  // Single use.
  const consumed = await pool.query(
    `UPDATE npm.otp SET consumed = true WHERE id = $1 AND consumed = false RETURNING id`,
    [row.id],
  );
  if (!consumed.rows[0]) return { ok: false, reason: 'invalid' }; // lost a race
  return { ok: true };
}

/* ---------------------------------------------------------------- login */

const SOFT_FAILURES = 5;   // slow down
const HARD_FAILURES = 10;  // refuse for a while
const WINDOW = '15 minutes';
const LOCKOUT_SECONDS = 900;

/**
 * Throttle by account AND address together, never by address alone: members in
 * a government office, an internet cafe or behind a carrier NAT share one
 * public IP, and locking that IP would lock the whole building out of their own
 * accounts. Requiring both means one person's wrong password cannot deny
 * service to their colleagues.
 *
 * Returns { ok: true, delayMs } or { ok: false, retryAfter }.
 */
export async function checkLogin(identifier, ip) {
  const r = await pool.query(
    `SELECT count(*)::int AS failures
     FROM npm.auth_attempt
     WHERE identifier = $1 AND ip = $2 AND succeeded = false
       AND created_at > now() - interval '${WINDOW}'`,
    [identifier, ip],
  );
  const failures = r.rows[0].failures;

  if (failures >= HARD_FAILURES) return { ok: false, retryAfter: LOCKOUT_SECONDS, failures };
  if (failures >= SOFT_FAILURES) {
    // Progressive delay: cheap for a person who mistyped, expensive for a script.
    return { ok: true, delayMs: Math.min(2000, (failures - SOFT_FAILURES + 1) * 400), failures };
  }
  return { ok: true, delayMs: 0, failures };
}

export async function recordLogin(identifier, ip, succeeded) {
  await pool.query(
    `INSERT INTO npm.auth_attempt (identifier, ip, succeeded) VALUES ($1, $2, $3)`,
    [identifier, ip, !!succeeded],
  );
  if (succeeded) {
    // A correct password clears the slate, so a member who eventually remembers
    // it is not still throttled afterwards.
    await pool.query(
      `DELETE FROM npm.auth_attempt
       WHERE identifier = $1 AND ip = $2 AND succeeded = false`,
      [identifier, ip],
    );
  }
}

export const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
