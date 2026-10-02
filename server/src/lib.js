// Small helpers: hashing, tokens, code generation.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const PEPPER = process.env.NIC_PEPPER || 'dev-pepper';
const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Deterministic NIC hash: lets us look up / dedupe by NIC and enforce login
// without ever storing the raw national ID number.
export const nicHash = (nic) =>
  crypto.createHash('sha256').update(PEPPER + String(nic).trim().toUpperCase()).digest('hex');

// The session version the token was signed with travels inside it. Verification
// compares it against the member's current value, so incrementing that value
// invalidates every token issued before — which is what makes logout real for a
// stateless token. Tokens minted before this existed carry no sv; they are
// treated as version 0, so nobody is signed out by the deployment itself.
export const signToken = (memberId, sessionVersion = 0) =>
  jwt.sign({ sub: memberId, sv: sessionVersion }, SECRET, { expiresIn: '30d' });

export const verifyToken = (token) => jwt.verify(token, SECRET, { algorithms: ['HS256'] });

/** True when the token was issued before the member's sessions were last revoked. */
export const tokenIsStale = (payload, member) =>
  Number(payload?.sv ?? 0) !== Number(member?.session_version ?? 0);

export const otpCode = () => String(crypto.randomInt(100000, 1000000));

// One-time codes are stored HASHED, never in the clear: a database read (backup
// leak, SQL injection, a curious operator) must not hand over live codes. The
// pepper is the app secret, so a stolen table alone cannot be brute-forced
// against the tiny 6-digit space without it.
export const hashOtp = (code) =>
  crypto.createHmac('sha256', SECRET).update(`otp:${String(code)}`).digest('hex');

// Sri Lankan NIC format: old 9 digits + V/X, or new 12 digits. Format only —
// this proves nothing about identity, which is exactly why a passing check maps
// to 'nic_format', not a confirmed identity.
export const isNicFormat = (nic) => /^(\d{9}[VXvx]|\d{12})$/.test(String(nic || '').trim());

// Opaque, signed, expiring membership credential for the card QR. The QR must
// not carry NIC/DOB or any personal data: it carries this token, which a
// check-in service resolves server-side under its own authorization rules.
const CARD_TOKEN_TTL_SECONDS = 10 * 60;
export function signCardToken(memberId) {
  const exp = Math.floor(Date.now() / 1000) + CARD_TOKEN_TTL_SECONDS;
  const body = `${memberId}.${exp}`;
  const sig = crypto.createHmac('sha256', SECRET).update(`card:${body}`).digest('base64url').slice(0, 27);
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}
export function verifyCardToken(token) {
  const [b64, sig] = String(token || '').split('.');
  if (!b64 || !sig) return null;
  let body;
  try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const [memberId, expStr] = body.split('.');
  const exp = Number(expStr);
  if (!memberId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`card:${body}`).digest('base64url').slice(0, 27);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { memberId };
}

export function memberCode() {
  const yy = String(new Date().getFullYear()).slice(2);
  return `WTL-${yy}-${Math.floor(1000000 + Math.random() * 9000000)}`;
}

export function referralCode(name) {
  const letters = String(name || '').toUpperCase().replace(/[^A-Z]/g, '');
  const base = letters.slice(0, 4) || 'WTL';
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// pg parses DATE columns into JS Dates at server-local midnight; serializing
// those as ISO shifts the calendar day. Emit the plain YYYY-MM-DD instead.
function dateOnly(v) {
  if (!v) return null;
  const d = new Date(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Public (safe) view of a member row — never leaks nic_hash / password_hash.
export function publicMember(m) {
  if (!m) return null;
  return {
    id: m.id,
    memberCode: m.member_code,
    fullName: m.full_name,
    phone: m.phone,
    nicStatus: m.nic_status,
    // Honest, explicit verification state (see migration 0009). The UI shows a
    // badge from this and must never imply more than the state warrants.
    verificationStatus: m.verification_status ?? 'unverified',
    verifiedAt: m.verified_at ?? null,
    dob: dateOnly(m.dob),
    gender: m.gender,
    gsCode: m.gs_code,
    gsName: m.gs_name ?? null,
    dsCode: m.ds_code ?? null,
    dsName: m.ds_name ?? null,
    districtCode: m.district_code,
    districtName: m.district_name ?? null,
    tier: m.tier,
    referralCode: m.referral_code,
    referredBy: m.referred_by,
    recruitCount: m.recruit_count,
    language: m.language,
    isAdmin: !!m.is_admin,
    // Signed, expiring URL. A member photograph is personal data, so the
    // endpoint cannot be open — but an <img> tag cannot send an Authorization
    // header, so a bearer token is not available either. The same answer object
    // storage uses applies: put a short-lived signature in the URL itself.
    avatarUrl: m.avatar_path ? signedAvatarUrl(m.id, m.avatar_path) : null,
    joinedAt: m.created_at,
  };
}

/* ----------------------------------------------------------- avatar URLs */

// How long a signed photograph URL stays usable. Long enough that a URL handed
// to the browser keeps working while someone reads the page, short enough that a
// link copied out of devtools or a shared screenshot stops working the next day.
// Every /api/me response mints fresh URLs, so the client never sees a stale one.
const AVATAR_URL_TTL_SECONDS = 24 * 60 * 60;

const avatarSignature = (memberId, avatarPath, exp) =>
  crypto
    .createHmac('sha256', SECRET)
    .update(`avatar:${memberId}:${avatarPath}:${exp}`)
    .digest('base64url')
    .slice(0, 27);

export function signedAvatarUrl(memberId, avatarPath) {
  const exp = Math.floor(Date.now() / 1000) + AVATAR_URL_TTL_SECONDS;
  const sig = avatarSignature(memberId, avatarPath, exp);
  // v changes when the file does, so a replaced photograph is never served from
  // cache; e and s make the URL unguessable and time-limited.
  return `/api/avatars/${memberId}?v=${String(avatarPath).slice(0, 8)}&e=${exp}&s=${sig}`;
}

/** True if this signature authorises this member's current photograph now. */
export function verifyAvatarUrl(memberId, avatarPath, exp, sig) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = avatarSignature(memberId, avatarPath, expNum);
  const a = Buffer.from(String(sig ?? ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
