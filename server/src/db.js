import 'dotenv/config';
import pg from 'pg';

/**
 * Pool config shared by the API and the migration runner.
 *
 * Managed Postgres (Supabase, Neon, RDS) requires TLS; a local server normally
 * has none, and forcing it there just breaks development. So TLS is switched on
 * for every non-local host and left off for localhost.
 *
 * Certificates are verified by default. PGSSL_INSECURE=true turns verification
 * off for providers that terminate TLS with a self-signed chain — it still
 * encrypts, but it stops authenticating the server, so use it only if the
 * connection genuinely fails without it. This database holds NIC hashes.
 */
export function poolConfig(overrides = {}) {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return {
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 10),
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: process.env.PGSSL_INSECURE !== 'true' } }),
    ...overrides,
  };
}

export const pool = new pg.Pool(poolConfig());

// Fetch a member (by id, phone, or nic_hash) joined with GS/DS/district names.
// DS prefers the division the member explicitly chose at sign-up (m.ds_code) and
// falls back to the one implied by their GS division.
const SELECT = `
  SELECT m.*, g.name_en AS gs_name, ds.name_en AS ds_name, d.name_en AS district_name
  FROM npm.member m
  LEFT JOIN geo.gn_division g ON g.gn_code = m.gs_code
  LEFT JOIN geo.ds_division ds ON ds.ds_code = COALESCE(m.ds_code, g.ds_code)
  LEFT JOIN geo.district d ON d.district_code = m.district_code
`;

export async function memberById(id) {
  const r = await pool.query(`${SELECT} WHERE m.id = $1 AND m.deleted_at IS NULL`, [id]);
  return r.rows[0] || null;
}
export async function memberByNicHash(hash) {
  const r = await pool.query(`${SELECT} WHERE m.nic_hash = $1 AND m.deleted_at IS NULL`, [hash]);
  return r.rows[0] || null;
}
export async function memberByPhone(phone) {
  const r = await pool.query(`${SELECT} WHERE m.phone = $1 AND m.deleted_at IS NULL`, [phone]);
  return r.rows[0] || null;
}
