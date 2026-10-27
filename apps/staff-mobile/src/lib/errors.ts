import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/en';

/** The staff-facing message for a failed request: never the raw code. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (!(error instanceof ApiError)) return t('s.errors.offline');
  if ((error.code === 'too_many_attempts' || error.code === 'mfa_locked') && error.retryAfter) {
    return t(`s.errors.${error.code}`, { minutes: Math.max(1, Math.ceil(error.retryAfter / 60)) });
  }
  if (error.code in en.errors) return t(`s.errors.${error.code}`);
  return t('s.errors.unknown');
}
