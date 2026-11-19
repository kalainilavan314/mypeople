import type { SafetyHome } from '@my-people/api-client';

import { deviceDraftStorage } from '@/lib/deviceDraft';

// M35 keeps the last alerts it loaded on this phone, with the time, so a member who loses the connection
// in a flood still sees the official warnings, shelters and emergency numbers (BRD M35: "last alerts
// cached with time"). Warnings are public; the member's own relief offer is not kept.

const storage = deviceDraftStorage('safety-alerts.json', 'tmk-safety-alerts');

type Saved = { memberId: string; area: string | null; home: SafetyHome };

export async function saveAlerts(memberId: string, area: string | null, home: SafetyHome): Promise<void> {
  const copy: Saved = { memberId, area, home: { ...home, reliefOffer: null } };
  await storage.write(JSON.stringify(copy));
}

/** The saved copy for this member and area, or null; a copy left by someone else is removed. */
export async function readSavedAlerts(memberId: string, area: string | null): Promise<SafetyHome | null> {
  const text = await storage.read();
  if (!text) return null;
  try {
    const saved = JSON.parse(text) as Partial<Saved>;
    if (saved.memberId !== memberId) {
      await storage.remove();
      return null;
    }
    return saved.area === area && saved.home ? saved.home : null;
  } catch {
    return null;
  }
}
