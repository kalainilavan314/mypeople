import type { GuideCategory, GuideEntryInput, GuideEntryState, GuideReportReason } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the guide API uses, and the one the dashboard's own checks use too. */
export const GUIDE_REFUSED = 'guide_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

export const CATEGORIES: readonly GuideCategory[] = [
  'assistance_programme',
  'scholarship',
  'job',
  'vocational_training',
  'agriculture',
  'fisheries',
  'enterprise_grant',
  'course',
  'public_service_contact',
];
export const CATEGORY_LABELS: Readonly<Record<GuideCategory, Words>> = {
  assistance_programme: { ta: 'உதவித் திட்டங்கள்', en: 'Assistance programmes' },
  scholarship: { ta: 'புலமைப்பரிசில்கள்', en: 'Scholarships' },
  job: { ta: 'வேலைவாய்ப்புகள்', en: 'Jobs' },
  vocational_training: { ta: 'தொழிற்பயிற்சி', en: 'Vocational training' },
  agriculture: { ta: 'விவசாயம்', en: 'Agriculture' },
  fisheries: { ta: 'மீன்பிடி', en: 'Fisheries' },
  enterprise_grant: { ta: 'தொழில் முயற்சி மானியங்கள்', en: 'Enterprise grants' },
  course: { ta: 'கற்கைநெறிகள்', en: 'Courses' },
  public_service_contact: { ta: 'அரச சேவைத் தொடர்புகள்', en: 'Public-service contacts' },
};

export const STATES: readonly GuideEntryState[] = ['draft', 'in_review', 'published', 'withdrawn'];
export const STATE_LABELS: Readonly<Record<GuideEntryState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  in_review: { ta: 'மீளாய்வுக்காகக் காத்திருக்கிறது', en: 'Waiting for review' },
  published: { ta: 'வெளியிடப்பட்டது', en: 'Published' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};
export const STATE_TONES: Readonly<Record<GuideEntryState, 'waiting' | 'done' | 'refused' | 'neutral'>> = {
  draft: 'neutral',
  in_review: 'waiting',
  published: 'done',
  withdrawn: 'neutral',
};
export const EXPIRED_LABEL: Words = { ta: 'இறுதித் திகதி கடந்தது', en: 'Past its end date' };
export const REVERIFY_LABEL: Words = { ta: 'மீண்டும் சரிபார்க்க வேண்டும்', en: 'Needs a fresh check' };

export const REPORT_REASONS: readonly GuideReportReason[] = ['outdated', 'closed', 'broken_link', 'wrong_details', 'other'];
export const REPORT_REASON_LABELS: Readonly<Record<GuideReportReason, Words>> = {
  outdated: { ta: 'காலாவதியான தகவல்', en: 'Information is out of date' },
  closed: { ta: 'திட்டம் அல்லது விண்ணப்பம் மூடப்பட்டது', en: 'The scheme or applications have closed' },
  broken_link: { ta: 'மூல இணைப்பு வேலை செய்யவில்லை', en: 'The source link does not work' },
  wrong_details: { ta: 'விவரங்கள் தவறானவை', en: 'Details are wrong' },
  other: { ta: 'வேறு காரணம்', en: 'Something else' },
};
export const REPORT_STATE_LABELS: Readonly<Record<'open' | 'fixed' | 'dismissed', Words>> = {
  open: { ta: 'திறந்துள்ளது', en: 'Open' },
  fixed: { ta: 'சரிசெய்யப்பட்டது', en: 'Fixed' },
  dismissed: { ta: 'நிராகரிக்கப்பட்டது', en: 'Dismissed' },
};

/** The list filter: one of the four states, or published entries past their end date (D28 "expired entries list"). */
export type GuideFilter = GuideEntryState | 'expired';
export function readFilter(value: string | undefined): GuideFilter | undefined {
  if (value === 'expired') return 'expired';
  return STATES.find((state) => state === value);
}

/** The Tamil and English pairs of an entry, in the order the form shows them. */
export const TEXT_PAIRS = [
  { pair: 'title', en: 'Title', long: false, maxTa: 220, maxEn: 160 },
  { pair: 'summary', en: 'Short summary', long: true, maxTa: 600, maxEn: 400 },
  { pair: 'body', en: 'Details and how to apply', long: true, maxTa: 6000, maxEn: 4000 },
  { pair: 'provider', en: 'Provider (the office or body that runs it)', long: false, maxTa: 300, maxEn: 200 },
] as const;

export const GUIDE_TEXT_FIELDS = [
  'category',
  ...TEXT_PAIRS.flatMap(({ pair }) => [`${pair}Ta`, `${pair}En`]),
  'contact',
  'sourceUrl',
  'publishedOn',
  'verifiedOn',
  'expiresOn',
] as const;

/**
 * The API's problem codes this module renames, because the shared words for the same code are
 * about another screen (another length limit for titles and texts).
 */
export const RENAMED_PROBLEMS: Readonly<Record<string, string>> = {
  title_ta_required: 'guide_title_ta_required',
  title_en_required: 'guide_title_en_required',
  body_ta_required: 'guide_body_ta_required',
  body_en_required: 'guide_body_en_required',
};

/** The API's problem codes in this module's own words. */
export function renameProblems(problems: readonly string[]): string[] {
  return problems.map((problem) => RENAMED_PROBLEMS[problem] ?? problem);
}

export const GUIDE_TARGETS: ProblemTargets = {
  guide_category_required: 'category',
  guide_title_ta_required: 'titleTa',
  guide_title_en_required: 'titleEn',
  summary_ta_required: 'summaryTa',
  summary_en_required: 'summaryEn',
  guide_body_ta_required: 'bodyTa',
  guide_body_en_required: 'bodyEn',
  provider_ta_required: 'providerTa',
  provider_en_required: 'providerEn',
  source_url_required: 'sourceUrl',
  guide_source_url_format: 'sourceUrl',
  published_on_required: 'publishedOn',
  published_on_in_future: 'publishedOn',
  verified_on_required: 'verifiedOn',
  verified_on_in_future: 'verifiedOn',
  verified_before_published: 'verifiedOn',
  already_expired: 'expiresOn',
  guide_date_invalid: 'publishedOn',
  expires_before_published: 'expiresOn',
  states_eligibility: 'summaryEn',
  decision_required: 'decision',
  reason_required: 'reason',
  outcome_required: 'outcome',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_PATTERN = /^https?:\/\/\S+$/;

/** An optional date field: null when empty, undefined when it is not a date. */
function optionalDate(form: FormLike, name: string): string | null | undefined {
  const value = text(form, name);
  if (!value) return null;
  return DATE.test(value) ? value : undefined;
}

/**
 * D28: a draft may be saved incomplete, so only the category is required here; the API checks
 * everything (both languages, the source link and the dates) when review is asked for
 * (FR-LIV-002, 005). Empty fields are sent as null.
 */
export function readGuideEntry(form: FormLike): Read<GuideEntryInput> {
  const t = (name: string) => text(form, name);
  const category = CATEGORIES.find((code) => code === t('category'));
  const publishedOn = optionalDate(form, 'publishedOn');
  const verifiedOn = optionalDate(form, 'verifiedOn');
  const expiresOn = optionalDate(form, 'expiresOn');
  const sourceUrl = t('sourceUrl');
  const problems = [
    ...(category ? [] : ['guide_category_required']),
    ...(sourceUrl && !URL_PATTERN.test(sourceUrl) ? ['guide_source_url_format'] : []),
    ...(publishedOn === undefined || verifiedOn === undefined || expiresOn === undefined ? ['guide_date_invalid'] : []),
    ...(publishedOn && expiresOn && expiresOn < publishedOn ? ['expires_before_published'] : []),
  ];
  if (problems.length > 0 || !category || publishedOn === undefined || verifiedOn === undefined || expiresOn === undefined) {
    return { input: null, problems };
  }
  const optional = (name: string) => t(name) || null;
  return {
    input: {
      category,
      titleTa: optional('titleTa'),
      titleEn: optional('titleEn'),
      summaryTa: optional('summaryTa'),
      summaryEn: optional('summaryEn'),
      bodyTa: optional('bodyTa'),
      bodyEn: optional('bodyEn'),
      providerTa: optional('providerTa'),
      providerEn: optional('providerEn'),
      contact: optional('contact'),
      sourceUrl: sourceUrl || null,
      publishedOn,
      verifiedOn,
      expiresOn,
    },
    problems,
  };
}

/** Publish, or return to the editor with a note they read (FR-LIV-003). */
export function readReview(form: FormLike): Read<{ approve: boolean; note?: string }> {
  const choice = text(form, 'decision');
  const note = text(form, 'reason');
  if (choice === 'approve') return { input: { approve: true, ...(note ? { note } : {}) }, problems: [] };
  if (choice !== 'return') return { input: null, problems: ['decision_required'] };
  return note.length >= 3 ? { input: { approve: false, note }, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** A report is fixed, or dismissed with the reason (the reporter is told it was checked). */
export function readResolution(form: FormLike): Read<{ outcome: 'fixed' | 'dismissed'; note?: string }> {
  const outcome = text(form, 'outcome');
  const note = text(form, 'reason');
  if (outcome === 'fixed') return { input: { outcome, ...(note ? { note } : {}) }, problems: [] };
  if (outcome !== 'dismissed') return { input: null, problems: ['outcome_required'] };
  return note.length >= 3 ? { input: { outcome, note }, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** A reason of at least three characters (withdrawing an entry). */
export function readReason(form: FormLike): Read<string> {
  const reason = text(form, 'reason');
  return reason.length >= 3 ? { input: reason, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** The entry as the form shows it: every field as text, empty where nothing is stored yet. */
export function formValues(entry: object): Record<string, string> {
  const record = entry as Record<string, unknown>;
  return Object.fromEntries(GUIDE_TEXT_FIELDS.map((name) => [name, typeof record[name] === 'string' ? (record[name] as string) : '']));
}
