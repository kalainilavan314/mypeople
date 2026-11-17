import { useEffect, useState } from 'react';

import { useRotatingCode } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * The card's live 60-second QR code while `enabled` (the card is on screen), or null while it
 * loads, without a connection, or once the last code has expired, so the card never shows a code
 * a scanner would refuse.
 */
export function useLiveCardCode(enabled: boolean): string | null {
  const code = useRotatingCode(() => api().getMyCardCode(), enabled);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!code.data) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [code.data]);
  if (!enabled || !code.data || code.error) return null;
  return Date.parse(code.data.expiresAt) > now ? code.data.code : null;
}
