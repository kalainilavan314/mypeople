import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/staff/en';

import { errorMessage } from '../errors';

/** The coordinator's words for a refused decision or answer ("volunteer_refused" with problems). */
export function volunteerErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const kinds = [...new Set(error.problems.map((problem) => problem.split(':')[0]))];
    const known = kinds.filter((kind) => kind in en.volunteers.problems);
    if (known.length > 0) return known.map((kind) => t(`s.volunteers.problems.${kind}`)).join('\n');
  }
  return errorMessage(t, error);
}
