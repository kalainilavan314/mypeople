import { ApiError } from '@/core/api/auth/request';
import { cachedMember } from '@/core/api/auth/session';
import { clearSession } from '@/core/api/auth/session';
import { get } from '@/core/api/auth/request';
import { post } from '@/core/api/auth/request';
import { ProfileUpdate } from '@/core/api/auth/models';
import { saveMember } from '@/core/api/auth/session';
import { saveSession } from '@/core/api/auth/session';
import { ServerMember } from '@/core/api/auth/models';
import { SignupPayload } from '@/core/api/auth/models';
export const authApi = {
  async config(): Promise<{ inviteRequired: boolean; cardPaymentsEnabled: boolean }> {
    try {
      return await get<{ inviteRequired: boolean; cardPaymentsEnabled: boolean }>('/config');
    } catch {
      return { inviteRequired: false, cardPaymentsEnabled: false };
    }
  },

  requestOtp: (phone: string, purpose = 'signup') =>
    post<{ ok: true; devCode?: string }>('/auth/request-otp', { phone, purpose }),

  verifyOtp: (phone: string, code: string) =>
    post<{ ok: boolean }>('/auth/verify-otp', { phone, code }),

  async signup(payload: SignupPayload) {
    const r = await post<{ ok: true; token: string; member: ServerMember }>(
      '/auth/signup',
      payload,
    );
    saveSession(r.token, r.member);
    return r;
  },

  async login(nic: string, password: string) {
    const r = await post<{ ok: true; token: string; member: ServerMember }>('/auth/login', {
      nic,
      password,
    });
    saveSession(r.token, r.member);
    return r;
  },

  async me(): Promise<ServerMember | null> {
    let res: Response;
    try {
      res = await fetch('/api/me', { credentials: 'include' });
    } catch {
      return cachedMember();
    }
    if (res.status === 401) return null;
    if (!res.ok) return cachedMember();
    const data = (await res.json()) as { member: ServerMember };
    saveMember(data.member);
    return data.member;
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* best effort — the local flag/cache is cleared regardless */
    }
    clearSession();
  },

  async cardToken(): Promise<string | null> {
    try {
      const r = await get<{ token: string }>('/me/card-token');
      return r.token;
    } catch {
      return null;
    }
  },

  async updateProfile(update: ProfileUpdate): Promise<ServerMember> {
    const res = await fetch('/api/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(update),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
    saveMember(data.member as ServerMember);
    return data.member as ServerMember;
  },

  async uploadAvatar(image: string): Promise<ServerMember> {
    const res = await fetch('/api/me/avatar', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'server_error', res.status);
    saveMember(data.member as ServerMember);
    return data.member as ServerMember;
  },
};
