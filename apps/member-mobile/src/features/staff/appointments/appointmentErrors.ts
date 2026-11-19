import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/staff/en';
import { errorMessage } from '@/features/staff/errors';

/**
 * The representative-facing words for a refused calendar action: each problem the API names
 * ("overlaps_existing_slot", "note_required"…) has its own sentence in s.appointments.problems;
 * anything else falls back to the Staff section's shared words.
 */
export function appointmentError(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const known = [...new Set(error.problems.map((problem) => problem.split(':')[0] ?? problem))].filter(
      (problem) => problem in en.appointments.problems,
    );
    if (known.length > 0) return known.map((problem) => t(`s.appointments.problems.${problem}`)).join('\n');
  }
  return errorMessage(t, error);
}
