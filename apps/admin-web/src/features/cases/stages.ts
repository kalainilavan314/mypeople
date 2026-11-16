import type { BilingualText } from '../../lib/messages.ts';

// The case workflow's words and rules as the dashboard shows them (BRD W03 to W08). The API
// decides who may act; these only name stages and pick which owners a form offers.

export const CASE_STAGES = [
  'gn',
  'returned',
  'ds',
  'district',
  'regional',
  'executive',
  'implementation',
  'resolved',
  'declined',
  'linked',
] as const;
export type CaseStageCode = (typeof CASE_STAGES)[number];

export const STAGE_LABELS: Record<CaseStageCode, BilingualText> = {
  gn: { ta: 'கிராம சேவகர் மட்ட சேகரிப்பு', en: 'GN collection' },
  returned: { ta: 'விவரங்களுக்காகத் திருப்பியனுப்பப்பட்டது', en: 'Returned for details' },
  ds: { ta: 'பிரதேச ஆய்வு', en: 'Divisional research' },
  district: { ta: 'மாவட்ட முடிவு', en: 'District decision' },
  regional: { ta: 'பிராந்தியத் திட்டம்', en: 'Regional plan' },
  executive: { ta: 'நிறைவேற்று அனுமதி', en: 'Executive approval' },
  implementation: { ta: 'நடைமுறைப்படுத்தல்', en: 'Implementation' },
  resolved: { ta: 'தீர்க்கப்பட்டது', en: 'Resolved' },
  declined: { ta: 'நிராகரிக்கப்பட்டது', en: 'Declined' },
  linked: { ta: 'இணைக்கப்பட்டது', en: 'Linked' },
};

export const OPEN_STAGES: ReadonlySet<string> = new Set(['gn', 'returned', 'ds', 'district', 'regional', 'executive', 'implementation']);

/** The permission a stage's owner holds; assign offers holders of it, as the API checks. */
export const STAGE_PERMISSION: Readonly<Record<string, string>> = {
  gn: 'cases.collect',
  returned: 'cases.collect',
  ds: 'cases.research',
  district: 'cases.decide_district',
  regional: 'cases.plan_regional',
  executive: 'cases.approve_executive',
  implementation: 'cases.implement_and_close',
};

/** Where an accepted closure challenge may reopen the case (FR-WEB-027). */
export const REOPEN_STAGES = ['gn', 'ds', 'district', 'implementation'] as const;
export type ReopenStage = (typeof REOPEN_STAGES)[number];

export const CASE_PERMISSIONS = [
  'cases.collect',
  'cases.research',
  'cases.decide_district',
  'cases.plan_regional',
  'cases.approve_executive',
  'cases.implement_and_close',
] as const;

export function isCaseStage(value: string | undefined | null): value is CaseStageCode {
  return value != null && (CASE_STAGES as readonly string[]).includes(value);
}

export function stageLabel(stage: string | null | undefined): BilingualText {
  if (isCaseStage(stage)) return STAGE_LABELS[stage];
  const readable = stage ? stage.replace(/_/g, ' ') : '—';
  return { ta: readable, en: readable };
}

/** The owner lists a case file needs, from the actions the API allows this viewer now. */
export function ownerPermissionsFor(stage: string, allowed: readonly string[]): string[] {
  const needed = new Set<string>();
  if (allowed.includes('forward')) needed.add('cases.research');
  if (allowed.includes('ds_report')) needed.add('cases.decide_district');
  if (allowed.includes('district_decision')) {
    needed.add('cases.implement_and_close');
    needed.add('cases.plan_regional');
  }
  if (allowed.includes('executive_decision')) needed.add('cases.implement_and_close');
  if (allowed.includes('assign') && STAGE_PERMISSION[stage]) needed.add(STAGE_PERMISSION[stage]);
  if (allowed.includes('decide_challenge')) for (const reopen of REOPEN_STAGES) needed.add(STAGE_PERMISSION[reopen]);
  return [...needed].sort();
}

export const FINDING_KINDS = ['verified_fact', 'assumption', 'option', 'stakeholder', 'resource_need', 'open_question'] as const;
export type FindingKindCode = (typeof FINDING_KINDS)[number];

export const FINDING_LABELS: Record<FindingKindCode, BilingualText> = {
  verified_fact: { ta: 'சரிபார்க்கப்பட்ட உண்மைகள்', en: 'Verified facts' },
  assumption: { ta: 'அனுமானங்கள்', en: 'Assumptions' },
  option: { ta: 'தெரிவுகள்', en: 'Options' },
  stakeholder: { ta: 'சம்பந்தப்பட்டவர்கள்', en: 'Stakeholders' },
  resource_need: { ta: 'தேவையான வளங்கள்', en: 'Resource needs' },
  open_question: { ta: 'திறந்த கேள்விகள்', en: 'Open questions' },
};

export function isFindingKind(value: unknown): value is FindingKindCode {
  return typeof value === 'string' && (FINDING_KINDS as readonly string[]).includes(value);
}

/** One reference per line, trimmed, blanks dropped; the API keeps at most 20. */
export function evidenceRefsFrom(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** The deepest area a case names, as an area key ("gn:…", "ds:…", "district:…"). */
export function caseAreaKey(item: {
  gnCode: string | null;
  dsCode: string | null;
  districtCode: string | null;
  areaPath: readonly string[];
}): string {
  if (item.gnCode) return `gn:${item.gnCode}`;
  if (item.dsCode) return `ds:${item.dsCode}`;
  if (item.districtCode) return `district:${item.districtCode}`;
  return item.areaPath.at(-1) ?? 'platform';
}

/** Today in Sri Lanka (Asia/Colombo) as YYYY-MM-DD, the earliest due date a form offers. */
export function colomboToday(now: Date): string {
  return new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
