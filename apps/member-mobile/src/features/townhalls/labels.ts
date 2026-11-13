import type { TownHall, TownHallQuestion } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

export const STATE_TONES: Record<TownHall['state'], Tone> = {
  draft: 'neutral',
  scheduled: 'pending',
  live: 'verified',
  ended: 'neutral',
  cancelled: 'error',
};

export const QUESTION_TONES: Record<TownHallQuestion['state'], Tone> = {
  pending: 'pending',
  approved: 'verified',
  rejected: 'error',
  merged: 'neutral',
};

/** The API's limits on a question (QuestionIn). */
export const QUESTION_MIN = 5;
export const QUESTION_MAX = 500;

/** "12:05" for an answer given 725 seconds into the session. */
export function minutesSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** One outcome recorded after the session (OutcomeIn): words, and a promise or case it led to. */
export type Outcome = { textEn: string; textTa: string; promiseId: string | null; caseNumber: string | null };

export function readOutcomes(raw: Record<string, unknown>[]): Outcome[] {
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const optional = (value: unknown) => (typeof value === 'string' && value ? value : null);
  return raw
    .map((item) => ({
      textEn: text(item.textEn),
      textTa: text(item.textTa),
      promiseId: optional(item.promiseId),
      caseNumber: optional(item.caseNumber),
    }))
    .filter((item) => item.textEn !== '');
}
