import type { PrivacyRegisterEntry } from '@my-people/api-client';

import type { TranslationDictionary } from '../../lib/i18n/types.ts';

const DAY_MS = 86_400_000;
// Sri Lanka keeps UTC+05:30 all year; days are counted on its calendar, not the server's.
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export type DueStatus = { kind: 'closed' } | { kind: 'overdue'; days: number } | { kind: 'due'; days: number };

function colomboDay(ms: number): number {
  return Math.floor((ms + COLOMBO_OFFSET_MS) / DAY_MS);
}

/**
 * Where an open request stands against its statutory due date, in Sri Lankan calendar days. A
 * request is overdue from the due moment itself, so the DPO is warned on the day, not the day after.
 */
export function dueStatus(entry: Pick<PrivacyRegisterEntry, 'state' | 'dueAt'>, now: Date): DueStatus {
  if (entry.state !== 'open') return { kind: 'closed' };
  const due = new Date(entry.dueAt).getTime();
  const days = Math.abs(colomboDay(due) - colomboDay(now.getTime()));
  return now.getTime() >= due ? { kind: 'overdue', days } : { kind: 'due', days };
}

export function dueText(status: DueStatus, words: TranslationDictionary['privacy']): string {
  if (status.kind === 'closed') return '';
  if (status.kind === 'overdue') {
    if (status.days === 0) return words.overdueToday;
    return status.days === 1 ? words.overdueByOne : words.overdueByMany.replace('{days}', String(status.days));
  }
  if (status.days === 0) return words.dueToday;
  return status.days === 1 ? words.dueInOne : words.dueInMany.replace('{days}', String(status.days));
}

export function kindText(kind: PrivacyRegisterEntry['kind'], words: TranslationDictionary['privacy']): string {
  return kind === 'closure' ? words.kindClosure : words.kindCopy;
}
