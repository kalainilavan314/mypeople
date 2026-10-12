import { useSyncExternalStore } from 'react';

const KEY = 'npm.theme';
export type ThemeMode = 'light' | 'dark';
const listeners = new Set<() => void>();

export function getTheme(): ThemeMode {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(KEY, mode);
  listeners.forEach((l) => l());
}

export const themeStore = {
  get: getTheme,
  set: (m: ThemeMode) => applyTheme(m),
  toggle: () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark'),
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useTheme() {
  const mode = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.get,
    () => 'light' as ThemeMode,
  );
  return { mode, isDark: mode === 'dark', toggle: themeStore.toggle, set: themeStore.set };
}
