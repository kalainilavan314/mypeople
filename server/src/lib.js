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
export const verifyToken = (token) => jwt.verify(token, SECRET);

export const otpCode = () => String(Math.floor(100000 + Math.random() * 900000));

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
    // uuid filename per upload -> URL changes on replacement (cache-safe)
    avatarUrl: m.avatar_path ? `/api/avatars/${m.id}?v=${String(m.avatar_path).slice(0, 8)}` : null,
    joinedAt: m.created_at,
  };
}
