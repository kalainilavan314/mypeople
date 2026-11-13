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
 * Screens whose refusals need their own words for a code other screens share: "identity_not_verified"
 * reads "can report a concern" on the issue screens but "can offer to help" on volunteering. Each
 * scope's words are m.<scope>.refusals; any other code uses the shared m.problems or m.errors.
 */
export type RefusalScope =
  | 'volunteer'
  | 'ideas'
  | 'surveys'
  | 'proposals'
  | 'referrals'
  | 'promises'
  | 'support'
  | 'townHalls'
  | 'official';

/**
 * The member-facing message for a failed request: the API's error code when
 * we have words for it, "unable to reach the server" when there was no
 * answer, and a plain fallback otherwise. Never the raw code.
 */
export function errorMessage(t: TFunction, error: unknown, scope?: RefusalScope): string {
  if (error instanceof ImagePreparationError) return t('m.errors.unsupported_type');
  if (!(error instanceof ApiError)) return t('m.common.offline');
  if (error.code === 'too_many_attempts' && error.retryAfter) {
    return t('m.errors.too_many_attempts', { minutes: Math.max(1, Math.ceil(error.retryAfter / 60)) });
  }
  const scoped: Readonly<Record<string, string>> = scope ? en[scope].refusals : {};
  const words = (code: string) => (code in scoped ? t(`m.${scope}.refusals.${code}`) : t(`m.problems.${code}`));
  // Some problems name the item after a colon ("missing:nic_front"); the words are per kind.
  const kinds = [...new Set(error.problems.map((problem) => problem.split(':')[0]))];
  const known = kinds.filter((problem) => problem in scoped || problem in en.problems);
  if (known.length > 0) return known.map(words).join('\n');
  if (error.code in scoped) return words(error.code);
  if (error.code in en.errors) return t(`m.errors.${error.code}`);
  return t('m.errors.unknown');
}

/** A Phase 2 module is switched off: the API answers 404 "feature_unavailable", a calm "not open yet". */
export function featureClosed(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.code === 'feature_unavailable';
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
