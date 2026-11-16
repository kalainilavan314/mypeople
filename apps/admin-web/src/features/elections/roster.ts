import type { RosterShiftInput } from '@my-people/api-client';

import { colomboDateTime, readArea, text, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the election roster API uses, and the one the dashboard's own checks use too. */
export const ROSTER_REFUSED = 'roster_refused';

export const ROSTER_TARGETS: ProblemTargets = {
  role_required: 'roleTa',
  site_required: 'siteTa',
  starts_at_required: 'startsAt',
  ends_at_required: 'endsAt',
  ends_before_start: 'endsAt',
  shift_places_required: 'places',
  area_required: 'area',
  unknown_area: 'area',
  outside_the_election_area: 'area',
  code_required: 'memberCode',
  member_not_found: 'memberCode',
  membership_not_active: 'memberCode',
  member_outside_shift_area: 'memberCode',
  already_offered: 'memberCode',
  reason_required: 'reason',
  message_required: 'bodyTa',
};

export const ASSIGNMENT_LABELS: Readonly<Record<string, { ta: string; en: string }>> = {
  offered: { ta: 'பதிலுக்காகக் காத்திருக்கிறது', en: 'Offered, waiting for an answer' },
  accepted: { ta: 'ஏற்றுக்கொண்டார்', en: 'Accepted' },
  declined: { ta: 'மறுத்தார்', en: 'Declined' },
  cancelled: { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' },
};

/** FR-ELX-006: a duty shift in a declared period: role and site in both languages, its area, times and places. */
export function readShift(form: FormLike, periodId: string): { input: RosterShiftInput | null; problems: string[] } {
  const t = (name: string) => text(form, name);
  const startsAt = colomboDateTime(t('startsAt'));
  const endsAt = colomboDateTime(t('endsAt'));
  const places = wholeNumber(t('places'), 1, 200);
  const area = readArea(t('area'));
  const problems = [
    ...(t('roleTa').length >= 3 && t('roleEn').length >= 3 ? [] : ['role_required']),
    ...(t('siteTa').length >= 3 && t('siteEn').length >= 3 ? [] : ['site_required']),
    ...(startsAt ? [] : ['starts_at_required']),
    ...(endsAt ? [] : ['ends_at_required']),
    ...(startsAt && endsAt && endsAt <= startsAt ? ['ends_before_start'] : []),
    ...(places === null ? ['shift_places_required'] : []),
    ...(area ? [] : ['area_required']),
  ];
  if (problems.length > 0 || !startsAt || !endsAt || places === null || !area) return { input: null, problems };
  return {
    input: { periodId, roleTa: t('roleTa'), roleEn: t('roleEn'), siteTa: t('siteTa'), siteEn: t('siteEn'), area, startsAt, endsAt, places },
    problems,
  };
}

/** The member ID as printed on the card: letters, digits and dashes, in capitals. */
export function memberCodeFrom(form: FormLike): string | null {
  const code = text(form, 'memberCode').toUpperCase();
  return /^[A-Z0-9-]{3,30}$/.test(code) ? code : null;
}

/** FR-ELX-009: the period report's figures with their labels, in a fixed order. */
export const REPORT_LABELS: readonly { key: 'shifts' | 'rosterAssignments' | 'rosterChanges' | 'rosterMessages' | 'broadcastsSent' | 'contentPublished' | 'silenceBlocks'; ta: string; en: string }[] = [
  { key: 'shifts', ta: 'பணி நேரங்கள்', en: 'Duty shifts' },
  { key: 'rosterAssignments', ta: 'பணி ஒதுக்கீடுகள்', en: 'Roster assignments' },
  { key: 'rosterChanges', ta: 'பணி மாற்றங்கள்', en: 'Roster changes' },
  { key: 'rosterMessages', ta: 'பணிச் செய்திகள்', en: 'Roster messages' },
  { key: 'broadcastsSent', ta: 'அனுப்பப்பட்ட அறிவித்தல்கள்', en: 'Broadcasts sent' },
  { key: 'contentPublished', ta: 'வெளியிடப்பட்ட உள்ளடக்கம்', en: 'Content published' },
  { key: 'silenceBlocks', ta: 'அமைதிக்காலத்தில் தடுக்கப்பட்டவை', en: 'Blocked by the silence period' },
];

/** FR-ELX-009: the words for each kind of audit entry the period report lists; unknown ones show their code. */
export const REPORT_ENTRY_LABELS: Readonly<Record<string, { ta: string; en: string }>> = {
  'messaging.broadcast.sent': { ta: 'அறிவித்தல் அனுப்பப்பட்டது', en: 'Broadcast sent' },
  'events.event.published': { ta: 'நிகழ்வு வெளியிடப்பட்டது', en: 'Event published' },
  'gallery.album.published': { ta: 'படத்தொகுப்பு வெளியிடப்பட்டது', en: 'Album published' },
  'promise.published': { ta: 'வாக்குறுதி வெளியிடப்பட்டது', en: 'Promise published' },
  'scorecard.published': { ta: 'மதிப்பீட்டு அட்டை வெளியிடப்பட்டது', en: 'Scorecard published' },
  'election.silence.blocked': { ta: 'அமைதிக்காலத்தில் தடுக்கப்பட்டது', en: 'Blocked by the silence period' },
  'election.roster.shift_created': { ta: 'பணி நேரம் உருவாக்கப்பட்டது', en: 'Shift created' },
  'election.roster.offered': { ta: 'பணி வழங்கப்பட்டது', en: 'Shift offered' },
  'election.roster.accepted': { ta: 'பணி ஏற்றுக்கொள்ளப்பட்டது', en: 'Shift accepted' },
  'election.roster.declined': { ta: 'பணி மறுக்கப்பட்டது', en: 'Shift declined' },
  'election.roster.shift_cancelled': { ta: 'பணி நேரம் இரத்து செய்யப்பட்டது', en: 'Shift cancelled' },
  'election.roster.message_sent': { ta: 'பணிச் செய்தி அனுப்பப்பட்டது', en: 'Roster message sent' },
  'election.roster.checked_in': { ta: 'பணிக்கு வருகை பதிவுசெய்யப்பட்டது', en: 'Checked in' },
  'election.roster.checked_out': { ta: 'பணியிலிருந்து வெளியேறியது பதிவுசெய்யப்பட்டது', en: 'Checked out' },
};

/** The words for an audit entry in the period report: its label, or its code when it has none. */
export function reportEntryLabel(action: string): { ta: string; en: string } {
  return REPORT_ENTRY_LABELS[action] ?? { ta: action, en: action };
}
