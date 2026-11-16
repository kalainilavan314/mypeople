import type {
  VolunteerOfferDecision,
  VolunteerOpportunityInput,
  VolunteerOpportunityState,
  VolunteerOpportunityUpdate,
} from '@my-people/api-client';

import { checked, colomboDateTime, readArea, text, uuidOrNull, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the volunteering API uses, and the one the dashboard's own checks use too. */
export const VOLUNTEER_REFUSED = 'volunteer_refused';

/** Text written in both languages: each pair is required in Tamil and in English. */
export const TEXT_PAIRS = ['title', 'role', 'description', 'place', 'bring', 'team'] as const;
export type TextPair = (typeof TEXT_PAIRS)[number];

export const TEXT_FIELDS = TEXT_PAIRS.flatMap((pair) => [`${pair}Ta`, `${pair}En`]);

export const MAX_SKILLS = 10;

/** The field each problem points at; the summary links to it and the field repeats it. */
export const VOLUNTEER_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  role_required: 'roleTa',
  description_required: 'descriptionTa',
  place_required: 'placeTa',
  bring_required: 'bringTa',
  team_required: 'teamTa',
  starts_at_required: 'startsAt',
  ends_at_required: 'endsAt',
  starts_in_past: 'startsAt',
  ends_before_start: 'endsAt',
  places_required: 'places',
  unknown_skill: 'skills',
  too_many_skills: 'skills',
  area_required: 'area',
  unknown_area: 'area',
  decision_required: 'decision',
  meeting_point_required: 'meetingPointTa',
  reason_required: 'reason',
  answer_required: 'answer',
};

/** Which states a coordinator may move an opportunity to from each (the API's OPPORTUNITY_MOVES). */
export const OPPORTUNITY_MOVES: Readonly<Record<VolunteerOpportunityState, readonly ('open' | 'closed' | 'cancelled')[]>> = {
  draft: ['open', 'cancelled'],
  open: ['closed', 'cancelled'],
  closed: ['open', 'cancelled'],
  cancelled: [],
};

type Read<T> = { input: T | null; problems: string[] };

function pairs(form: FormLike): { values: Record<string, string>; problems: string[] } {
  const values: Record<string, string> = {};
  const problems: string[] = [];
  for (const pair of TEXT_PAIRS) {
    values[`${pair}Ta`] = text(form, `${pair}Ta`);
    values[`${pair}En`] = text(form, `${pair}En`);
    if (!values[`${pair}Ta`] || !values[`${pair}En`]) problems.push(`${pair}_required`);
  }
  return { values, problems };
}

function times(form: FormLike): { startsAt: string | null; endsAt: string | null; problems: string[] } {
  const startsAt = colomboDateTime(text(form, 'startsAt'));
  const endsAt = colomboDateTime(text(form, 'endsAt'));
  const problems = [
    ...(startsAt ? [] : ['starts_at_required']),
    ...(endsAt ? [] : ['ends_at_required']),
    ...(startsAt && endsAt && endsAt <= startsAt ? ['ends_before_start'] : []),
  ];
  return { startsAt, endsAt, problems };
}

/** A new opportunity: both languages, times, places, its area, skills from the list, an optional event. */
export function readOpportunity(form: FormLike): Read<VolunteerOpportunityInput> {
  const written = pairs(form);
  const when = times(form);
  const places = wholeNumber(text(form, 'places'), 1, 500);
  const area = readArea(text(form, 'area'));
  const skills = checked(form, 'skills');
  const problems = [
    ...written.problems,
    ...when.problems,
    ...(places === null ? ['places_required'] : []),
    ...(skills.length > MAX_SKILLS ? ['too_many_skills'] : []),
    ...(area ? [] : ['area_required']),
  ];
  if (problems.length > 0 || !when.startsAt || !when.endsAt || places === null || !area) return { input: null, problems };
  const v = written.values;
  return {
    input: {
      titleEn: v.titleEn, titleTa: v.titleTa, roleEn: v.roleEn, roleTa: v.roleTa,
      descriptionEn: v.descriptionEn, descriptionTa: v.descriptionTa, placeEn: v.placeEn, placeTa: v.placeTa,
      bringEn: v.bringEn, bringTa: v.bringTa, teamEn: v.teamEn, teamTa: v.teamTa,
      startsAt: when.startsAt, endsAt: when.endsAt,
      eventId: uuidOrNull(form, 'eventId'),
      skills,
      places,
      area,
    },
    problems,
  };
}

/**
 * A change to an opportunity. The times go to the API only when they changed: the API checks that
 * a changed start is still ahead, so fixing a typo in a running opportunity is not refused.
 */
export function readOpportunityUpdate(form: FormLike): Read<VolunteerOpportunityUpdate> {
  const written = pairs(form);
  const when = times(form);
  const places = wholeNumber(text(form, 'places'), 1, 500);
  const problems = [...written.problems, ...when.problems, ...(places === null ? ['places_required'] : [])];
  if (problems.length > 0 || places === null) return { input: null, problems };
  const timesChanged = text(form, 'startsAt') !== text(form, 'startsAtWas') || text(form, 'endsAt') !== text(form, 'endsAtWas');
  return {
    input: {
      ...written.values,
      ...(timesChanged ? { startsAt: when.startsAt, endsAt: when.endsAt } : {}),
      places,
    },
    problems,
  };
}

/** S10: confirm with a meeting point in both languages (and an optional role), or decline with a reason. */
export function readOfferDecision(form: FormLike): Read<VolunteerOfferDecision> {
  const decision = text(form, 'decision');
  if (decision === 'confirm') {
    const meetingPointTa = text(form, 'meetingPointTa');
    const meetingPointEn = text(form, 'meetingPointEn');
    if (!meetingPointTa || !meetingPointEn) return { input: null, problems: ['meeting_point_required'] };
    return {
      input: {
        confirm: true,
        meetingPointTa,
        meetingPointEn,
        roleTa: text(form, 'roleTa') || null,
        roleEn: text(form, 'roleEn') || null,
      },
      problems: [],
    };
  }
  if (decision === 'decline') {
    const reason = text(form, 'reason');
    return reason ? { input: { confirm: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
  }
  return { input: null, problems: ['decision_required'] };
}

/** Open or close; cancelling needs the reason everyone who offered is told. */
export function readMove(form: FormLike): Read<{ state: 'open' | 'closed' | 'cancelled'; reason?: string }> {
  const state = text(form, 'state');
  if (state === 'open' || state === 'closed') return { input: { state }, problems: [] };
  if (state === 'cancelled') {
    const reason = text(form, 'reason');
    return reason ? { input: { state, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
  }
  return { input: null, problems: ['decision_required'] };
}

type Words = { ta: string; en: string };

export const OPPORTUNITY_STATE_LABELS: Readonly<Record<VolunteerOpportunityState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
  cancelled: { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' },
};

export const OFFER_STATE_LABELS: Readonly<Record<string, Words>> = {
  offered: { ta: 'முடிவுக்காகக் காத்திருக்கிறது', en: 'Waiting for a decision' },
  confirmed: { ta: 'உறுதிசெய்யப்பட்டது', en: 'Confirmed' },
  declined: { ta: 'நிராகரிக்கப்பட்டது', en: 'Declined' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn by the volunteer' },
  cancelled: { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' },
};

export const MOVE_LABELS: Readonly<Record<'open' | 'closed' | 'cancelled', Words>> = {
  open: { ta: 'திறக்கவும்', en: 'Open to members' },
  closed: { ta: 'மூடவும்', en: 'Close to new offers' },
  cancelled: { ta: 'இரத்து செய்யவும்', en: 'Cancel the opportunity' },
};

export const AVAILABILITY_LABELS: Readonly<Record<string, Words>> = {
  weekday_mornings: { ta: 'வார நாள் காலை', en: 'Weekday mornings' },
  weekday_afternoons: { ta: 'வார நாள் மதியம்', en: 'Weekday afternoons' },
  weekday_evenings: { ta: 'வார நாள் மாலை', en: 'Weekday evenings' },
  weekends: { ta: 'வார இறுதி நாட்கள்', en: 'Weekends' },
  public_holidays: { ta: 'பொது விடுமுறை நாட்கள்', en: 'Public holidays' },
};

export const TRAVEL_LABELS: Readonly<Record<string, Words>> = {
  my_gn: { ta: 'தனது கிராம சேவகர் பிரிவுக்குள்', en: 'Within their GN division' },
  my_ds: { ta: 'தனது பிரதேச செயலகப் பிரிவுக்குள்', en: 'Within their DS division' },
};

export const INBOX_KIND_LABELS: Readonly<Record<string, Words>> = {
  message: { ta: 'செய்தி', en: 'Message' },
  change_request: { ta: 'மாற்றக் கோரிக்கை', en: 'Change request' },
};

/** Volunteers listed by name, never by how much someone has done (BR-043: no ranking). */
export function byName<T extends { name: string }>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
