import type { ApiClient, SignUpInput } from '@/core/api/api';
import type { Lang } from '@/core/api/types';
import { parseNic } from '@/core/lib/nic';
import { clone } from './clientModel/clone';
import { delay } from './clientModel/delay';
import { initials } from './clientModel/initials';
import { state } from './clientModel/state';

type AccountMethods =
  | 'getMember'
  | 'setLanguage'
  | 'signUp'
  | 'login'
  | 'verifyNic'
  | 'requestOtp'
  | 'verifyOtp'
  | 'submitNic';

export const accountPrototype: Pick<ApiClient, AccountMethods> = {
  async getMember() {
    await delay();
    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('npm.name') : null;
    if (savedName) {
      state.member.fullName = savedName;
      state.member.avatarInitials = initials(savedName);
    }
    return clone(state.member);
  },
  async setLanguage(lang: Lang) {
    await delay(80);
    state.member.language = lang;
    return clone(state.member);
  },
  async signUp(input: SignUpInput) {
    await delay(500);
    if (input.name.trim()) {
      state.member.fullName = input.name.trim();
      state.member.avatarInitials = initials(input.name);
      if (typeof localStorage !== 'undefined') localStorage.setItem('npm.name', input.name.trim());
    }
    state.member.nicStatus = 'pending';
    return { ok: true } as const;
  },
  async login(nic: string, password: string) {
    await delay(500);
    if (!parseNic(nic).valid) return { ok: false, reason: 'nic' as const };
    if (password.trim().length < 6) return { ok: false, reason: 'credentials' as const };
    return { ok: true };
  },
  async verifyNic(nic: string) {
    await delay(700);
    const info = parseNic(nic),
      status = info.valid ? ('verified' as const) : ('rejected' as const);
    state.member.nicStatus = status;
    return { ok: info.valid, status };
  },
  async requestOtp(_phone: string) {
    await delay(500);
    return { ok: true } as const;
  },
  async verifyOtp(_phone: string, code: string) {
    await delay(400);
    return { ok: code.replace(/\D/g, '').length >= 6 };
  },
  async submitNic() {
    await delay(500);
    state.member.nicStatus = 'pending';
    return { status: 'pending' } as const;
  },
};
