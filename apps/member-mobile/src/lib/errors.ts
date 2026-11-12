import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { en } from '@/i18n/en';

export class ImagePreparationError extends Error {
  constructor() {
    super('The selected image could not be prepared for upload');
    this.name = 'ImagePreparationError';
  }
}

/**
 * The member-facing message for a failed request: the API's error code when
 * we have words for it, "unable to reach the server" when there was no
 * answer, and a plain fallback otherwise. Never the raw code.
 */
export function errorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ImagePreparationError) return t('m.errors.unsupported_type');
  if (!(error instanceof ApiError)) return t('m.common.offline');
  if (error.code === 'too_many_attempts' && error.retryAfter) {
    return t('m.errors.too_many_attempts', { minutes: Math.max(1, Math.ceil(error.retryAfter / 60)) });
  }
  // Some problems name the item after a colon ("missing:nic_front"); the words are per kind.
  const kinds = [...new Set(error.problems.map((problem) => problem.split(':')[0]))];
  const known = kinds.filter((problem) => problem in en.problems);
  if (known.length > 0) return known.map((problem) => t(`m.problems.${problem}`)).join('\n');
  if (error.code in en.errors) return t(`m.errors.${error.code}`);
  return t('m.errors.unknown');
}

/**
 * No answer reached the app (no network, a timeout) or the server failed, as
 * opposed to the server refusing the request: trying again later can work.
 */
export function noAnswer(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 408 || error.status >= 500;
}

/** Problem codes from a refused form, e.g. ["password_too_short"], to show beside the fields. */
export function problemsOf(error: unknown): string[] {
  return error instanceof ApiError ? error.problems : [];
}
