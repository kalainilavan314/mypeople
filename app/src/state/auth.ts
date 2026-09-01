import { useSyncExternalStore } from 'react';

// Minimal auth/session flag, persisted to localStorage. No provider needed.
// Default: logged OUT — first launch shows the Login screen. Login/sign-up set it.

const KEY = 'npm.authed';
const listeners = new Set<() => void>();

function read(): boolean {
  return localStorage.getItem(KEY) === '1';
}

function emit() {
  listeners.forEach((l) => l());
}

export const authStore = {
  login() {
    localStorage.setItem(KEY, '1');
    emit();
  },
  logout() {
    localStorage.setItem(KEY, '0');
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return read();
  },
};

export function useAuth() {
  const authed = useSyncExternalStore(authStore.subscribe, authStore.get, () => false);
  return { authed, login: authStore.login, logout: authStore.logout };
}
