import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool, memberById, memberByNicHash, memberByPhone } from './db.js';
import { nicHash, signToken, verifyToken, otpCode, memberCode, referralCode, publicMember } from './lib.js';
import { recomputeTier, tierProgress } from './tier.js';
import { putObject, getObject, deleteObject, mimeFor, backend as storageBackend } from './storage.js';

const PROD = process.env.NODE_ENV === 'production';

// Closed-pilot gate on registration. Unset (dev) => open; set => must match.
const INVITE_CODE = process.env.SIGNUP_INVITE_CODE || '';
function requireInvite(supplied) {
  if (!INVITE_CODE) return;
  const a = Buffer.from(String(supplied ?? ''));
  const b = Buffer.from(INVITE_CODE);
  // Length-independent compare, then constant-time on equal lengths.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw bad('invalid_invite_code', 403);
}

// On Vercel this module is imported by api/[...path].js and invoked per request
// rather than listening on a port. That platform also caps request bodies at
// 4.5 MB, well under the 8 MB a long-running host accepts, so the upload limits
// below tighten automatically instead of failing with an opaque 413 at the edge.
const SERVERLESS = !!process.env.VERCEL;

// Refuse to run a public deployment on the dev fallbacks in lib.js
// ('dev-secret' / 'dev-pepper'). NIC_PEPPER especially: changing it later
// invalidates every NIC hash already stored, so it has to be right on day one.
//
// SIGNUP_INVITE_CODE is in this list on purpose: signup performs no OTP or
// identity check, so without an invite code a reachable deployment has fully
// open registration. Set it to '' only for a deliberately public launch.
const MISSING_ENV = PROD
  ? ['JWT_SECRET', 'NIC_PEPPER', 'DATABASE_URL', 'SIGNUP_INVITE_CODE'].filter(
      (k) => process.env[k] === undefined || process.env[k] === null,
    )
  : [];

if (MISSING_ENV.length) {
  console.error(`Misconfigured: ${MISSING_ENV.join(', ')} must be set when NODE_ENV=production.`);
}

const app = express();

// A misconfigured deployment answers every request with a description of what
// is wrong, and serves nothing else.
//
// It must NOT exit the process here. On a long-lived host process.exit(1) is a
// clear, loud failure; under a serverless runtime the module is initialised
// inside the request, so exiting surfaces only as FUNCTION_INVOCATION_FAILED
// with no indication of the cause. Variable NAMES are safe to report — the
// response never contains a value — and this only ever appears while broken.
if (MISSING_ENV.length) {
  app.use((_req, res) =>
    res.status(503).json({
      error: 'server_misconfigured',
      missing: MISSING_ENV,
      hint: 'Set these environment variables on the deployment and redeploy.',
    }),
  );
}

// Same-origin by default: the single-service deploy serves the PWA from this
// same process, so no cross-origin access is needed at all. ALLOWED_ORIGINS
// (comma-separated) opens it up only if the frontend is ever hosted separately.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
if (ALLOWED.length) app.use(cors({ origin: ALLOWED, credentials: true }));
else if (!PROD) app.use(cors());

// Donation slip photos arrive as base64 JSON (the client compresses first).
// Base64 inflates bytes by 4/3, so the image ceilings are set well under the
// body limit to leave room for that plus the surrounding JSON.
const BODY_LIMIT = process.env.MAX_BODY || (SERVERLESS ? '4mb' : '8mb');
const MAX_SLIP_BYTES = SERVERLESS ? 2.5 * 1024 * 1024 : 6 * 1024 * 1024;
const MAX_AVATAR_BYTES = SERVERLESS ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
app.use(express.json({ limit: BODY_LIMIT }));

// Decode a data:image base64 payload; returns { buf, ext } or throws 400.
function decodeImage(image, maxBytes = MAX_SLIP_BYTES) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
  if (!match) throw bad('bad_image');
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 1024) throw bad('bad_image');
  if (buf.length > maxBytes) throw bad('image_too_large', 413);
  return { buf, ext: match[1] === 'jpeg' ? 'jpg' : match[1] };
}

// Member view + live tier progress toward the next tier.
async function withProgress(m) {
  return { ...publicMember(m), tierProgress: await tierProgress(m) };
}

const DEV_OTP = process.env.DEV_OTP === 'true';
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.publicMessage || 'server_error' });
});
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status, publicMessage: msg });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'npm-membership', time: new Date().toISOString() }));

// Public deployment switches the frontend needs to know about. Deliberately
// says only WHETHER an invite code is required, never what it is.
app.get('/api/config', (_req, res) => res.json({ inviteRequired: !!INVITE_CODE }));

// --- OTP --------------------------------------------------------------------
app.post('/api/auth/request-otp', wrap(async (req, res) => {
  const { phone, purpose = 'signup' } = req.body || {};
  if (!phone || String(phone).replace(/\D/g, '').length < 9) throw bad('invalid_phone');
  const code = otpCode();
  await pool.query(
    `INSERT INTO npm.otp (phone, code, purpose, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`,
    [phone, code, purpose],
  );
  // No SMS gateway yet: log it, and (dev only) return it so the flow is testable.
  console.log(`[OTP] ${phone} -> ${code} (${purpose})`);
  res.json({ ok: true, ...(DEV_OTP ? { devCode: code } : {}) });
}));

app.post('/api/auth/verify-otp', wrap(async (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) throw bad('missing_fields');
  const r = await pool.query(
    `SELECT id FROM npm.otp WHERE phone=$1 AND code=$2 AND consumed=false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, String(code)],
  );
  if (!r.rows[0]) throw bad('invalid_code', 401);
  await pool.query(`UPDATE npm.otp SET consumed=true WHERE id=$1`, [r.rows[0].id]);
  res.json({ ok: true });
}));

// --- Sign up ----------------------------------------------------------------
app.post('/api/auth/signup', wrap(async (req, res) => {
  const b = req.body || {};
  const { name, nic, phone, password, dob, gender, districtCode, dsCode, gsCode, referralId, answers, language } = b;
  // Identity is the NIC — a mobile number is optional (no SMS/OTP step).
  //
  // Note there is deliberately no OTP check here: /api/auth/request-otp issues a
  // code but nothing consumes it, so possession of a phone number proves nothing.
  // On a reachable deployment the invite code below is therefore the *only* thing
  // standing between the internet and an account created against any NIC number.
  // It is required in production for exactly that reason (see the boot guard).
  requireInvite(b.inviteCode);
  if (!name || !nic || !password) throw bad('missing_fields');
  if (String(password).length < 6) throw bad('weak_password');

  const nh = nicHash(nic);
  if (await memberByNicHash(nh)) throw bad('nic_exists', 409);
  const phoneVal = phone && String(phone).trim() ? String(phone).trim() : null;
  if (phoneVal && await memberByPhone(phoneVal)) throw bad('phone_exists', 409);

  const pwHash = await bcrypt.hash(String(password), 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve referrer (optional).
    let referrerId = null;
    if (referralId && String(referralId).trim()) {
      const rr = await client.query(
        `SELECT id FROM npm.member WHERE referral_code=$1 AND deleted_at IS NULL`,
        [String(referralId).trim().toUpperCase()],
      );
      referrerId = rr.rows[0]?.id || null;
    }

    // Insert member, retrying on the (rare) unique-code collision.
    let member = null;
    for (let attempt = 0; attempt < 6 && !member; attempt++) {
      try {
        const ins = await client.query(
          `INSERT INTO npm.member
             (member_code, full_name, phone, nic_hash, nic_status, password_hash,
              dob, gender, gs_code, ds_code, district_code, referral_code, referred_by, language)
           VALUES ($1,$2,$3,$4,'verified',$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING *`,
          [memberCode(), String(name).trim(), phoneVal, nh, pwHash,
            dob || null, gender || null, gsCode || null, dsCode || null, districtCode || null,
            referralCode(name), referrerId, language || 'en'],
        );
        member = ins.rows[0];
      } catch (e) {
        if (e.code === '23505') continue; // unique_violation on generated code -> retry
        throw e;
      }
    }
    if (!member) throw bad('could_not_allocate_code', 500);

    // Referral: count the recruit exactly once.
    if (referrerId) {
      await client.query(
        `INSERT INTO npm.referral_event (referrer_id, referred_id) VALUES ($1,$2)
         ON CONFLICT (referred_id) DO NOTHING`,
        [referrerId, member.id],
      );
      await client.query(`UPDATE npm.member SET recruit_count = recruit_count + 1 WHERE id=$1`, [referrerId]);
      // Promote the recruiter if they've crossed a tier threshold (respects seat limits).
      await recomputeTier(client, referrerId);
    }

    // Onboarding answers.
    if (answers && typeof answers === 'object') {
      for (const [qid, ans] of Object.entries(answers)) {
        await client.query(
          `INSERT INTO npm.onboarding_answer (member_id, question_id, answer) VALUES ($1,$2,$3)
           ON CONFLICT (member_id, question_id) DO UPDATE SET answer=excluded.answer`,
          [member.id, qid, String(ans)],
        );
      }
    }

    await client.query('COMMIT');
    const full = await memberById(member.id);
    res.json({ ok: true, token: signToken(member.id), member: await withProgress(full) });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// --- Login ------------------------------------------------------------------
app.post('/api/auth/login', wrap(async (req, res) => {
  const { nic, password } = req.body || {};
  if (!nic || !password) throw bad('missing_fields');
  const member = await memberByNicHash(nicHash(nic));
  if (!member) throw bad('invalid_credentials', 401);
  const ok = await bcrypt.compare(String(password), member.password_hash);
  if (!ok) throw bad('invalid_credentials', 401);
  res.json({ ok: true, token: signToken(member.id), member: await withProgress(member) });
}));

// --- Me ---------------------------------------------------------------------
app.get('/api/me', wrap(async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw bad('unauthorized', 401);
  let sub;
  try { sub = verifyToken(token).sub; } catch { throw bad('unauthorized', 401); }
  const member = await memberById(sub);
  if (!member) throw bad('not_found', 404);
  res.json({ member: await withProgress(member) });
}));

// --- Events -----------------------------------------------------------------
function memberIdFromReq(req) {
  const a = req.headers.authorization || '';
  const t = a.startsWith('Bearer ') ? a.slice(7) : null;
  if (!t) return null;
  try { return verifyToken(t).sub; } catch { return null; }
}

const EVENT_SELECT = `
  SELECT e.*,
    (SELECT count(*) FROM npm.event_rsvp r WHERE r.event_id=e.id AND r.status='going')::int AS rsvp_count
  FROM npm.event e`;

function mapEvent(e, ctx = {}) {
  const agenda = Array.isArray(e.agenda)
    ? e.agenda.map((a) => ({ time: a.time || '', labelEn: a.labelEn || a.title || '', labelTa: a.labelTa || a.title || '' }))
    : [];
  return {
    id: e.id,
    titleEn: e.title_en,
    titleTa: e.title_ta || e.title_en,
    venue: e.venue || '',
    lat: e.lat != null ? Number(e.lat) : 0,
    lng: e.lng != null ? Number(e.lng) : 0,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    electorateId: e.district_code,
    agenda,
    rsvpCount: e.rsvp_count || 0,
    isMine: !!(ctx.district && e.district_code === ctx.district),
    myStatus: ctx.myStatus ?? null,
    banner: e.banner || 0,
    category: e.category || null,
  };
}

async function reqContext(req) {
  const memberId = memberIdFromReq(req);
  if (!memberId) return { memberId: null, district: null };
  const m = await memberById(memberId);
  return { memberId, district: m?.district_code || null };
}

app.get('/api/events', wrap(async (req, res) => {
  const ctx = await reqContext(req);
  const r = await pool.query(`${EVENT_SELECT} ORDER BY e.starts_at ASC`);
  res.json({ events: r.rows.map((e) => mapEvent(e, ctx)) });
}));

app.get('/api/events/:id', wrap(async (req, res) => {
  const ctx = await reqContext(req);
  const r = await pool.query(`${EVENT_SELECT} WHERE e.id=$1`, [req.params.id]);
  if (!r.rows[0]) throw bad('not_found', 404);
  let myStatus = null;
  if (ctx.memberId) {
    const s = await pool.query(`SELECT status FROM npm.event_rsvp WHERE event_id=$1 AND member_id=$2`, [req.params.id, ctx.memberId]);
    myStatus = s.rows[0]?.status ?? null;
  }
  res.json({ event: mapEvent(r.rows[0], { ...ctx, myStatus }) });
}));

app.post('/api/events/:id/rsvp', wrap(async (req, res) => {
  const memberId = memberIdFromReq(req);
  if (!memberId) throw bad('unauthorized', 401);
  const { status } = req.body || {};
  if (status === null) {
    await pool.query(`DELETE FROM npm.event_rsvp WHERE event_id=$1 AND member_id=$2`, [req.params.id, memberId]);
  } else {
    if (!['going', 'maybe', 'declined'].includes(status)) throw bad('bad_status');
    await pool.query(
      `INSERT INTO npm.event_rsvp (event_id, member_id, status) VALUES ($1,$2,$3)
       ON CONFLICT (event_id, member_id) DO UPDATE SET status=excluded.status`,
      [req.params.id, memberId, status],
    );
  }
  const m = await memberById(memberId);
  const r = await pool.query(`${EVENT_SELECT} WHERE e.id=$1`, [req.params.id]);
  if (!r.rows[0]) throw bad('not_found', 404);
  res.json({ event: mapEvent(r.rows[0], { memberId, district: m?.district_code, myStatus: status ?? null }) });
}));

// --- Community reports (NorthUnity) ------------------------------------------
const REPORT_CATEGORIES = ['road', 'water', 'waste', 'electricity', 'agriculture', 'environment', 'public_facility', 'other'];
const REPORT_PRIORITIES = ['low', 'medium', 'high'];

function mapReport(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
    districtCode: r.district_code,
    districtName: r.district_name || null,
    priority: r.priority,
    status: r.status,
    createdAt: r.created_at,
  };
}

const REPORT_SELECT = `
  SELECT cr.*, d.name_en AS district_name
  FROM npm.community_report cr
  LEFT JOIN geo.district d ON d.district_code = cr.district_code`;

app.get('/api/reports/mine', wrap(async (req, res) => {
  const memberId = memberIdFromReq(req);
  if (!memberId) throw bad('unauthorized', 401);
  const r = await pool.query(`${REPORT_SELECT} WHERE cr.member_id=$1 ORDER BY cr.created_at DESC`, [memberId]);
  res.json({ reports: r.rows.map(mapReport) });
}));

app.post('/api/reports', wrap(async (req, res) => {
  const memberId = memberIdFromReq(req);
  if (!memberId) throw bad('unauthorized', 401);
  const { category, title, description, districtCode, priority } = req.body || {};
  if (!category || !title || !String(title).trim() || !description || !String(description).trim()) throw bad('missing_fields');
  if (!REPORT_CATEGORIES.includes(category)) throw bad('bad_category');
  if (priority && !REPORT_PRIORITIES.includes(priority)) throw bad('bad_priority');

  // District is optional; when given it must exist (FK) — resolve leniently so a
  // bad code fails as a 400, not a 500.
  let district = null;
  if (districtCode) {
    const d = await pool.query(`SELECT district_code FROM geo.district WHERE district_code=$1`, [districtCode]);
    if (!d.rows[0]) throw bad('bad_district');
    district = d.rows[0].district_code;
  }

  const ins = await pool.query(
    `INSERT INTO npm.community_report (member_id, category, title, description, district_code, priority)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [memberId, category, String(title).trim(), String(description).trim(), district, priority || 'medium'],
  );
  const r = await pool.query(`${REPORT_SELECT} WHERE cr.id=$1`, [ins.rows[0].id]);
  res.json({ ok: true, report: mapReport(r.rows[0]) });
}));

// --- Profile editing ----------------------------------------------------------
// Members update their own details; the NIC (identity) and password stay fixed.
const GENDERS = ['male', 'female', 'other'];

app.patch('/api/me', wrap(async (req, res) => {
  const m = await (async () => {
    const id = memberIdFromReq(req);
    if (!id) throw bad('unauthorized', 401);
    const row = await memberById(id);
    if (!row) throw bad('unauthorized', 401);
    return row;
  })();

  const b = req.body || {};
  const name = b.name !== undefined ? String(b.name).trim() : undefined;
  if (name !== undefined && !name) throw bad('bad_name');
  if (b.gender !== undefined && b.gender !== null && !GENDERS.includes(b.gender)) throw bad('bad_gender');

  // Validate division codes against the real hierarchy (all-or-nothing).
  let districtCode = b.districtCode, dsCode = b.dsCode, gsCode = b.gsCode;
  if (gsCode !== undefined && gsCode !== null) {
    const r = await pool.query(
      `SELECT g.gn_code, g.ds_code, d.district_code
       FROM geo.gn_division g JOIN geo.ds_division d ON d.ds_code = g.ds_code
       WHERE g.gn_code = $1`,
      [gsCode],
    );
    if (!r.rows[0]) throw bad('bad_gs');
    dsCode = r.rows[0].ds_code;
    districtCode = r.rows[0].district_code;
  }

  const phone = b.phone !== undefined ? (String(b.phone).trim() || null) : undefined;
  if (phone) {
    const dup = await pool.query(`SELECT id FROM npm.member WHERE phone=$1 AND id<>$2`, [phone, m.id]);
    if (dup.rows[0]) throw bad('phone_exists', 409);
  }

  const sets = [];
  const vals = [];
  const set = (col, val) => { vals.push(val); sets.push(`${col}=$${vals.length}`); };
  if (name !== undefined) set('full_name', name);
  if (b.dob !== undefined) set('dob', b.dob || null);
  if (b.gender !== undefined) set('gender', b.gender || null);
  if (gsCode !== undefined) { set('gs_code', gsCode); set('ds_code', dsCode ?? null); set('district_code', districtCode ?? null); }
  if (phone !== undefined) set('phone', phone);
  if (b.language !== undefined && ['ta', 'en', 'si'].includes(b.language)) set('language', b.language);
  if (!sets.length) throw bad('nothing_to_update');

  vals.push(m.id);
  await pool.query(`UPDATE npm.member SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals);
  const full = await memberById(m.id);
  res.json({ ok: true, member: await withProgress(full) });
}));

// Profile photo: base64 upload -> file on disk, old file removed.
app.post('/api/me/avatar', wrap(async (req, res) => {
  const id = memberIdFromReq(req);
  if (!id) throw bad('unauthorized', 401);
  const m = await memberById(id);
  if (!m) throw bad('unauthorized', 401);

  const { buf, ext } = decodeImage(req.body?.image, MAX_AVATAR_BYTES);
  const fname = `${crypto.randomUUID()}.${ext}`;
  await putObject('avatars', fname, buf);
  if (m.avatar_path) await deleteObject('avatars', m.avatar_path);
  await pool.query(`UPDATE npm.member SET avatar_path=$1 WHERE id=$2`, [fname, id]);
  const full = await memberById(id);
  res.json({ ok: true, member: await withProgress(full) });
}));

// Avatars load via plain <img> tags (which cannot send a Bearer header), so
// this endpoint is unauthenticated — the member UUID in the URL is unguessable.
app.get('/api/avatars/:memberId', wrap(async (req, res) => {
  const r = await pool.query(`SELECT avatar_path FROM npm.member WHERE id=$1`, [req.params.memberId]);
  const fname = r.rows[0]?.avatar_path;
  if (!fname) throw bad('not_found', 404);
  const buf = await getObject('avatars', fname);
  if (!buf) throw bad('not_found', 404);
  res.set('cache-control', 'private, max-age=31536000, immutable'); // uuid filename = safe to cache
  res.type(mimeFor(fname)).send(buf);
}));

// --- Party Fund (donations) ---------------------------------------------------
// Card path is a SANDBOX of the Sri Lankan IPG experience (amount → card →
// bank OTP → receipt). Only the masked last4 + brand ever reach the server;
// swap `card/start` + `card/confirm` for a real gateway (PayHere / bank IPG)
// in production. Slip path: photo upload → admin verifies the bank account
// and approves → donation appears on the public list.

async function requireMember(req) {
  const memberId = memberIdFromReq(req);
  if (!memberId) throw bad('unauthorized', 401);
  const m = await memberById(memberId);
  if (!m) throw bad('unauthorized', 401);
  return m;
}

async function requireAdmin(req) {
  const m = await requireMember(req);
  if (!m.is_admin) throw bad('forbidden', 403);
  return m;
}

function mapDonation(d, { withDonor = true } = {}) {
  return {
    id: d.id,
    amount: Number(d.amount_lkr),
    method: d.method,
    cardLast4: d.card_last4,
    cardBrand: d.card_brand,
    status: d.status,
    note: d.note,
    createdAt: d.created_at,
    hasSlip: !!d.slip_path,
    ...(withDonor ? { donorName: d.donor_name, districtName: d.district_name ?? null } : {}),
  };
}

const DONATION_SELECT = `
  SELECT dn.*, m.full_name AS donor_name, d.name_en AS district_name
  FROM npm.donation dn
  JOIN npm.member m ON m.id = dn.member_id
  LEFT JOIN geo.district d ON d.district_code = m.district_code`;

const MAX_DONATION = 1000000; // Rs. 1,000,000 sanity cap
const parseAmount = (v) => {
  const n = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(n) || n < 100 || n > MAX_DONATION) throw bad('bad_amount');
  return n;
};

// Public (in-app) donor list: approved donations, newest first, plus totals.
app.get('/api/donations', wrap(async (req, res) => {
  await requireMember(req);
  const r = await pool.query(`${DONATION_SELECT} WHERE dn.status='approved' ORDER BY dn.created_at DESC LIMIT 200`);
  const t = await pool.query(`SELECT coalesce(sum(amount_lkr),0) AS total, count(*)::int AS n FROM npm.donation WHERE status='approved'`);
  res.json({
    total: Number(t.rows[0].total),
    count: t.rows[0].n,
    donations: r.rows.map((d) => mapDonation(d)),
  });
}));

// The signed-in member's own donations (any status) — shows pending slips.
app.get('/api/donations/mine', wrap(async (req, res) => {
  const m = await requireMember(req);
  const r = await pool.query(`${DONATION_SELECT} WHERE dn.member_id=$1 ORDER BY dn.created_at DESC`, [m.id]);
  res.json({ donations: r.rows.map((d) => mapDonation(d)) });
}));

// Card step 1: request the bank OTP (sandbox — logged, and returned when DEV_OTP).
app.post('/api/donations/card/start', wrap(async (req, res) => {
  const m = await requireMember(req);
  const amount = parseAmount(req.body?.amount);
  const code = otpCode();
  await pool.query(
    `INSERT INTO npm.otp (phone, code, purpose, expires_at) VALUES ($1,$2,'donation', now() + interval '10 minutes')`,
    [`don:${m.id}`, code],
  );
  console.log(`[DONATION OTP] ${m.full_name} Rs.${amount} -> ${code}`);
  res.json({ ok: true, ...(DEV_OTP ? { devCode: code } : {}) });
}));

// Card step 2: verify the OTP and record the (sandbox-approved) donation.
app.post('/api/donations/card/confirm', wrap(async (req, res) => {
  const m = await requireMember(req);
  const { code, last4, brand, note } = req.body || {};
  const amount = parseAmount(req.body?.amount);
  if (!code || !/^\d{4}$/.test(String(last4 || ''))) throw bad('missing_fields');
  if (!['visa', 'mastercard'].includes(brand)) throw bad('bad_brand');
  const r = await pool.query(
    `SELECT id FROM npm.otp WHERE phone=$1 AND code=$2 AND purpose='donation' AND consumed=false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [`don:${m.id}`, String(code)],
  );
  if (!r.rows[0]) throw bad('invalid_code', 401);
  await pool.query(`UPDATE npm.otp SET consumed=true WHERE id=$1`, [r.rows[0].id]);
  const ins = await pool.query(
    `INSERT INTO npm.donation (member_id, amount_lkr, method, card_last4, card_brand, status, note)
     VALUES ($1,$2,'card',$3,$4,'approved',$5) RETURNING id`,
    [m.id, amount, String(last4), brand, note?.trim() || null],
  );
  const row = await pool.query(`${DONATION_SELECT} WHERE dn.id=$1`, [ins.rows[0].id]);
  res.json({ ok: true, donation: mapDonation(row.rows[0]) });
}));

// Slip path: base64 photo → file on disk → pending admin review.
app.post('/api/donations/slip', wrap(async (req, res) => {
  const m = await requireMember(req);
  const amount = parseAmount(req.body?.amount);
  const { image, note } = req.body || {};
  const { buf, ext } = decodeImage(image);
  const fname = `${crypto.randomUUID()}.${ext}`;
  await putObject('donations', fname, buf);
  const ins = await pool.query(
    `INSERT INTO npm.donation (member_id, amount_lkr, method, slip_path, status, note)
     VALUES ($1,$2,'slip',$3,'pending',$4) RETURNING id`,
    [m.id, amount, fname, note?.trim() || null],
  );
  const row = await pool.query(`${DONATION_SELECT} WHERE dn.id=$1`, [ins.rows[0].id]);
  res.json({ ok: true, donation: mapDonation(row.rows[0]) });
}));

// --- Admin review ---
app.get('/api/donations/pending', wrap(async (req, res) => {
  await requireAdmin(req);
  const r = await pool.query(`${DONATION_SELECT} WHERE dn.status='pending' ORDER BY dn.created_at ASC`);
  res.json({ donations: r.rows.map((d) => mapDonation(d)) });
}));

app.get('/api/donations/:id/slip', wrap(async (req, res) => {
  await requireAdmin(req);
  const r = await pool.query(`SELECT slip_path FROM npm.donation WHERE id=$1`, [req.params.id]);
  const fname = r.rows[0]?.slip_path;
  if (!fname) throw bad('not_found', 404);
  const buf = await getObject('donations', fname); // basename inside: no traversal
  if (!buf) throw bad('not_found', 404);
  res.type(mimeFor(fname)).send(buf);
}));

app.post('/api/donations/:id/review', wrap(async (req, res) => {
  const admin = await requireAdmin(req);
  const { action, note } = req.body || {};
  if (!['approve', 'reject'].includes(action)) throw bad('bad_action');
  const r = await pool.query(
    `UPDATE npm.donation SET status=$1, note=coalesce($2, note), reviewed_by=$3, reviewed_at=now()
     WHERE id=$4 AND status='pending' RETURNING id`,
    [action === 'approve' ? 'approved' : 'rejected', note?.trim() || null, admin.id, req.params.id],
  );
  if (!r.rows[0]) throw bad('not_found', 404);
  const row = await pool.query(`${DONATION_SELECT} WHERE dn.id=$1`, [req.params.id]);
  res.json({ ok: true, donation: mapDonation(row.rows[0]) });
}));

// --- Frontend ----------------------------------------------------------------
// Single-service deploy: this process also serves the built PWA, so the app's
// relative '/api' calls are same-origin — one URL, no CORS, no proxy rewrites.
// In dev the Vite server serves the app and proxies /api here instead, so this
// block is simply skipped when no build is present.
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'dist');
const hasBuild = fs.existsSync(path.join(DIST, 'index.html'));

if (hasBuild) {
  app.use(express.static(DIST, {
    index: false,
    setHeaders(res, file) {
      // Asset filenames are content-hashed, so they can be cached forever.
      // index.html and the service worker must not be, or a client pins itself
      // to a stale build and never sees another deploy.
      if (/[\\/]assets[\\/]/.test(file)) res.set('cache-control', 'public, max-age=31536000, immutable');
      else res.set('cache-control', 'no-cache');
    },
  }));

  // Client-side routes: any GET that is not an API call and not a real file is
  // handled by the SPA. Everything else falls through to the 404 below.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.set('cache-control', 'no-cache').sendFile(path.join(DIST, 'index.html'));
  });
}

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

// Under a serverless host there is no port to bind: the platform imports this
// module and hands each request to the exported Express app, which is itself a
// valid (req, res) handler. Only bind a port when running as a real process.
if (!SERVERLESS) {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => {
    console.log(`NPM membership API on port ${port}`);
    console.log(`  mode     ${PROD ? 'production' : 'development'}`);
    console.log(`  storage  ${storageBackend}`);
    console.log(`  frontend ${hasBuild ? 'served from app/dist' : 'not built — API only'}`);
    if (!PROD && DEV_OTP) console.log('  DEV_OTP  on — OTP codes are returned in API responses');
  });
}

export default app;
