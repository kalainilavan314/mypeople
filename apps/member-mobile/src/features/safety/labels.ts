import type { DisasterAlert, DisasterSeverity, ReliefTask, SafetyContact, SafetyHelpNeed, ShelterStatus } from '@my-people/api-client';
import type { Tone } from '@my-people/mobile-ui';

/** A warning is red, a watch amber; an advisory stays calm. The words (m.safety.severity_<key>) carry the meaning. */
export const SEVERITY_TONES: Record<DisasterSeverity, Tone> = { advisory: 'neutral', watch: 'pending', warning: 'error' };

export const SHELTER_TONES: Record<ShelterStatus, Tone> = { open: 'verified', full: 'pending', closed: 'neutral' };

export const ALERT_STATE_TONES: Record<DisasterAlert['state'], Tone> = { current: 'pending', expired: 'neutral', withdrawn: 'neutral' };

/** M36: what kind of urgent help; words are m.safety.need_<key>. The same list as the API's HELP_NEEDS. */
export const HELP_NEEDS: readonly SafetyHelpNeed[] = ['food_water', 'shelter', 'evacuation', 'medical', 'missing_person', 'other'];

/** Needs that are a call to emergency services first; the form says so before anything else. */
export const CALL_FIRST: ReadonlySet<SafetyHelpNeed> = new Set(['evacuation', 'medical', 'missing_person']);

export const RELIEF_TASKS: readonly ReliefTask[] = [
  'distribution',
  'cooking',
  'transport',
  'shelter_support',
  'cleaning',
  'loading',
  'first_aid',
];

/** How long a member offers relief help, instead of typing a date (the API takes up to 90 days). */
export const OFFER_WEEKS = [1, 2, 4, 12] as const;

export const HELP_LIMITS = { detailsMin: 10, detailsMax: 2000, nameMin: 2, nameMax: 120, peopleMax: 500 } as const;

/**
 * The official emergency numbers, kept in the app so they show without a connection (M36: "numbers
 * offline"). The same list as the API's EMERGENCY_CONTACTS (FR-AST-003, FR-DIS-003); the screens use
 * the server's copy whenever it has loaded.
 */
export const OFFLINE_EMERGENCY_CONTACTS: readonly SafetyContact[] = [
  { number: '119', nameEn: 'Police emergency', nameTa: 'பொலிஸ் அவசர சேவை' },
  { number: '1990', nameEn: 'Suwa Seriya ambulance', nameTa: 'சுவ செரிய அம்புலன்ஸ்' },
  { number: '117', nameEn: 'Disaster Management Centre', nameTa: 'அனர்த்த முகாமைத்துவ நிலையம்' },
  { number: '1929', nameEn: 'Child protection (NCPA)', nameTa: 'சிறுவர் பாதுகாப்பு (NCPA)' },
  { number: '1938', nameEn: "Women's helpline", nameTa: 'பெண்கள் உதவி இலக்கம்' },
];

/** The date `weeks` from today, as YYYY-MM-DD in Sri Lankan time. */
export function weeksFromToday(weeks: number, now: Date = new Date()): string {
  const local = new Date(now.getTime() + (5 * 60 + 30) * 60_000 + weeks * 7 * 86_400_000);
  return local.toISOString().slice(0, 10);
}
