import type {
  AppointmentContactPreference,
  AppointmentNeed,
  AppointmentSlot,
  AppointmentState,
} from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';
import { formatDate } from '@my-people/mobile-ui';

/** FR-APT-004: the accessibility and language needs a member can name; words are m.representatives.need_<key>. */
export const NEEDS: readonly AppointmentNeed[] = [
  'tamil_interpreter',
  'sinhala_interpreter',
  'english_interpreter',
  'sign_language',
  'step_free_access',
  'large_print',
  'someone_with_me',
];

export const CONTACT_PREFERENCES: readonly AppointmentContactPreference[] = ['in_app', 'phone_call', 'sms'];

/** The state pill's colour; the words (m.representatives.state_<state>) always go with it. */
export const STATE_TONES: Record<AppointmentState, Tone> = {
  booked: 'pending',
  completed: 'verified',
  no_show: 'neutral',
  cancelled: 'error',
};

export const LIMITS = { topicMin: 5, topicMax: 500, needsNoteMax: 300, cancelReasonMax: 500 } as const;

/** A Sri Lankan number, as the API checks it: 0771234567 or +94771234567, spaces allowed. */
export const PHONE = /^(\+94|0)[0-9]{9}$/;
export const CASE_REF = /^[A-Z]{2,4}-[0-9A-Z-]{3,20}$/;

export function normalisePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** Slots under the Sri Lankan date they fall on, in time order. */
export function slotsByDay<T extends Pick<AppointmentSlot, 'startsAt'>>(slots: readonly T[], language: string): [string, T[]][] {
  const days = new Map<string, T[]>();
  for (const slot of [...slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const day = formatDate(slot.startsAt, language);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days.entries()];
}

export function hasStarted(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() <= now;
}
