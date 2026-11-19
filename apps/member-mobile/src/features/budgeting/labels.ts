import type { BudgetCyclePhase } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

/** The phase pill's colour; the words are m.budgeting.phase_<phase>. */
export const PHASE_TONES: Record<BudgetCyclePhase, Tone> = {
  upcoming: 'pending',
  voting: 'verified',
  counting: 'pending',
  results: 'verified',
  cancelled: 'neutral',
};

/** The receipt code as the API writes it: four groups of four letters and digits. */
export const RECEIPT_PATTERN = /^[A-Z2-7]{4}(-[A-Z2-7]{4}){3}$/;

/** Turnout as a whole percentage, or null before the eligible count is known (KPI-33). */
export function turnoutPercent(ballots: number, eligible: number | null | undefined): number | null {
  if (!eligible || eligible <= 0) return null;
  return Math.round((ballots / eligible) * 100);
}
