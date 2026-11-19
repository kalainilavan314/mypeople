import { readChunked, removeChunked, writeChunked } from '../fieldVisits/secureChunks';

// S16 keeps the record being written encrypted on this phone (Android Keystore or iOS Keychain), so a
// lost connection at a distribution site loses nothing; it is removed once the record is saved. The web
// version keeps it in memory only, like field visits.

export type ReliefDraft = {
  storeKey: string | null;
  item: string | null;
  quantity: string;
  ds: string | null;
  gn: string | null;
  recipientKind: 'case' | 'group';
  caseRef: string;
  groupSite: string;
  households: string;
  evidence: string;
  day: 'today' | 'yesterday' | 'earlier';
  otherDate: string;
};

export const EMPTY_DRAFT: ReliefDraft = {
  storeKey: null,
  item: null,
  quantity: '',
  ds: null,
  gn: null,
  recipientKind: 'group',
  caseRef: '',
  groupSite: '',
  households: '',
  evidence: '',
  day: 'today',
  otherDate: '',
};

const key = (memberId: string) => `relief-draft.${memberId.replace(/[^a-zA-Z0-9]/g, '')}`;

export async function readReliefDraft(memberId: string): Promise<ReliefDraft | null> {
  try {
    const text = await readChunked(key(memberId));
    return text ? { ...EMPTY_DRAFT, ...(JSON.parse(text) as Partial<ReliefDraft>) } : null;
  } catch {
    return null;
  }
}

export async function saveReliefDraft(memberId: string, draft: ReliefDraft): Promise<void> {
  try {
    await writeChunked(key(memberId), JSON.stringify(draft));
  } catch {
    // The form keeps working from memory.
  }
}

export async function clearReliefDraft(memberId: string): Promise<void> {
  try {
    await removeChunked(key(memberId));
  } catch {
    // Already gone.
  }
}

/** YYYY-MM-DD in Sri Lankan time, `daysAgo` days back. */
export function localDay(daysAgo: number, now: Date = new Date()): string {
  return new Date(now.getTime() + (5 * 60 + 30) * 60_000 - daysAgo * 86_400_000).toISOString().slice(0, 10);
}
