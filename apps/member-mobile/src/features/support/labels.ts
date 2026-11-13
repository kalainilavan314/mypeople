import type { MySupportRequest, SupportAppeal, SupportCategory } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

/** The ten categories (FR-AST-002); words are m.support.category_<key>. */
export const SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  'food',
  'low_income',
  'unemployment',
  'education',
  'disability_access',
  'elderly_care',
  'housing',
  'emergency_needs',
  'vocational_training',
  'livelihood',
];

/** Quiet colours for a private matter; the words (m.support.state_<state>) carry the meaning. */
export const STATE_TONES: Record<MySupportRequest['state'], Tone> = {
  screening: 'neutral',
  assessment: 'pending',
  decided: 'verified',
  closed: 'neutral',
  withdrawn: 'neutral',
};

export const APPEAL_TONES: Record<SupportAppeal['state'], Tone> = {
  open: 'pending',
  upheld: 'neutral',
  changed: 'verified',
};

/** The API's limits (SupportRequestIn, AppealIn). */
export const LIMITS = {
  summaryMin: 10,
  summaryMax: 3000,
  nameMin: 2,
  nameMax: 120,
  householdMax: 120,
  appealMin: 10,
  appealMax: 2000,
} as const;

/** A Sri Lankan number with an optional +, 9 to 15 digits and spaces, as the API accepts it. */
export const PHONE = /^\+?[0-9 ]{9,15}$/;

export function isSupportCategory(value: string | undefined): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((category) => category === value);
}
