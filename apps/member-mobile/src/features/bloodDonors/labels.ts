import type { BloodContactMethod, BloodNotice, BloodUrgency } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

export const URGENCY_TONES: Record<BloodUrgency, Tone> = { routine: 'neutral', urgent: 'pending', critical: 'error' };

export const NOTICE_STATE_TONES: Record<BloodNotice['state'], Tone> = { open: 'pending', closed: 'neutral', expired: 'neutral' };

export const ANSWER_TONES: Record<BloodNotice['answer'], Tone> = { notified: 'pending', accepted: 'verified', declined: 'neutral' };

export const CONTACT_METHODS: readonly BloodContactMethod[] = ['call', 'sms', 'whatsapp'];

/** "Available now", a pause of some months, or not available; words are m.bloodDonors.availability_<key>. */
export const AVAILABILITY = ['now', 'pause1', 'pause3', 'pause6', 'off'] as const;
export type Availability = (typeof AVAILABILITY)[number];
const PAUSE_MONTHS: Partial<Record<Availability, number>> = { pause1: 1, pause3: 3, pause6: 6 };

/** The API's available flag and pause date for a choice; the pause ends on the date given. */
export function availabilityValues(choice: Availability, now: Date = new Date()): { available: boolean; pausedUntil: string | null } {
  if (choice === 'off') return { available: false, pausedUntil: null };
  const months = PAUSE_MONTHS[choice];
  if (!months) return { available: true, pausedUntil: null };
  const until = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  until.setUTCMonth(until.getUTCMonth() + months);
  return { available: true, pausedUntil: until.toISOString().slice(0, 10) };
}

/** The choice that matches a saved record: paused while the date is ahead, else on or off. */
export function availabilityOf(available: boolean, pausedUntil: string | null, now: Date = new Date()): Availability {
  if (!available) return 'off';
  if (!pausedUntil || new Date(`${pausedUntil}T23:59:59+05:30`) < now) return 'now';
  const months = (new Date(pausedUntil).getTime() - now.getTime()) / (30 * 86_400_000);
  return months <= 1.5 ? 'pause1' : months <= 4 ? 'pause3' : 'pause6';
}

export const DONOR_LIMITS = { nameMin: 2, nameMax: 120 } as const;
