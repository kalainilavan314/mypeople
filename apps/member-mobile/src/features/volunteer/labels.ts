import type { VolunteerOfferState } from '@my-people/api-client';
import { formatDate, formatSpan, type Tone } from '@my-people/mobile-ui';

/** The colour of each offer state's pill; the words (m.profile.activityState_volunteer_offer_*) always go with it. */
export const OFFER_TONES: Record<VolunteerOfferState, Tone> = {
  offered: 'pending',
  confirmed: 'verified',
  declined: 'neutral',
  withdrawn: 'neutral',
  cancelled: 'error',
};

/** "12 Nov 2026, 08:00 – 11:00", or both dates in full when it spans days. */
export function whenText(startsAt: string, endsAt: string, language: string): string {
  const sameDay = formatDate(startsAt, language) === formatDate(endsAt, language);
  return sameDay ? `${formatDate(startsAt, language)}, ${formatSpan(startsAt, endsAt, language)}` : formatSpan(startsAt, endsAt, language);
}

/** The limits the API enforces on a message or change request (ContactIn). */
export const CONTACT_MIN = 5;
export const CONTACT_MAX = 1000;
