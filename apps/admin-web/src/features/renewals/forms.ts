import type { CertificateKind, CertificateStatus, RenewalPhase } from '@my-people/api-client';

import { text, uuidOrNull, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the certificates API uses, and the one the dashboard's own checks use too. */
export const CERTIFICATE_REFUSED = 'certificate_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

/** D25 lists these four; "confirmed" is a cycle that is done and never listed as due. */
export const PHASES = ['upcoming', 'due', 'grace', 'lapsed'] as const satisfies readonly RenewalPhase[];
export type ListedPhase = (typeof PHASES)[number];
export const PHASE_LABELS: Readonly<Record<RenewalPhase, Words>> = {
  upcoming: { ta: 'இன்னும் காலம் வரவில்லை', en: 'Not due yet' },
  due: { ta: 'உறுதிப்படுத்த வேண்டியது', en: 'Due' },
  grace: { ta: 'சலுகைக் காலம்', en: 'Grace period' },
  lapsed: { ta: 'காலாவதியானது', en: 'Lapsed' },
  confirmed: { ta: 'உறுதிப்படுத்தப்பட்டது', en: 'Confirmed' },
};
export const PHASE_TONES: Readonly<Record<RenewalPhase, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  upcoming: 'neutral',
  due: 'waiting',
  grace: 'waiting',
  lapsed: 'refused',
  confirmed: 'done',
};

export const KINDS: readonly CertificateKind[] = ['membership', 'event_participation', 'volunteer_service'];
export const KIND_LABELS: Readonly<Record<CertificateKind, Words>> = {
  membership: { ta: 'உறுப்புரிமைச் சான்றிதழ்', en: 'Membership certificate' },
  event_participation: { ta: 'நிகழ்வுப் பங்கேற்புச் சான்றிதழ்', en: 'Event participation certificate' },
  volunteer_service: { ta: 'தன்னார்வ சேவைச் சான்றிதழ்', en: 'Volunteer service certificate' },
};

export const STATUSES: readonly CertificateStatus[] = ['valid', 'revoked', 'superseded'];
export const STATUS_LABELS: Readonly<Record<CertificateStatus, Words>> = {
  valid: { ta: 'செல்லுபடியானது', en: 'Valid' },
  revoked: { ta: 'மீளப்பெறப்பட்டது', en: 'Revoked' },
  superseded: { ta: 'புதியதால் மாற்றப்பட்டது', en: 'Superseded' },
};
export const STATUS_TONES: Readonly<Record<CertificateStatus, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  valid: 'done',
  revoked: 'refused',
  superseded: 'neutral',
};

export const CERTIFICATE_TARGETS: ProblemTargets = {
  member_code_required: 'memberCode',
  kind_required: 'kind',
  certificate_event_required: 'eventId',
  no_attendance_recorded: 'eventId',
  no_completed_assignments: 'kind',
  already_issued: 'memberCode',
  identity_not_verified: 'memberCode',
  membership_not_active: 'memberCode',
  reason_required: 'reason',
};

export const REASON_MIN = 3;
export const REASON_MAX = 500;

/** A filter value from the address, or undefined when it is not one of the listed values. */
export function oneOf<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
  return values.find((item) => item === value);
}

/** A CT- reference or member ID typed in the search box: trimmed, at most 40 characters, or undefined. */
export function searchRef(value: string | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed && trimmed.length <= 40 && /^[A-Za-z0-9-]+$/.test(trimmed) ? trimmed : undefined;
}

/**
 * D25 issue: a member ID, the kind, and the event for an event-participation certificate (its id from
 * the member's attended events). The API checks the member's area, eligibility and that none is valid.
 */
export function readIssue(form: FormLike): Read<{ memberCode: string; kind: CertificateKind; eventId?: string }> {
  const memberCode = text(form, 'memberCode');
  const kind = KINDS.find((item) => item === text(form, 'kind'));
  const eventId = uuidOrNull(form, 'eventId');
  const problems = [
    ...(memberCode.length >= 3 && memberCode.length <= 40 ? [] : ['member_code_required']),
    ...(kind ? [] : ['kind_required']),
    ...(kind === 'event_participation' && !eventId ? ['certificate_event_required'] : []),
  ];
  if (problems.length > 0 || !kind) return { input: null, problems };
  return { input: { memberCode, kind, ...(kind === 'event_participation' && eventId ? { eventId } : {}) }, problems };
}

/** FR-RNW-008: every revocation and reissue carries a reason (3 to 500 characters), kept with the certificate. */
export function readReason(form: FormLike): Read<string> {
  const reason = text(form, 'reason');
  return reason.length >= REASON_MIN && reason.length <= REASON_MAX
    ? { input: reason, problems: [] }
    : { input: null, problems: ['reason_required'] };
}
