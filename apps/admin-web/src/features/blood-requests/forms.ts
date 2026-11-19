import type { BloodGroup, BloodOutcome, BloodPartnerInput, BloodRequestInput, BloodUrgency } from '@my-people/api-client';

import { colomboDateTime, text, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the blood donor API uses, and the one the dashboard's own checks use too. */
export const DONOR_REFUSED = 'donor_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

export const BLOOD_GROUPS: readonly BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const URGENCIES: readonly BloodUrgency[] = ['routine', 'urgent', 'critical'];
export const URGENCY_LABELS: Readonly<Record<BloodUrgency, Words>> = {
  routine: { ta: 'வழமையானது', en: 'Routine' },
  urgent: { ta: 'அவசரம்', en: 'Urgent' },
  critical: { ta: 'மிக அவசரம்', en: 'Critical' },
};
export const URGENCY_TONES: Readonly<Record<BloodUrgency, 'neutral' | 'waiting' | 'refused'>> = {
  routine: 'neutral',
  urgent: 'waiting',
  critical: 'refused',
};

export const OUTCOMES: readonly BloodOutcome[] = ['fulfilled', 'partly_fulfilled', 'not_needed', 'unfulfilled'];
export const OUTCOME_LABELS: Readonly<Record<BloodOutcome, Words>> = {
  fulfilled: { ta: 'நிறைவேறியது', en: 'Fulfilled' },
  partly_fulfilled: { ta: 'பகுதியளவில் நிறைவேறியது', en: 'Partly fulfilled' },
  not_needed: { ta: 'இனி தேவையில்லை', en: 'No longer needed' },
  unfulfilled: { ta: 'நிறைவேறவில்லை', en: 'Not fulfilled' },
};

export const REQUEST_STATE_LABELS: Readonly<Record<string, Words>> = {
  awaiting_approval: { ta: 'அடுக்கு 5 அங்கீகாரத்துக்காகக் காத்திருக்கிறது', en: 'Waiting for Tier 5 approval' },
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  expired: { ta: 'நேரம் கடந்துவிட்டது', en: 'Past its time' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
  refused: { ta: 'மறுக்கப்பட்டது', en: 'Refused' },
};

export const PARTNER_KIND_LABELS: Readonly<Record<BloodPartnerInput['kind'], Words>> = {
  hospital: { ta: 'வைத்தியசாலை', en: 'Hospital' },
  blood_bank: { ta: 'இரத்த வங்கி', en: 'Blood bank' },
};

export const CONTACT_METHOD_LABELS: Readonly<Record<string, string>> = { call: 'phone call', sms: 'SMS', whatsapp: 'WhatsApp' };

export const BLOOD_TARGETS: ProblemTargets = {
  blood_group_required: 'bloodGroup',
  area_required: 'districtCode',
  unknown_area: 'districtCode',
  broad_area_required: 'districtCode',
  district_required: 'districtCode',
  units_invalid: 'units',
  urgency_required: 'urgency',
  needed_by_required: 'neededBy',
  needed_by_in_past: 'neededBy',
  needed_by_too_far: 'neededBy',
  outcome_required: 'outcome',
  partner_name_required: 'name',
  partner_kind_required: 'kind',
  agreement_required: 'agreementRef',
  member_code_required: 'memberCode',
  account_not_found: 'memberCode',
  identity_not_verified: 'memberCode',
  already_a_requester: 'memberCode',
  reason_required: 'reason',
  decision_required: 'decision',
};

const CODE = /^[A-Za-z0-9-]{2,20}$/;

/** FR-BLD-003, 004: a blood group, a broad area (a district, or a DS division in it), units, urgency and when. */
export function readRequest(form: FormLike): Read<BloodRequestInput> {
  const bloodGroup = BLOOD_GROUPS.find((group) => group === text(form, 'bloodGroup'));
  const urgency = URGENCIES.find((item) => item === text(form, 'urgency'));
  const units = wholeNumber(text(form, 'units'), 1, 20);
  const neededBy = colomboDateTime(text(form, 'neededBy'));
  const district = text(form, 'districtCode');
  const ds = text(form, 'dsCode');
  const problems = [
    ...(bloodGroup ? [] : ['blood_group_required']),
    ...(CODE.test(district) || CODE.test(ds) ? [] : ['area_required']),
    ...(units === null ? ['units_invalid'] : []),
    ...(urgency ? [] : ['urgency_required']),
    ...(neededBy ? [] : ['needed_by_required']),
  ];
  if (problems.length > 0 || !bloodGroup || !urgency || units === null || !neededBy) return { input: null, problems };
  const area = CODE.test(ds) ? { level: 'ds' as const, code: ds } : { level: 'district' as const, code: district };
  return { input: { bloodGroup, area, units, urgency, neededBy }, problems };
}

/** DEP-18, OD-39: an organisation with a signed agreement on file, in its district. */
export function readPartner(form: FormLike): Read<BloodPartnerInput> {
  const name = text(form, 'name');
  const kind = text(form, 'kind');
  const districtCode = text(form, 'districtCode');
  const agreementRef = text(form, 'agreementRef');
  const problems = [
    ...(name.length >= 3 ? [] : ['partner_name_required']),
    ...(kind === 'hospital' || kind === 'blood_bank' ? [] : ['partner_kind_required']),
    ...(CODE.test(districtCode) ? [] : ['district_required']),
    ...(agreementRef.length >= 3 ? [] : ['agreement_required']),
  ];
  if (problems.length > 0 || (kind !== 'hospital' && kind !== 'blood_bank')) return { input: null, problems };
  return { input: { name, kind, districtCode, agreementRef }, problems };
}

/** FR-BLD-008: approve, or refuse with the reason. */
export function readDecision(form: FormLike): Read<{ approve: boolean; reason?: string }> {
  const decision = text(form, 'decision');
  const reason = text(form, 'reason');
  if (decision !== 'approve' && decision !== 'refuse') return { input: null, problems: ['decision_required'] };
  if (decision === 'refuse' && reason.length < 5) return { input: null, problems: ['reason_required'] };
  return { input: { approve: decision === 'approve', reason: reason || undefined }, problems: [] };
}

/** A `datetime-local` value some hours from now in Sri Lankan time, for the "needed by" field. */
export function hoursFromNow(hours: number, now: Date = new Date()): string {
  return new Date(now.getTime() + (5 * 60 + 30 + hours * 60) * 60_000).toISOString().slice(0, 16);
}

/** What the partner sees of a request's state: open requests past their time read as expired. */
export function stateKey(state: string, expired: boolean): string {
  return state === 'open' && expired ? 'expired' : state;
}
