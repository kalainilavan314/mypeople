import type {
  AppointmentFollowUpInput,
  AppointmentNeed,
  AppointmentSlotSeriesInput,
  AppointmentState,
  RepresentativeCreateInput,
  RepresentativeOwnProfileInput,
  RepresentativeProfileInput,
  RepresentativeProfileState,
} from '@my-people/api-client';

import { colomboDateTime, text, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the appointments API uses, and the one the dashboard's own checks use too. */
export const APPOINTMENT_REFUSED = 'appointment_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
type Tone = 'waiting' | 'done' | 'refused' | 'neutral';

export const PROFILE_STATES: readonly RepresentativeProfileState[] = ['draft', 'published', 'withdrawn'];
export const PROFILE_STATE_LABELS: Readonly<Record<RepresentativeProfileState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  published: { ta: 'வெளியிடப்பட்டது', en: 'Published' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};
export const PROFILE_STATE_TONES: Readonly<Record<RepresentativeProfileState, Tone>> = {
  draft: 'neutral',
  published: 'done',
  withdrawn: 'neutral',
};

export const SLOT_MODES = ['in_person', 'phone_call'] as const;
export type SlotMode = (typeof SLOT_MODES)[number];
export const SLOT_MODE_LABELS: Readonly<Record<SlotMode, Words>> = {
  in_person: { ta: 'நேரில்', en: 'In person' },
  phone_call: { ta: 'தொலைபேசி அழைப்பு', en: 'Phone call' },
};

export const APPOINTMENT_STATE_LABELS: Readonly<Record<AppointmentState, Words>> = {
  booked: { ta: 'பதிவு செய்யப்பட்டது', en: 'Booked' },
  cancelled: { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' },
  completed: { ta: 'சந்திப்பு நடந்தது', en: 'Met' },
  no_show: { ta: 'வரவில்லை', en: 'Did not come' },
};
export const APPOINTMENT_STATE_TONES: Readonly<Record<AppointmentState, Tone>> = {
  booked: 'waiting',
  cancelled: 'neutral',
  completed: 'done',
  no_show: 'refused',
};

export const NEED_LABELS: Readonly<Record<AppointmentNeed, Words>> = {
  step_free_access: { ta: 'படிகள் இல்லாத அணுகல்', en: 'Step-free access' },
  sign_language: { ta: 'சைகை மொழி', en: 'Sign language' },
  tamil_interpreter: { ta: 'தமிழ் மொழிபெயர்ப்பாளர்', en: 'Tamil interpreter' },
  sinhala_interpreter: { ta: 'சிங்கள மொழிபெயர்ப்பாளர்', en: 'Sinhala interpreter' },
  english_interpreter: { ta: 'ஆங்கில மொழிபெயர்ப்பாளர்', en: 'English interpreter' },
  large_print: { ta: 'பெரிய எழுத்து', en: 'Large print' },
  someone_with_me: { ta: 'உடன் ஒருவர் வருவார்', en: 'Someone coming with them' },
};

export const CONTACT_LABELS: Readonly<Record<'in_app' | 'phone_call' | 'sms', Words>> = {
  in_app: { ta: 'செயலியில் மட்டும்', en: 'In the app only' },
  phone_call: { ta: 'தொலைபேசி அழைப்பு', en: 'Phone call' },
  sms: { ta: 'குறுஞ்செய்தி', en: 'Text message' },
};

export const PROFILE_TEXT_FIELDS = [
  'memberCode',
  'area',
  'roleTa',
  'roleEn',
  'displayNameTa',
  'displayNameEn',
  'officeHoursTa',
  'officeHoursEn',
  'publicPhone',
  'publicEmail',
  'officeAddressTa',
  'officeAddressEn',
] as const;

export const SLOT_TEXT_FIELDS = ['startsAt', 'minutes', 'count', 'mode', 'placeTa', 'placeEn'] as const;

/**
 * The API's problem codes this module renames, because the shared words for the same code are
 * about another screen ("starts_in_past" reads "the event start time").
 */
export const RENAMED_PROBLEMS: Readonly<Record<string, string>> = {
  starts_in_past: 'slot_starts_in_past',
  note_required: 'follow_up_note_required',
  place_required: 'slot_place_required',
};

export const APPOINTMENT_TARGETS: ProblemTargets = {
  member_code_required: 'memberCode',
  unknown_member_code: 'memberCode',
  profile_exists: 'memberCode',
  area_required: 'area',
  unknown_area: 'area',
  representative_area_level: 'area',
  outside_your_area: 'area',
  role_required: 'roleTa',
  representative_name_required: 'displayNameTa',
  office_hours_required: 'officeHoursTa',
  phone_format: 'publicPhone',
  email_format: 'publicEmail',
  office_address_en_too_short: 'officeAddressEn',
  office_address_ta_too_short: 'officeAddressTa',
  no_contacts: 'publicPhone',
  slot_start_required: 'startsAt',
  slot_starts_in_past: 'startsAt',
  too_far_ahead: 'startsAt',
  overlaps_existing_slot: 'startsAt',
  slot_length: 'minutes',
  too_many_slots: 'count',
  slot_mode_required: 'mode',
  slot_place_required: 'placeTa',
  outcome_required: 'outcome',
  follow_up_note_required: 'note',
  note_too_short: 'note',
  reason_required: 'reason',
};

const PHONE = /^(\+94|0)[0-9]{9}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A phone number as the API stores it: spaces and dashes removed. */
export function normalisePhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/** The routes as typed, with the same checks the API makes (the API checks again). */
function contacts(form: FormLike): { values: Pick<RepresentativeProfileInput, 'publicPhone' | 'publicEmail' | 'officeAddressTa' | 'officeAddressEn'>; problems: string[] } {
  const phone = normalisePhone(text(form, 'publicPhone'));
  const email = text(form, 'publicEmail');
  const addressTa = text(form, 'officeAddressTa');
  const addressEn = text(form, 'officeAddressEn');
  const problems = [
    ...(phone && !PHONE.test(phone) ? ['phone_format'] : []),
    ...(email && !EMAIL.test(email) ? ['email_format'] : []),
    ...(addressTa && addressTa.length < 5 ? ['office_address_ta_too_short'] : []),
    ...(addressEn && addressEn.length < 5 ? ['office_address_en_too_short'] : []),
  ];
  return {
    values: { publicPhone: phone || null, publicEmail: email || null, officeAddressTa: addressTa || null, officeAddressEn: addressEn || null },
    problems,
  };
}

/**
 * D29: the official role, the name shown, the office hours and any public contact routes (shown
 * to members only after the person approves them, BR-143). A new profile also names the person by
 * member ID and the District, DS or GN division it covers (FR-APT-001).
 */
export function readProfile(form: FormLike): Read<RepresentativeProfileInput> {
  const t = (name: string) => text(form, name);
  const routes = contacts(form);
  const pair = (name: string, min: number) => t(`${name}Ta`).length >= min && t(`${name}En`).length >= min;
  const problems = [
    ...(pair('role', 3) ? [] : ['role_required']),
    ...(pair('displayName', 2) ? [] : ['representative_name_required']),
    ...(pair('officeHours', 3) ? [] : ['office_hours_required']),
    ...routes.problems,
  ];
  if (problems.length > 0) return { input: null, problems };
  return {
    input: {
      roleTa: t('roleTa'),
      roleEn: t('roleEn'),
      displayNameTa: t('displayNameTa'),
      displayNameEn: t('displayNameEn'),
      officeHoursTa: t('officeHoursTa'),
      officeHoursEn: t('officeHoursEn'),
      ...routes.values,
    },
    problems,
  };
}

/** An area from the picker as "level:code"; a representative covers a District, DS or GN division. */
export function readRepresentativeArea(value: string): { level: 'district' | 'ds' | 'gn'; code: string } | null | 'wrong_level' {
  const [level, code] = value.split(':', 2);
  const trimmed = (code ?? '').trim();
  if (!level || trimmed.length < 2 || trimmed.length > 20) return null;
  if (level !== 'district' && level !== 'ds' && level !== 'gn') return 'wrong_level';
  return { level, code: trimmed };
}

export function readNewProfile(form: FormLike): Read<RepresentativeCreateInput> {
  const profile = readProfile(form);
  const memberCode = text(form, 'memberCode');
  const area = readRepresentativeArea(text(form, 'area'));
  const problems = [
    ...(memberCode.length >= 3 ? [] : ['member_code_required']),
    ...(area === null ? ['area_required'] : area === 'wrong_level' ? ['representative_area_level'] : []),
    ...profile.problems,
  ];
  if (problems.length > 0 || !profile.input || area === null || area === 'wrong_level') return { input: null, problems };
  return { input: { ...profile.input, memberCode, area }, problems };
}

/** S17 on the web: the person's own office hours and routes, and whether members may see the routes. */
export function readOwnProfile(form: FormLike): Read<RepresentativeOwnProfileInput> {
  const t = (name: string) => text(form, name);
  const routes = contacts(form);
  const showContacts = t('showContacts') === '1';
  const anyRoute = Object.values(routes.values).some(Boolean);
  const problems = [
    ...(t('officeHoursTa').length >= 3 && t('officeHoursEn').length >= 3 ? [] : ['office_hours_required']),
    ...routes.problems,
    ...(showContacts && !anyRoute ? ['no_contacts'] : []),
  ];
  if (problems.length > 0) return { input: null, problems };
  return { input: { officeHoursTa: t('officeHoursTa'), officeHoursEn: t('officeHoursEn'), ...routes.values, showContacts }, problems };
}

/**
 * Consecutive slots of one length from a start in Sri Lankan time (UTC+05:30): 10 to 120 minutes
 * each, 1 to 16 of them. In person needs the place in both languages (an official office).
 */
export function readSlotSeries(form: FormLike): Read<AppointmentSlotSeriesInput> {
  const t = (name: string) => text(form, name);
  const startsAt = colomboDateTime(t('startsAt'));
  const minutes = wholeNumber(t('minutes'), 10, 120);
  const count = wholeNumber(t('count'), 1, 16);
  const mode = SLOT_MODES.find((value) => value === t('mode'));
  const inPerson = mode === 'in_person';
  const problems = [
    ...(startsAt ? [] : ['slot_start_required']),
    ...(minutes === null ? ['slot_length'] : []),
    ...(count === null ? ['too_many_slots'] : []),
    ...(mode ? [] : ['slot_mode_required']),
    ...(inPerson && !(t('placeTa').length >= 3 && t('placeEn').length >= 3) ? ['slot_place_required'] : []),
  ];
  if (problems.length > 0 || !startsAt || minutes === null || count === null || !mode) return { input: null, problems };
  return {
    input: {
      startsAt,
      minutes,
      count,
      mode,
      placeTa: inPerson ? t('placeTa') : null,
      placeEn: inPerson ? t('placeEn') : null,
    },
    problems,
  };
}

/** FR-APT-006: what happened, with the note the member reads (needed when they met). */
export function readFollowUp(form: FormLike): Read<AppointmentFollowUpInput> {
  const outcome = text(form, 'outcome');
  const note = text(form, 'note');
  if (outcome !== 'completed' && outcome !== 'no_show') return { input: null, problems: ['outcome_required'] };
  if (outcome === 'completed' && note.length < 5) return { input: null, problems: ['follow_up_note_required'] };
  if (note && note.length < 5) return { input: null, problems: ['note_too_short'] };
  return { input: { outcome, note: note || null }, problems: [] };
}

/** A reason of at least three characters (withdrawing a profile or a slot, cancelling a booking). */
export function readReason(form: FormLike): Read<string> {
  const reason = text(form, 'reason');
  return reason.length >= 3 ? { input: reason, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** The API's problem codes in this module's own words (see RENAMED_PROBLEMS). */
export function renameProblems(problems: readonly string[]): string[] {
  return problems.map((problem) => RENAMED_PROBLEMS[problem] ?? problem);
}

/** "2026-11-20" for an ISO time, in Sri Lankan time. */
export function colomboDay(iso: string): string {
  return new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

/** Slots grouped by their Sri Lankan day, days and slots in time order (S17's calendar). */
export function groupByDay<T extends { startsAt: string }>(slots: readonly T[]): { day: string; slots: T[] }[] {
  const days = new Map<string, T[]>();
  for (const slot of [...slots].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const day = colomboDay(slot.startsAt);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days.entries()].map(([day, list]) => ({ day, slots: list }));
}

/** The slot's time has started (the API then takes a follow-up, and refuses a cancellation). */
export function hasStarted(startsAt: string, now: Date = new Date()): boolean {
  return Date.parse(startsAt) <= now.getTime();
}

/** "09:30" in Sri Lankan time. */
export function colomboTime(iso: string): string {
  return new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(11, 16);
}

/** The profile as the forms show it: every field as text. */
export function profileValues(profile: object): Record<string, string> {
  const record = profile as Record<string, unknown>;
  return Object.fromEntries(PROFILE_TEXT_FIELDS.map((name) => [name, typeof record[name] === 'string' ? (record[name] as string) : '']));
}
