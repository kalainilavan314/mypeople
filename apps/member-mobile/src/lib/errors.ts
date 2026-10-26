import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/en';

/**
 * The member-facing message for a failed request: the API's error code when
 * we have words for it, "unable to reach the server" when there was no
 * answer, and a plain fallback otherwise. Never the raw code.
 */
export function errorMessage(t: TFunction, error: unknown): string {
  if (!(error instanceof ApiError)) return t('m.common.offline');
  if (error.code === 'too_many_attempts' && error.retryAfter) {
    return t('m.errors.too_many_attempts', { minutes: Math.max(1, Math.ceil(error.retryAfter / 60)) });
  }
  const known = error.problems.filter((problem) => problem in en.problems);
  if (known.length > 0) return known.map((problem) => t(`m.problems.${problem}`)).join('\n');
  if (error.code in en.errors) return t(`m.errors.${error.code}`);
  return t('m.errors.unknown');
}

/** Problem codes from a refused form, e.g. ["password_too_short"], to show beside the fields. */
export function problemsOf(error: unknown): string[] {
  return error instanceof ApiError ? error.problems : [];
}
