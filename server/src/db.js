import 'dotenv/config';
import pg from 'pg';
import { SUPABASE_ROOT_CA } from './supabase-ca.js';

/**
 * TLS settings for the database connection.
 *
 * Supabase terminates TLS with its own private CA ("Supabase Root 2021 CA"),
 * not a publicly trusted root, so verifying against the system trust store
 * always fails with SELF_SIGNED_CERT_IN_CHAIN. The answer is to trust that one
 * CA explicitly, which keeps full verification (chain AND hostname) rather than
 * turning it off.
 *
 * The certificate is a static import, not an fs read: serverless bundlers trace
 * imports and would ship a function without a file loaded at runtime.
 *
 * PGSSL_CA overrides it with an inline PEM, for a different provider.
 * PGSSL_INSECURE=true disables verification entirely — a last resort: it still
 * encrypts, but stops authenticating the server, and this database holds NIC
 * hashes.
 */
function sslConfig() {
  if (process.env.PGSSL_INSECURE === 'true') return { rejectUnauthorized: false };
  return { ca: process.env.PGSSL_CA || SUPABASE_ROOT_CA, rejectUnauthorized: true };
}

/**
 * Drop sslmode/ssl from the URL's query string.
 *
 * pg builds its config as Object.assign({}, config, parse(connectionString)) —
 * values parsed out of the URL WIN over ones passed alongside it. So a URL
 * ending in ?sslmode=require silently replaces the ssl object above (CA and
 * all) with a bare { rejectUnauthorized: true }, and the connection then fails
 * against Supabase's private CA. Removing the parameter lets sslConfig() stand.
 */
function stripSslParams(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    return u.toString();
  } catch {
    return url; // not parseable — hand it to pg unchanged and let it complain
  }
}

/**
 * Pool config shared by the API and the migration runner. TLS is used for every
 * non-local host and skipped for localhost, where a dev server normally has none.
 */
export function poolConfig(overrides = {}) {
  const url = process.env.DATABASE_URL || '';
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return {
    connectionString: isLocal ? url : stripSslParams(url),
    max: Number(process.env.PG_POOL_MAX || 10),
    ...(isLocal ? {} : { ssl: sslConfig() }),
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
