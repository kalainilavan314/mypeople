import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool, memberById, memberByNicHash, memberByPhone } from './db.js';
import { nicHash, signToken, verifyToken, otpCode, memberCode, referralCode, publicMember, verifyAvatarUrl, hashOtp, isNicFormat, signCardToken } from './lib.js';
import { recomputeTier, tierProgress } from './tier.js';
import { clientIp, checkOtpRequest, issueOtp, consumeOtp, checkLogin, recordLogin, sleep } from './throttle.js';
import { putObject, getObject, deleteObject, mimeFor, backend as storageBackend } from './storage.js';

const PROD = process.env.NODE_ENV === 'production';

// Password policy (NIST SP 800-63B, single password factor): length is the
// strength lever — a long minimum, a generous maximum, no composition rules.
const MIN_PASSWORD = 15;
const MAX_PASSWORD = 64;

// Registration is OPEN. There is no invite/referral gate anywhere — not in
// config, not in the UI, and not in the signup transaction (previously a
// closed-pilot gate behind SIGNUP_INVITE_CODE, now removed outright so no stale
// validation can resurface at the final submission step).
// WARNING: signup performs no OTP or identity check, so anyone who can reach the
// URL can create an account against any NIC number — a deliberate product choice.

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
  ? ['JWT_SECRET', 'NIC_PEPPER', 'DATABASE_URL'].filter(
      (k) => !process.env[k]?.trim() || ['dev-secret', 'dev-pepper'].includes(process.env[k]),
    )
  : [];

if (MISSING_ENV.length) {
  console.error(`Misconfigured: ${MISSING_ENV.join(', ')} must be set when NODE_ENV=production.`);
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

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

// --- Session cookie ---------------------------------------------------------
// The session token lives in a Secure, HttpOnly, SameSite=Lax cookie rather than
// in a header the client reads from localStorage: an XSS bug then cannot read
// the session token, because JavaScript never sees it. SameSite=Lax is also the
// primary CSRF defence — the browser withholds the cookie from cross-site
// POST/fetch, so a forged request from another origin arrives unauthenticated.
//
// The Bearer header is still accepted (tokenFromReq below) so non-browser
// clients and the transition period keep working; browsers use the cookie.
const SESSION_COOKIE = 'mp_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30d, matches the JWT
function setSession(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: PROD,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}
function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: PROD, path: '/' });
}
function cookieToken(req) {
  const raw = req.headers.cookie || '';
  const m = raw.match(/(?:^|;\s*)mp_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
// Cookie first (browser), then Authorization: Bearer (non-browser / transition).
function tokenFromReq(req) {
  return cookieToken(req) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
}

// --- CSRF (defence in depth over SameSite) ----------------------------------
// SameSite=Lax already stops a cross-site request from carrying the cookie, so
// this only ever fires on a same-cookie request whose Origin is present and
// does not match. Requests with no cookie (Bearer clients) and requests with no
// Origin header are left alone; a mismatch with an active cookie is refused.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (!cookieToken(req)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  if (ALLOWED.includes(origin)) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch { /* fall through */ }
  return res.status(403).json({ error: 'csrf_origin_mismatch' });
});

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

// Never returns OTP codes in a production response, whatever the environment
// says. Leaving this to configuration alone means one stray variable turns the
// login flow into an open door.
const DEV_OTP = !PROD && process.env.DEV_OTP === 'true';

// The card donation path is a SANDBOX. /api/donations/card/confirm writes the
// donation straight to status='approved', and the "bank OTP" it verifies is one
// this server generated itself — there is no payment gateway behind any of it.
// No money moves, yet the member is told the donation succeeded and the party
// fund total goes up.
//
// That is fine as a demo and unacceptable as a way to take real contributions,
// so in production it is off unless someone deliberately turns it on for a
// demonstration. Replace card/start and card/confirm with a real gateway
// (PayHere, or a bank IPG) before accepting actual donations.
const CARD_SANDBOX = !PROD || process.env.ALLOW_SANDBOX_CARD === 'true';
const wrap = (fn) => (req, res) => fn(req, res).catch(async (e) => {
  console.error(e);
  const status = e.status || 500;
  // Persist unexpected 5xx errors to a private log table (never to the HTTP
  // response). Awaited so a serverless function does not freeze before the write
  // completes.
  if (status >= 500) {
    try {
      await pool.query(
        'INSERT INTO public.error_log (path, method, status, message, code, stack) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.path, req.method, status, String((e && (e.message || e)) ?? '').slice(0, 500), e && e.code != null ? String(e.code) : null, String((e && e.stack) || '').slice(0, 2000)],
      );
    } catch { /* logging must never mask the original error */ }
  }
  res.status(status).json({ error: e.publicMessage || 'server_error' });
});
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status, publicMessage: msg });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'npm-membership', time: new Date().toISOString() }));

// Public deployment switches the frontend needs to know about. Deliberately
// says only WHETHER an invite code is required, never what it is.
app.get('/api/config', (_req, res) =>
  res.json({
    inviteRequired: false,
    // The UI hides the card option entirely when this is false, rather than
    // offering a payment method that returns 503 on submit.
    cardPaymentsEnabled: CARD_SANDBOX,
  }),
);

// --- OTP --------------------------------------------------------------------
app.post('/api/auth/request-otp', wrap(async (req, res) => {
  const { phone, purpose = 'signup' } = req.body || {};
  if (!phone || String(phone).replace(/\D/g, '').length < 9) throw bad('invalid_phone');

  // Layered limits: per-phone cooldown, hourly and daily caps, and a per-IP cap
  // so one attacker cannot walk through many numbers. Unthrottled, this endpoint
  // issued ten codes for one number instantly — an SMS bill and, once each code
  // stays valid, ten simultaneous guesses at a 6-digit secret.
  const ip = clientIp(req);
  const gate = await checkOtpRequest(String(phone), ip);
  if (!gate.ok) {
    res.set('retry-after', String(gate.retryAfter));
    throw bad('too_many_requests', 429);
  }

  const code = otpCode();
  // Issuing invalidates any code still outstanding for this phone and purpose.
  await issueOtp({ phone: String(phone), code, purpose, ip });
  // No SMS gateway yet: log it, and (dev only) return it so the flow is testable.
  // OTPs and phone numbers must never be written to logs.
  res.json({ ok: true, ...(DEV_OTP ? { devCode: code } : {}) });
}));

app.post('/api/auth/verify-otp', wrap(async (req, res) => {
  const { phone, code, purpose = 'signup' } = req.body || {};
  if (!phone || !code) throw bad('missing_fields');

  // Counts wrong guesses against the code and burns it after five, so the
  // 6-digit space cannot be searched within the code's lifetime.
  const r = await consumeOtp({ phone: String(phone), code: String(code), purpose });
  if (!r.ok) throw bad(r.reason === 'too_many_attempts' ? 'too_many_attempts' : 'invalid_code', 401);
  res.json({ ok: true });
}));

// --- Sign up ----------------------------------------------------------------
app.post('/api/auth/signup', wrap(async (req, res) => {
  const b = req.body || {};
  const { name, nic, phone, password, dob, gender, districtCode, dsCode, gsCode, referralId, answers, language } = b;
  // Identity is the NIC — a mobile number is optional (no SMS/OTP step). There is
  // no invite gate: registration is open (see the note near the top of this file).
  if (!name || !nic || !password) throw bad('missing_fields');
  // Password policy (NIST SP 800-63B for a single password factor): a long
  // minimum, a generous maximum, and no character-composition rules. Length is
  // the strength lever; passphrases and password managers are encouraged.
  if (String(password).length < MIN_PASSWORD) throw bad('weak_password');
  if (String(password).length > MAX_PASSWORD) throw bad('password_too_long');

  // Trim first, then judge. "   " is a truthy string, so the check above passed
  // it and an empty name was stored. Browser attributes cannot be relied on for
  // this: an API client never sees them.
  const fullName = String(name).trim();
  if (fullName.length < 2 || fullName.length > 150) throw bad('bad_name');

  // A date of birth in 2050 was accepted. The upper bound cannot live in a CHECK
  // constraint, which has to be immutable, so it is enforced here.
  if (dob) {
    const d = new Date(String(dob));
    if (Number.isNaN(d.getTime())) throw bad('bad_dob');
    if (d > new Date()) throw bad('dob_in_future');
    if (d < new Date('1900-01-01')) throw bad('bad_dob');
  }

  const nh = nicHash(nic);
  if (await memberByNicHash(nh)) throw bad('nic_exists', 409);
  const phoneVal = phone && String(phone).trim() ? String(phone).trim() : null;
  if (phoneVal && await memberByPhone(phoneVal)) throw bad('phone_exists', 409);

  const pwHash = await bcrypt.hash(String(password), 10);
  // Honest verification: at signup the most we can attest is that the NIC
  // *format* is valid — never identity. Anything more requires a coordinator
  // review (see /api/me/verification, recorded in npm.verification_audit).
  const vStatus = isNicFormat(nic) ? 'nic_format' : 'unverified';

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
             (member_code, full_name, phone, nic_hash, nic_status, verification_status, password_hash,
              dob, gender, gs_code, ds_code, district_code, referral_code, referred_by, language)
           VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [memberCode(), fullName, phoneVal, nh, vStatus, pwHash,
            dob || null, gender || null, gsCode || null, dsCode || null, districtCode || null,
            referralCode(fullName), referrerId, language || 'en'],
        );
        member = ins.rows[0];
      } catch (e) {
        if (e.code !== '23505') throw e;
        // Which unique constraint was violated decides the outcome, and getting
        // this wrong is worse than not catching at all. member_code and
        // referral_code are generated here, so a collision is bad luck and
        // retrying with fresh values is correct. A NIC or phone collision is the
        // caller's input and must surface as 409 — retrying it five more times
        // and then reporting could_not_allocate_code would turn a clear
        // "already registered" into an opaque 500.
        if (e.constraint === 'member_nic_hash_active_key') throw bad('nic_exists', 409);
        if (e.constraint === 'member_phone_key') throw bad('phone_exists', 409);
        continue; // generated-code collision -> retry
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

    // Record the initial verification state in the audit trail.
    await client.query(
      `INSERT INTO npm.verification_audit (member_id, from_status, to_status, method, notes)
       VALUES ($1, NULL, $2, 'signup_format_check', 'Initial state at sign-up')`,
      [member.id, vStatus],
    );

    await client.query('COMMIT');
    const full = await memberById(member.id);
    const token = signToken(member.id);
    setSession(res, token);
    res.json({ ok: true, token, member: await withProgress(full) });
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

  // Throttled by account AND address together, never by address alone: members
  // in a government office, an internet cafe or behind carrier NAT share one
  // public IP, and locking that IP out would deny service to everyone in the
  // building because of one person's typo.
  //
  // The identifier is the NIC hash, so nothing here stores a NIC. Failures are
  // recorded even for accounts that do not exist, so probing for valid NICs
  // cannot be distinguished from guessing a password.
  const ip = clientIp(req);
  const identifier = nicHash(nic);

  const gate = await checkLogin(identifier, ip);
  if (!gate.ok) {
    res.set('retry-after', String(gate.retryAfter));
    throw bad('too_many_attempts', 429);
  }
  // Progressive delay past the soft threshold: unnoticeable to someone who
  // mistyped, ruinous to a script making thousands of guesses.
  await sleep(gate.delayMs);

  const member = await memberByNicHash(identifier);
  const ok = member ? await bcrypt.compare(String(password), member.password_hash) : false;

  await recordLogin(identifier, ip, ok);
  if (!ok) throw bad('invalid_credentials', 401);

  const token = signToken(member.id);
  setSession(res, token);
  // token is still returned for non-browser clients; browsers use the cookie.
  res.json({ ok: true, token, member: await withProgress(member) });
}));

// Clear the session cookie. Client also drops its cached member.
app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// --- Me ---------------------------------------------------------------------
app.get('/api/me', wrap(async (req, res) => {
  const token = tokenFromReq(req);
  if (!token) throw bad('unauthorized', 401);
  let sub;
  try { sub = verifyToken(token).sub; } catch { throw bad('unauthorized', 401); }
  const member = await memberById(sub);
  if (!member) throw bad('not_found', 404);
  res.json({ member: await withProgress(member) });
}));

// Opaque, signed, short-lived membership credential for the card QR. The QR
// carries THIS, never the NIC/DOB or any personal detail — a check-in service
// resolves the token server-side under its own authorization rules.
app.get('/api/me/card-token', wrap(async (req, res) => {
  const id = memberIdFromReq(req);
  if (!id) throw bad('unauthorized', 401);
  const m = await memberById(id);
  if (!m) throw bad('unauthorized', 401);
  res.json({ token: signCardToken(m.id) });
}));

// --- Events -----------------------------------------------------------------
function memberIdFromReq(req) {
  const t = tokenFromReq(req);
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
  if (name !== undefined && (name.length < 2 || name.length > 150)) throw bad('bad_name');
  if (b.dob !== undefined && b.dob) {
    const d = new Date(String(b.dob));
    if (Number.isNaN(d.getTime())) throw bad('bad_dob');
    if (d > new Date()) throw bad('dob_in_future');
    if (d < new Date('1900-01-01')) throw bad('bad_dob');
  }
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
  // Member photographs are personal data and this endpoint previously served
  // any of them to anyone who knew the member id, with no authentication at all.
  // Ids are UUIDs so they could not be enumerated, but "unguessable" is not
  // "authorised".
  //
  // The URL carries its own short-lived signature (see signedAvatarUrl), which
  // is what makes this work at all: an <img> tag cannot send an Authorization
  // header, so the permission has to travel in the URL. A signature is checked
  // against the member AND their current photograph, so it stops working when
  // the photograph is replaced.
  const r = await pool.query(`SELECT avatar_path FROM npm.member WHERE id=$1`, [req.params.memberId]);
  const fname = r.rows[0]?.avatar_path;
  if (!fname) throw bad('not_found', 404);

  if (!verifyAvatarUrl(req.params.memberId, fname, req.query.e, req.query.s)) {
    // 404, not 403: a wrong signature should not confirm that this member
    // exists or has a photograph.
    throw bad('not_found', 404);
  }

  const buf = await getObject('avatars', fname);
  if (!buf) throw bad('not_found', 404);
  // Private: the signature is in the URL, so a shared cache must never keep it.
  res.set('cache-control', 'private, max-age=86400');
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

// --- Verification review (coordinator) --------------------------------------
// A coordinator moves a member through the verification states. Every change is
// written to the append-only audit trail with who did it, how, and why.
// 'identity_confirmed' is the only state that asserts a real identity check —
// it must never be set by self-service, only here.
const VERIFICATION_STATES = ['unverified', 'nic_format', 'review_pending', 'identity_confirmed'];
app.post('/api/members/:id/verification', wrap(async (req, res) => {
  const admin = await requireAdmin(req);
  const { status, method, notes } = req.body || {};
  if (!VERIFICATION_STATES.includes(status)) throw bad('bad_status');
  const target = await memberById(req.params.id);
  if (!target) throw bad('not_found', 404);

  const confirmed = status === 'identity_confirmed';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (confirmed) {
      await client.query(
        `UPDATE npm.member
           SET verification_status = $1, verification_method = $2, review_notes = $3,
               verified_at = now(), verified_by = $4
         WHERE id = $5`,
        [status, method || 'coordinator_review', notes || null, admin.id, target.id],
      );
    } else {
      await client.query(
        `UPDATE npm.member
           SET verification_status = $1, verification_method = $2, review_notes = $3,
               verified_at = NULL, verified_by = NULL
         WHERE id = $4`,
        [status, method || 'coordinator_review', notes || null, target.id],
      );
    }
    await client.query(
      `INSERT INTO npm.verification_audit (member_id, from_status, to_status, method, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [target.id, target.verification_status, status, method || 'coordinator_review', admin.id, notes || null],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const full = await memberById(target.id);
  res.json({ ok: true, member: await withProgress(full) });
}));

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
  if (!CARD_SANDBOX) throw bad('card_payments_unavailable', 503);
  const m = await requireMember(req);
  const amount = parseAmount(req.body?.amount);
  const code = otpCode();
  await pool.query(
    `INSERT INTO npm.otp (phone, code, purpose, expires_at) VALUES ($1,$2,'donation', now() + interval '10 minutes')`,
    [`don:${m.id}`, hashOtp(code)],
  );
  // Payment verification codes must never be written to logs.
  res.json({ ok: true, ...(DEV_OTP ? { devCode: code } : {}) });
}));

// Card step 2: verify the OTP and record the (sandbox-approved) donation.
app.post('/api/donations/card/confirm', wrap(async (req, res) => {
  if (!CARD_SANDBOX) throw bad('card_payments_unavailable', 503);
  const m = await requireMember(req);
  const { code, last4, brand, note } = req.body || {};
  const amount = parseAmount(req.body?.amount);
  if (!code || !/^\d{4}$/.test(String(last4 || ''))) throw bad('missing_fields');
  if (!['visa', 'mastercard'].includes(brand)) throw bad('bad_brand');
  const r = await pool.query(
    `SELECT id FROM npm.otp WHERE phone=$1 AND code=$2 AND purpose='donation' AND consumed=false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [`don:${m.id}`, hashOtp(code)],
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
