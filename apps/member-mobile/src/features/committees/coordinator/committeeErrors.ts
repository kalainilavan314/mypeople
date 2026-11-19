import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/staff/en';

import { errorMessage } from '../../staff/errors';

/** The coordinator's words for a refused action ("committee_refused" with problems, or a 403 code). */
export function committeeErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const kinds = [...new Set([...error.problems, error.code].map((problem) => problem.split(':')[0]))];
    const known = kinds.filter((kind) => kind in en.committees.problems);
    if (known.length > 0) return known.map((kind) => t(`s.committees.problems.${kind}`)).join('\n');
  }
  return errorMessage(t, error);
}
