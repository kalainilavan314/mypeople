import type { PromiseInput, PromiseKind, PromiseStatus, PromiseTheme, PromiseUpdateInput } from '@my-people/api-client';

import { readArea, text, uuidOrNull, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the promises API uses, and the one the dashboard's own checks use too. */
export const PROMISE_REFUSED = 'promise_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

export const STATUSES: readonly PromiseStatus[] = ['not_started', 'in_progress', 'completed', 'delayed', 'blocked', 'withdrawn'];
export const STATUS_LABELS: Readonly<Record<PromiseStatus, Words>> = {
  not_started: { ta: 'தொடங்கப்படவில்லை', en: 'Not started' },
  in_progress: { ta: 'நடைபெறுகிறது', en: 'In progress' },
  completed: { ta: 'நிறைவேற்றப்பட்டது', en: 'Completed' },
  delayed: { ta: 'தாமதமானது', en: 'Delayed' },
  blocked: { ta: 'தடைப்பட்டுள்ளது', en: 'Blocked' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};
export const STATUS_TONES: Readonly<Record<PromiseStatus, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  not_started: 'neutral',
  in_progress: 'waiting',
  completed: 'done',
  delayed: 'refused',
  blocked: 'refused',
  withdrawn: 'neutral',
};
/** "Delayed" is set by the due date, never chosen (the API's delayed_is_set_by_due_date). */
export const UPDATE_STATUSES = ['not_started', 'in_progress', 'completed', 'blocked', 'withdrawn'] as const;

export const THEMES: readonly PromiseTheme[] = [
  'roads_transport', 'drinking_water', 'health', 'education', 'employment', 'agriculture', 'fisheries', 'housing', 'environment',
  'governance', 'other',
];
export const THEME_LABELS: Readonly<Record<PromiseTheme, Words>> = {
  roads_transport: { ta: 'வீதிகளும் போக்குவரத்தும்', en: 'Roads and transport' },
  drinking_water: { ta: 'குடிநீர்', en: 'Drinking water' },
  health: { ta: 'சுகாதாரம்', en: 'Health' },
  education: { ta: 'கல்வி', en: 'Education' },
  employment: { ta: 'வேலைவாய்ப்பு', en: 'Employment' },
  agriculture: { ta: 'விவசாயம்', en: 'Agriculture' },
  fisheries: { ta: 'மீன்பிடி', en: 'Fisheries' },
  housing: { ta: 'வீடமைப்பு', en: 'Housing' },
  environment: { ta: 'சுற்றுச்சூழல்', en: 'Environment' },
  governance: { ta: 'ஆளுகை', en: 'Governance' },
  other: { ta: 'ஏனையவை', en: 'Other' },
};

export const KINDS: readonly PromiseKind[] = ['party_commitment', 'government_responsibility'];
export const KIND_LABELS: Readonly<Record<PromiseKind, Words>> = {
  party_commitment: { ta: 'கட்சியின் வாக்குறுதி', en: 'Party commitment' },
  government_responsibility: { ta: 'அரசாங்கப் பொறுப்பு', en: 'Government responsibility' },
};

export const PUBLICATION_LABELS: Readonly<Record<'draft' | 'awaiting_approval' | 'published', Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  awaiting_approval: { ta: 'அங்கீகாரத்துக்காகக் காத்திருக்கிறது', en: 'Waiting for approval' },
  published: { ta: 'வெளியிடப்பட்டது', en: 'Published' },
};

export const PROMISE_TEXT_FIELDS = [
  'titleTa', 'titleEn', 'descriptionTa', 'descriptionEn', 'officeTa', 'officeEn', 'targetTa', 'targetEn', 'blockersTa', 'blockersEn',
  'sourceReference', 'sourcePublishedOn', 'kind', 'theme', 'plannedStart', 'dueDate', 'area', 'milestonesJson',
] as const;

export const PROMISE_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  description_required: 'descriptionTa',
  office_required: 'officeTa',
  target_required: 'targetTa',
  promise_source_required: 'sourceReference',
  kind_required: 'kind',
  theme_required: 'theme',
  planned_start_required: 'plannedStart',
  due_date_required: 'dueDate',
  due_before_start: 'dueDate',
  area_required: 'area',
  unknown_area: 'area',
  milestones_required: 'milestonesJson',
  milestone_text_required: 'milestonesJson',
  too_many_milestones: 'milestonesJson',
  update_note_required: 'noteTa',
  evidence_required: 'evidenceRefs',
  overdue_stays_delayed: 'newStatus',
  reason_required: 'reason',
  decision_required: 'decision',
  reply_required: 'replyTa',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (form: FormLike, name: string) => (DATE.test(text(form, name)) ? text(form, name) : null);

/** Milestones from the builder's JSON: each in both languages, with an optional due date. */
export function parseMilestones(json: string): Read<PromiseInput['milestones']> {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    raw = [];
  }
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > 30) return { input: null, problems: ['too_many_milestones'] };
  const problems: string[] = [];
  const milestones = list.map((item, index) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const titleTa = typeof entry.titleTa === 'string' ? entry.titleTa.trim() : '';
    const titleEn = typeof entry.titleEn === 'string' ? entry.titleEn.trim() : '';
    const due = typeof entry.dueDate === 'string' && DATE.test(entry.dueDate) ? entry.dueDate : null;
    if (titleTa.length < 3 || titleEn.length < 3) problems.push(`milestone_text_required:${index + 1}`);
    return { titleTa, titleEn, dueDate: due };
  });
  return { input: problems.length ? null : milestones, problems };
}

/**
 * FR-PRM-001: a promise in Tamil and English with its source and date, the office responsible, its
 * kind and theme, the planned start and due date, a measurable target and its milestones. The area
 * is chosen once, when it is drafted.
 */
export function readPromise(form: FormLike, { needsArea }: { needsArea: boolean }): Read<PromiseInput> {
  const t = (name: string) => text(form, name);
  const kind = KINDS.find((k) => k === t('kind'));
  const theme = THEMES.find((k) => k === t('theme'));
  const plannedStart = dateOrNull(form, 'plannedStart');
  const dueDate = dateOrNull(form, 'dueDate');
  const sourcePublishedOn = dateOrNull(form, 'sourcePublishedOn');
  const area = needsArea ? readArea(t('area')) : null;
  const milestones = parseMilestones(t('milestonesJson'));
  const both = (name: string) => Boolean(t(`${name}Ta`) && t(`${name}En`));
  const problems = [
    ...(both('title') ? [] : ['title_required']),
    ...(both('description') ? [] : ['description_required']),
    ...(t('sourceReference') && sourcePublishedOn ? [] : ['promise_source_required']),
    ...(both('office') ? [] : ['office_required']),
    ...(kind ? [] : ['kind_required']),
    ...(theme ? [] : ['theme_required']),
    ...(plannedStart ? [] : ['planned_start_required']),
    ...(dueDate ? [] : ['due_date_required']),
    ...(plannedStart && dueDate && dueDate < plannedStart ? ['due_before_start'] : []),
    ...(both('target') ? [] : ['target_required']),
    ...(needsArea && !area ? ['area_required'] : []),
    ...milestones.problems,
  ];
  if (problems.length > 0 || !kind || !theme || !plannedStart || !dueDate || !sourcePublishedOn || !milestones.input) {
    return { input: null, problems };
  }
  return {
    input: {
      titleTa: t('titleTa'),
      titleEn: t('titleEn'),
      descriptionTa: t('descriptionTa'),
      descriptionEn: t('descriptionEn'),
      sourceReference: t('sourceReference'),
      sourcePublishedOn,
      officeTa: t('officeTa'),
      officeEn: t('officeEn'),
      kind,
      theme,
      plannedStart,
      dueDate,
      targetTa: t('targetTa'),
      targetEn: t('targetEn'),
      blockersTa: t('blockersTa') || null,
      blockersEn: t('blockersEn') || null,
      milestones: milestones.input,
      ...(area ? { area } : {}),
    },
    problems,
  };
}

/**
 * The due date has passed in Sri Lankan time (UTC+05:30, no daylight saving). The API then keeps the
 * promise Delayed: only Completed or Withdrawn, or a note without a status, is accepted.
 */
export function pastDue(dueDate: string, now: Date): boolean {
  return dueDate < new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

/** Evidence references, one per line, trimmed, at most 20. */
export function evidenceRefs(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * FR-PRM-002, 005: an update in both languages, with an optional new status. Completed needs
 * evidence; Blocked and Withdrawn need the reason in the note (10 characters or more). A
 * correction names the update it corrects; the original stays visible.
 */
export function readPromiseUpdate(form: FormLike): Read<PromiseUpdateInput> {
  const statusText = text(form, 'newStatus');
  const newStatus = UPDATE_STATUSES.find((status) => status === statusText) ?? null;
  const noteTa = text(form, 'noteTa');
  const noteEn = text(form, 'noteEn');
  const refs = evidenceRefs(text(form, 'evidenceRefs'));
  const problems = [
    ...(noteTa.length >= 5 && noteEn.length >= 5 ? [] : ['update_note_required']),
    ...(newStatus === 'completed' && refs.length === 0 ? ['evidence_required'] : []),
    ...((newStatus === 'blocked' || newStatus === 'withdrawn') && (noteEn.length < 10 || noteTa.length < 10) ? ['reason_required'] : []),
  ];
  if (problems.length > 0) return { input: null, problems };
  return { input: { newStatus, noteTa, noteEn, evidenceRefs: refs, correctsId: uuidOrNull(form, 'correctsId') }, problems };
}

/** Approve, or return/reject with the reason the drafter is told. */
export function readDecision(form: FormLike): Read<{ approve: boolean; reason?: string }> {
  const choice = text(form, 'decision');
  if (choice === 'approve') return { input: { approve: true }, problems: [] };
  if (choice !== 'return') return { input: null, problems: ['decision_required'] };
  const reason = text(form, 'reason');
  return reason ? { input: { approve: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
}

