import { useEffect, useState } from 'react';

import { useApiQuery } from './useApi';

const LEAD_MS = 10_000; // ask for the next code a little before this one expires

/**
 * A 60-second QR code (member card C1 or event pass E1), fetched again just
 * before it expires, so the code on screen is always one a scanner accepts.
 */
export function useRotatingCode<T extends { code: string; expiresAt: string }>(load: () => Promise<T>, enabled: boolean, deps: readonly unknown[] = []) {
  const [round, setRound] = useState(0);
  const code = useApiQuery(async () => (enabled ? load() : null), [enabled, round, ...deps]);

  useEffect(() => {
    if (!code.data) return;
    const wait = Math.max(new Date(code.data.expiresAt).getTime() - Date.now() - LEAD_MS, 5_000);
    const timer = setTimeout(() => setRound((n) => n + 1), wait);
    return () => clearTimeout(timer);
  }, [code.data]);

  return code;
}
