// Tier engine. Ascending: volunteer -> diamond (GS) -> gold (DS) -> platinum (district).
//   diamond  : recruit >= 20% of your GS division population, max 2 per GS division
//   gold     : recruit >= 500, max 3 per DS division
//   platinum : recruit >= 1000, max 5 per district
import { pool } from './db.js';

const GOLD_NEED = 500;
const PLATINUM_NEED = 1000;
const DIAMOND_FALLBACK = 300; // used when a GS division has no population figure

async function gsPopulation(client, gsCode) {
  if (!gsCode) return null;
  try {
    const r = await client.query(
      `SELECT value FROM stats.gn_indicator
       WHERE gn_code=$1 AND indicator_code='pop_total'
       ORDER BY value DESC NULLS LAST LIMIT 1`,
      [gsCode],
    );
    const v = r.rows[0]?.value;
    return v != null ? Number(v) : null;
  } catch {
    return null; // stats table shape differs / absent — fall back
  }
}

function diamondNeed(gsPop) {
  return gsPop ? Math.max(1, Math.ceil(0.2 * gsPop)) : DIAMOND_FALLBACK;
}

/** Count how many members already hold a tier within the member's admin scope. */
async function seatTaken(client, tier, m) {
  if (tier === 'diamond') {
    const r = await client.query(
      `SELECT count(*)::int n FROM npm.member WHERE tier='diamond' AND gs_code=$1 AND id<>$2 AND deleted_at IS NULL`,
      [m.gs_code, m.id],
    );
    return r.rows[0].n;
  }
  if (tier === 'gold') {
    const r = await client.query(
      `SELECT count(*)::int n FROM npm.member mm
       JOIN geo.gn_division g ON g.gn_code = mm.gs_code
       WHERE mm.tier='gold' AND g.ds_code = (SELECT ds_code FROM geo.gn_division WHERE gn_code=$1)
         AND mm.id<>$2 AND mm.deleted_at IS NULL`,
      [m.gs_code, m.id],
    );
    return r.rows[0].n;
  }
  // platinum
  const r = await client.query(
    `SELECT count(*)::int n FROM npm.member WHERE tier='platinum' AND district_code=$1 AND id<>$2 AND deleted_at IS NULL`,
    [m.district_code, m.id],
  );
  return r.rows[0].n;
}

const SEAT_LIMIT = { diamond: 2, gold: 3, platinum: 5 };

/** Recompute and persist a member's tier (respecting seat limits). Returns the tier. */
export async function recomputeTier(client, memberId) {
  const m = (await client.query(
    `SELECT id, recruit_count, gs_code, district_code, tier FROM npm.member WHERE id=$1`,
    [memberId],
  )).rows[0];
  if (!m) return null;

  const need = diamondNeed(await gsPopulation(client, m.gs_code));
  // Highest tier the recruit count qualifies for.
  let eligible = 'volunteer';
  if (m.recruit_count >= PLATINUM_NEED) eligible = 'platinum';
  else if (m.recruit_count >= GOLD_NEED) eligible = 'gold';
  else if (m.recruit_count >= need) eligible = 'diamond';

  // Walk down from the eligible tier to the first with a free seat (or one already held).
  const order = ['platinum', 'gold', 'diamond', 'volunteer'];
  let assigned = 'volunteer';
  for (let i = order.indexOf(eligible); i < order.length; i++) {
    const t = order[i];
    if (t === 'volunteer') { assigned = 'volunteer'; break; }
    if (m.tier === t) { assigned = t; break; } // already holds it — keep the seat
    if (await seatTaken(client, t, m) < SEAT_LIMIT[t]) { assigned = t; break; }
  }
  if (assigned !== m.tier) {
    await client.query(`UPDATE npm.member SET tier=$1 WHERE id=$2`, [assigned, m.id]);
  }
  return assigned;
}

/** Progress toward the next tier (by recruit count) — for the card's progress bar. */
export async function tierProgress(member) {
  const gsPop = await gsPopulation(pool, member.gs_code);
  const steps = [
    { tier: 'diamond', need: diamondNeed(gsPop) },
    { tier: 'gold', need: GOLD_NEED },
    { tier: 'platinum', need: PLATINUM_NEED },
  ];
  const have = member.recruit_count || 0;
  const next = steps.find((s) => have < s.need) || null;
  return {
    have,
    next: next ? next.tier : null,
    need: next ? next.need : null,
    pct: next ? Math.min(100, Math.round((100 * have) / next.need)) : 100,
    diamondNeed: steps[0].need,
  };
}
