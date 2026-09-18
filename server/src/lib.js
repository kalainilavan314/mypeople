// Small helpers: hashing, tokens, code generation.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const PEPPER = process.env.NIC_PEPPER || 'dev-pepper';
const SECRET = process.env.JWT_SECRET || 'dev-secret';

// Deterministic NIC hash: lets us look up / dedupe by NIC and enforce login
// without ever storing the raw national ID number.
export const nicHash = (nic) =>
  crypto.createHash('sha256').update(PEPPER + String(nic).trim().toUpperCase()).digest('hex');

export const signToken = (memberId) => jwt.sign({ sub: memberId }, SECRET, { expiresIn: '30d' });
export const verifyToken = (token) => jwt.verify(token, SECRET, { algorithms: ['HS256'] });

export const otpCode = () => String(crypto.randomInt(100000, 1000000));

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
