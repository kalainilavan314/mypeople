// One membership state for every screen. The QA audit of October 2026 found the
// profile saying "status unavailable" while the card said "Pending": this API
// never sent a state, and each screen guessed.
//
// The state lives in membership.membership, owned by services/api (Alembic 0006);
// no row means Pending. On a database the new API has not migrated yet the table
// does not exist and every member is Pending, which is true: nobody can be
// activated without it.
import { pool } from './db.js';

let tablePresent = false; // only a positive answer is kept: the table can appear, never go

async function hasMembershipTable(db) {
  if (!tablePresent) {
    const r = await db.query(`SELECT to_regclass('membership.membership') IS NOT NULL AS present`);
    tablePresent = r.rows[0].present;
  }
  return tablePresent;
}

/** 'pending' | 'active' | 'suspended' | 'inactive'. `db` is anything with pg's query(). */
export async function membershipStatus(memberId, db = pool) {
  if (!(await hasMembershipTable(db))) return 'pending';
  const r = await db.query('SELECT state FROM membership.membership WHERE member_id = $1', [memberId]);
  return r.rows[0]?.state ?? 'pending';
}

/**
 * An official membership card (and its check-in QR) needs a confirmed identity
 * and an Active membership (BRD BR-065, FR-CARD-014). Anyone else sees a card
 * marked provisional, with no QR.
 */
export function cardIsOfficial(verificationStatus, status) {
  return verificationStatus === 'identity_confirmed' && status === 'active';
}
