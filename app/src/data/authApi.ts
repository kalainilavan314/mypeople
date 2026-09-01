// HTTP client for the real membership backend (auth / OTP / signup / referrals).
// Same-origin '/api' — Vite proxies it to the Node server in dev; in prod it's
// served behind the same host. Content APIs still use the mock client for now.

const TOKEN_KEY = 'npm.token';

export interface ServerMember {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string;
  nicStatus: string;
  dob: string | null;
  gender: string | null;
  gsCode: string | null;
  gsName: string | null;
  dsCode: string | null;
  dsName: string | null;
  districtCode: string | null;
  districtName: string | null;
  tier: 'volunteer' | 'diamond' | 'gold' | 'platinum';
  referralCode: string;
  referredBy: string | null;
  recruitCount: number;
  language: string;
  joinedAt: string;
  tierProgress?: TierProgress;
  isAdmin?: boolean;
  avatarUrl?: string | null;
}

/** Fields a member may edit about themselves (identity NIC + password excluded). */
export interface ProfileUpdate {
  name?: string;
  dob?: string | null;
  gender?: string | null;
  gsCode?: string | null;
  phone?: string | null;
  language?: string;
}

export interface TierProgress {
  have: number;
  next: 'diamond' | 'gold' | 'platinum' | null;
  need: number | null;
  pct: number;
  diamondNeed: number;
}

export interface SignupPayload {
  name: string;
  nic: string;
  /** Optional — identity is the NIC; there is no SMS/OTP step. */
  phone?: string;
  password: string;
  dob: string | null;
  gender: string | null;
  districtCode: string | null;
  dsCode: string | null;
  gsCode: string | null;
  referralId: string;
  answers: Record<string, string>;
  language: string;
  /** Closed-pilot gate. Required only when /api/config reports inviteRequired. */
  inviteCode?: string;
}

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
  return data as T;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function saveSession(token: string, member: ServerMember) {
  localStorage.setItem(TOKEN_KEY, token);
  saveMember(member);
}
/** Refresh the cached member (after profile edits etc.) so every screen updates. */
export function saveMember(member: ServerMember) {
  // Keep the mock content layer showing the real name until the whole app is wired.
  localStorage.setItem('npm.name', member.fullName);
  localStorage.setItem('npm.member', JSON.stringify(member));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('npm.member');
}
export function cachedMember(): ServerMember | null {
  try {
    const v = localStorage.getItem('npm.member');
    return v ? (JSON.parse(v) as ServerMember) : null;
  } catch {
    return null;
  }
}

export const authApi = {
  /**
   * Deployment switches. A closed-pilot deployment sets SIGNUP_INVITE_CODE, and
   * registration then requires it; local dev leaves it unset and signup is open.
   * Treated as open if the call fails, so a hiccup here cannot lock the form —
   * the server rejects a bad or missing code regardless.
   */
  async config(): Promise<{ inviteRequired: boolean }> {
    try {
      return await get<{ inviteRequired: boolean }>('/config');
    } catch {
      return { inviteRequired: false };
    }
  },

  requestOtp: (phone: string, purpose = 'signup') =>
    post<{ ok: true; devCode?: string }>('/auth/request-otp', { phone, purpose }),

  verifyOtp: (phone: string, code: string) =>
    post<{ ok: boolean }>('/auth/verify-otp', { phone, code }),

  async signup(payload: SignupPayload) {
    const r = await post<{ ok: true; token: string; member: ServerMember }>('/auth/signup', payload);
    saveSession(r.token, r.member);
    return r;
  },

  async login(nic: string, password: string) {
    const r = await post<{ ok: true; token: string; member: ServerMember }>('/auth/login', { nic, password });
    saveSession(r.token, r.member);
    return r;
  },

  // Fresh member (incl. live recruit count + tier progress). Updates the cache.
  async me(): Promise<ServerMember | null> {
    const token = getToken();
    if (!token) return null;
    const res = await fetch('/api/me', { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return cachedMember();
    const data = (await res.json()) as { member: ServerMember };
    saveMember(data.member);
    return data.member;
  },

  // Edit own profile details. Returns the fresh member and updates the cache.
  async updateProfile(update: ProfileUpdate): Promise<ServerMember> {
    const token = getToken();
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(update),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
    saveMember(data.member as ServerMember);
    return data.member as ServerMember;
  },

  // Upload a new profile photo (base64 data URL). Updates the cache.
  async uploadAvatar(image: string): Promise<ServerMember> {
    const token = getToken();
    const res = await fetch('/api/me/avatar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
    saveMember(data.member as ServerMember);
    return data.member as ServerMember;
  },
};
