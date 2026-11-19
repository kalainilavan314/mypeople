import type {
  BudgetCompletionInput,
  BudgetCycleInput,
  BudgetCycleMove,
  BudgetCyclePhase,
  BudgetCycleStatus,
  BudgetExpenditureInput,
  BudgetFundKind,
  BudgetProjectInput,
  BudgetReviewInput,
  ManagedBudgetCycle,
} from '@my-people/api-client';

import { colomboDateTime, readArea, text, uuidOrNull, wholeNumber, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the budgeting API uses, and the one the dashboard's own checks use too. */
export const BUDGET_REFUSED = 'budgeting_refused';

export const MANAGE = 'pb.manage'; // PRM-45
export const CERTIFY = 'pb.certify'; // PRM-46, two different people
export const ALLOCATE = 'finance.approve'; // the Treasurer records allocations [ASSUMPTION in the API]
export const BUDGET_PERMISSIONS = [MANAGE, CERTIFY, ALLOCATE] as const;

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
type Tone = 'waiting' | 'done' | 'refused' | 'neutral';

export const STATUSES: readonly BudgetCycleStatus[] = [
  'draft', 'proposal_intake', 'review', 'voting_open', 'voting_closed', 'results_certified', 'allocated', 'implemented', 'cancelled',
];
export const STATUS_LABELS: Readonly<Record<BudgetCycleStatus, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  proposal_intake: { ta: 'திட்டங்கள் சேர்க்கப்படுகின்றன', en: 'Proposal intake' },
  review: { ta: 'மீளாய்வில்', en: 'Review' },
  voting_open: { ta: 'வாக்களிப்பு திட்டமிடப்பட்டது / திறந்துள்ளது', en: 'Voting scheduled or open' },
  voting_closed: { ta: 'வாக்களிப்பு முடிந்தது', en: 'Voting closed' },
  results_certified: { ta: 'முடிவுகள் சான்றுறுதிப்படுத்தப்பட்டன', en: 'Results certified' },
  allocated: { ta: 'நிதி ஒதுக்கப்பட்டது', en: 'Allocated' },
  implemented: { ta: 'நடைமுறைப்படுத்தப்பட்டது', en: 'Implemented' },
  cancelled: { ta: 'இரத்துச்செய்யப்பட்டது', en: 'Cancelled' },
};
export const STATUS_TONES: Readonly<Record<BudgetCycleStatus, Tone>> = {
  draft: 'neutral',
  proposal_intake: 'waiting',
  review: 'waiting',
  voting_open: 'waiting',
  voting_closed: 'waiting',
  results_certified: 'done',
  allocated: 'done',
  implemented: 'done',
  cancelled: 'refused',
};
export const PHASE_LABELS: Readonly<Record<BudgetCyclePhase, Words>> = {
  upcoming: { ta: 'வாக்களிப்புக்கு முன்', en: 'Before voting' },
  voting: { ta: 'வாக்களிப்பு நடைபெறுகிறது', en: 'Voting now' },
  counting: { ta: 'எண்ணிக்கையும் சான்றுறுதியும்', en: 'Counting and certification' },
  results: { ta: 'முடிவுகள்', en: 'Results' },
  cancelled: { ta: 'இரத்துச்செய்யப்பட்டது', en: 'Cancelled' },
};
export const FUND_KINDS: readonly BudgetFundKind[] = ['party_fund', 'community_fund'];
export const FUND_KIND_LABELS: Readonly<Record<BudgetFundKind, Words>> = {
  party_fund: { ta: 'கட்சி நிதி', en: 'Party fund' },
  community_fund: { ta: 'சமூக நிதி', en: 'Community fund' },
};
export const REVIEW_KINDS = ['financial', 'legal'] as const;
export const REVIEW_LABELS: Readonly<Record<(typeof REVIEW_KINDS)[number], Words>> = {
  financial: { ta: 'நிதி மீளாய்வு', en: 'Financial review' },
  legal: { ta: 'சட்ட மீளாய்வு', en: 'Legal review' },
};

/** FR-PBG-009: shown on every cycle, before voting, to members and staff alike. */
export const CONSULTATION_LABEL: Words = {
  ta: 'இது கட்சி அல்லது சமூக ஆலோசனை மட்டுமே; பொதுத் தேர்தலோ அரசாங்க வரவுசெலவுத் தீர்மானமோ அல்ல.',
  en: 'A party or community consultation, not a public election or a government budget decision.',
};

/** OD-36 (BRD recommendation, an assumption until decided): the eligibility text staff start from. */
export const DEFAULT_ELIGIBILITY: Words = {
  ta: 'இப்பகுதியில் வசிக்கும், அடையாளம் சரிபார்க்கப்பட்ட, செயலில் உள்ள 18 வயதுக்கு மேற்பட்ட உறுப்பினர்கள். ஒரு சுழற்சிக்கு ஒருவருக்கு ஒரு வாக்குச்சீட்டு.',
  en: 'Verified, active members aged 18 or over who live in this area. One ballot per member per cycle.',
};

/** The moves a pb.manage holder records from each status (the API's MOVES); the rest move on by themselves. */
export const MOVES: Readonly<Partial<Record<BudgetCycleStatus, readonly BudgetCycleMove[]>>> = {
  draft: ['proposal_intake', 'cancelled'],
  proposal_intake: ['review', 'cancelled'],
  review: ['voting_open', 'proposal_intake', 'cancelled'],
  voting_open: ['voting_closed'],
};
export const MOVE_LABELS: Readonly<Record<BudgetCycleMove, Words>> = {
  proposal_intake: { ta: 'விதிகளை வெளியிடு / திட்டங்களைச் சேர்க்கத் திற', en: 'Publish the rules and take in projects' },
  review: { ta: 'மீளாய்வுக்கு அனுப்பு', en: 'Move to review' },
  voting_open: { ta: 'வாக்களிப்பைத் திட்டமிடு (விதிகள் பூட்டப்படும்)', en: 'Schedule voting (locks the rules)' },
  voting_closed: { ta: 'வாக்களிப்பை முடி', en: 'Close voting' },
  cancelled: { ta: 'சுழற்சியை இரத்துச்செய்', en: 'Cancel the cycle' },
};
/** Rules and projects change only before voting is scheduled (BR-121). */
export const EDITABLE: readonly BudgetCycleStatus[] = ['draft', 'proposal_intake', 'review'];
export const COUNTED: readonly BudgetCycleStatus[] = ['voting_closed', 'results_certified', 'allocated', 'implemented'];

export const CYCLE_TEXT_FIELDS = [
  'titleTa', 'titleEn', 'descriptionTa', 'descriptionEn', 'fundKind', 'fundSourceTa', 'fundSourceEn', 'budget', 'eligibilityTa',
  'eligibilityEn', 'maxChoices', 'votingOpensAt', 'votingClosesAt', 'area',
] as const;
export const PROJECT_TEXT_FIELDS = ['proposalId', 'titleTa', 'titleEn', 'summaryTa', 'summaryEn', 'estimatedCost'] as const;
export const REVIEW_TEXT_FIELDS = ['kind', 'reference', 'noteTa', 'noteEn'] as const;
export const EXPENDITURE_TEXT_FIELDS = ['amount', 'spentOn', 'descriptionTa', 'descriptionEn', 'evidenceRef'] as const;
export const COMPLETION_TEXT_FIELDS = ['completedOn', 'evidenceRef', 'noteTa', 'noteEn'] as const;

export const BUDGET_TARGETS: ProblemTargets = {
  title_required: 'titleTa',
  description_required: 'descriptionTa',
  fund_kind_required: 'fundKind',
  fund_source_required: 'fundSourceTa',
  budget_invalid: 'budget',
  eligibility_required: 'eligibilityTa',
  max_choices_invalid: 'maxChoices',
  max_choices_above_projects: 'maxChoices',
  voting_opens_required: 'votingOpensAt',
  voting_closes_required: 'votingClosesAt',
  closes_before_opens: 'votingClosesAt',
  voting_must_open_after_publication: 'votingOpensAt',
  area_required: 'area',
  unknown_area: 'area',
  area_level_invalid: 'area',
  proposal_required: 'proposalId',
  proposal_not_approved_for_planning: 'proposalId',
  already_in_cycle: 'proposalId',
  summary_required: 'summaryTa',
  cost_invalid: 'estimatedCost',
  review_kind_required: 'kind',
  review_reference_required: 'reference',
  review_note_required: 'noteTa',
  move_required: 'to',
  reason_required: 'reason',
  amount_invalid: 'amount',
  spending_exceeds_allocation: 'amount',
  spent_on_required: 'spentOn',
  spending_description_required: 'descriptionTa',
  evidence_ref_required: 'evidenceRef',
  completed_on_required: 'completedOn',
  completion_note_required: 'noteTa',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RUPEES = /^\d{1,12}(\.\d{1,2})?$/;

/** Rupees as typed ("1,500,000" or "1500000.50") to the API's decimal string, or null when not a positive amount. */
export function rupeesValue(value: string): string | null {
  const plain = value.replace(/[,\s]/g, '').replace(/^Rs\.?/i, '');
  if (!RUPEES.test(plain)) return null;
  const amount = Number(plain);
  return amount > 0 ? amount.toFixed(2) : null;
}

/** "Rs. 1,500,000" for a decimal string from the API. */
export function formatRupees(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return `Rs. ${value.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`;
}

const pair = (form: FormLike, name: string, min: number) =>
  text(form, `${name}Ta`).length >= min && text(form, `${name}En`).length >= min;

/**
 * FR-PBG-001: a cycle's budget, fund source, dates and eligibility rules, in Tamil and English. A new
 * cycle also picks its area (a province, district, DS or GN division), which never changes.
 */
export function readCycle(form: FormLike, { needsArea }: { needsArea: boolean }): Read<BudgetCycleInput> {
  const t = (name: string) => text(form, name);
  const fundKind = FUND_KINDS.find((kind) => kind === t('fundKind'));
  const budget = rupeesValue(t('budget'));
  const maxChoices = wholeNumber(t('maxChoices'), 1, 10);
  const votingOpensAt = colomboDateTime(t('votingOpensAt'));
  const votingClosesAt = colomboDateTime(t('votingClosesAt'));
  const area = needsArea ? readArea(t('area')) : null;
  const problems = [
    ...(pair(form, 'title', 5) ? [] : ['title_required']),
    ...(pair(form, 'description', 10) ? [] : ['description_required']),
    ...(fundKind ? [] : ['fund_kind_required']),
    ...(pair(form, 'fundSource', 3) ? [] : ['fund_source_required']),
    ...(budget ? [] : ['budget_invalid']),
    ...(pair(form, 'eligibility', 10) ? [] : ['eligibility_required']),
    ...(maxChoices ? [] : ['max_choices_invalid']),
    ...(votingOpensAt ? [] : ['voting_opens_required']),
    ...(votingClosesAt ? [] : ['voting_closes_required']),
    ...(votingOpensAt && votingClosesAt && votingClosesAt <= votingOpensAt ? ['closes_before_opens'] : []),
    ...(needsArea && !area ? ['area_required'] : []),
  ];
  if (problems.length > 0 || !fundKind || !budget || !maxChoices || !votingOpensAt || !votingClosesAt) return { input: null, problems };
  return {
    input: {
      titleTa: t('titleTa'),
      titleEn: t('titleEn'),
      descriptionTa: t('descriptionTa'),
      descriptionEn: t('descriptionEn'),
      fundKind,
      fundSourceTa: t('fundSourceTa'),
      fundSourceEn: t('fundSourceEn'),
      budget,
      eligibilityTa: t('eligibilityTa'),
      eligibilityEn: t('eligibilityEn'),
      maxChoices,
      votingOpensAt,
      votingClosesAt,
      ...(area ? { area } : {}),
    },
    problems,
  };
}

/** FR-PBG-002: a project from a proposal approved for planning, in both languages, with its estimated cost. */
export function readProject(form: FormLike, { needsProposal }: { needsProposal: boolean }): Read<BudgetProjectInput> {
  const proposalId = uuidOrNull(form, 'proposalId');
  const estimatedCost = rupeesValue(text(form, 'estimatedCost'));
  const problems = [
    ...(needsProposal && !proposalId ? ['proposal_required'] : []),
    ...(pair(form, 'title', 5) ? [] : ['title_required']),
    ...(pair(form, 'summary', 10) ? [] : ['summary_required']),
    ...(estimatedCost ? [] : ['cost_invalid']),
  ];
  if (problems.length > 0 || !estimatedCost) return { input: null, problems };
  return {
    input: {
      ...(needsProposal ? { proposalId } : {}),
      titleTa: text(form, 'titleTa'),
      titleEn: text(form, 'titleEn'),
      summaryTa: text(form, 'summaryTa'),
      summaryEn: text(form, 'summaryEn'),
      estimatedCost,
    },
    problems,
  };
}

/** The financial or legal review a project needs before it can go on the ballot, with its reference. */
export function readReview(form: FormLike): Read<BudgetReviewInput> {
  const kind = REVIEW_KINDS.find((k) => k === text(form, 'kind'));
  const reference = text(form, 'reference');
  const problems = [
    ...(kind ? [] : ['review_kind_required']),
    ...(reference.length >= 3 ? [] : ['review_reference_required']),
    ...(pair(form, 'note', 10) ? [] : ['review_note_required']),
  ];
  if (problems.length > 0 || !kind) return { input: null, problems };
  return { input: { kind, reference, noteTa: text(form, 'noteTa'), noteEn: text(form, 'noteEn') }, problems };
}

/** A move a pb.manage holder records; cancelling needs a reason of 10 characters or more. */
export function readMove(form: FormLike, status: BudgetCycleStatus): Read<{ to: BudgetCycleMove; reason?: string }> {
  const to = (MOVES[status] ?? []).find((move) => move === text(form, 'to'));
  if (!to) return { input: null, problems: ['move_required'] };
  const reason = text(form, 'reason');
  if (to === 'cancelled' && reason.length < 10) return { input: null, problems: ['reason_required'] };
  return { input: to === 'cancelled' ? { to, reason } : { to }, problems: [] };
}

/** FR-PBG-008: spending on a funded project with its evidence; never beyond the allocation (the API checks). */
export function readExpenditure(form: FormLike): Read<BudgetExpenditureInput> {
  const amount = rupeesValue(text(form, 'amount'));
  const spentOn = DATE.test(text(form, 'spentOn')) ? text(form, 'spentOn') : null;
  const evidenceRef = text(form, 'evidenceRef');
  const problems = [
    ...(amount ? [] : ['amount_invalid']),
    ...(spentOn ? [] : ['spent_on_required']),
    ...(pair(form, 'description', 5) ? [] : ['spending_description_required']),
    ...(evidenceRef.length >= 3 ? [] : ['evidence_ref_required']),
  ];
  if (problems.length > 0 || !amount || !spentOn) return { input: null, problems };
  return {
    input: { amount, spentOn, descriptionTa: text(form, 'descriptionTa'), descriptionEn: text(form, 'descriptionEn'), evidenceRef },
    problems,
  };
}

/** FR-PBG-008: completion with its evidence; when every funded project is complete the cycle is Implemented. */
export function readCompletion(form: FormLike): Read<BudgetCompletionInput> {
  const completedOn = DATE.test(text(form, 'completedOn')) ? text(form, 'completedOn') : null;
  const evidenceRef = text(form, 'evidenceRef');
  const problems = [
    ...(completedOn ? [] : ['completed_on_required']),
    ...(evidenceRef.length >= 3 ? [] : ['evidence_ref_required']),
    ...(pair(form, 'note', 10) ? [] : ['completion_note_required']),
  ];
  if (problems.length > 0 || !completedOn) return { input: null, problems };
  return { input: { completedOn, evidenceRef, noteTa: text(form, 'noteTa'), noteEn: text(form, 'noteEn') }, problems };
}

/**
 * Problems whose shared dashboard words belong to another module (a town hall's legal review): the
 * budgeting pages say them in their own words.
 */
export const PROBLEM_ALIASES: Readonly<Record<string, string>> = {
  legal_review_required: 'pb_legal_review_required',
};

export function ownProblems(problems: readonly string[]): string[] {
  return problems.map((problem) => PROBLEM_ALIASES[problem] ?? problem);
}

/** "2026-12-01T09:00" in Sri Lankan time for a datetime-local field. */
export function colomboInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 16);
}

/** The rules form's starting values for a cycle being edited. */
export function cycleValues(cycle: ManagedBudgetCycle): Record<string, string> {
  return {
    titleTa: cycle.titleTa,
    titleEn: cycle.titleEn,
    descriptionTa: cycle.rules.descriptionTa,
    descriptionEn: cycle.rules.descriptionEn,
    fundKind: cycle.fundKind,
    fundSourceTa: cycle.rules.fundSourceTa,
    fundSourceEn: cycle.rules.fundSourceEn,
    budget: Number(cycle.budget).toFixed(2),
    eligibilityTa: cycle.rules.eligibilityTa,
    eligibilityEn: cycle.rules.eligibilityEn,
    maxChoices: String(cycle.rules.maxChoices),
    votingOpensAt: colomboInput(cycle.votingOpensAt),
    votingClosesAt: colomboInput(cycle.votingClosesAt),
  };
}

/** Funded projects' allocations and spending, added up (FR-PBG-008). */
export function moneyTotals(projects: ManagedBudgetCycle['projects']): { allocated: number; spent: number } {
  return projects.reduce(
    (sum, project) => ({ allocated: sum.allocated + Number(project.allocated ?? 0), spent: sum.spent + Number(project.spent ?? 0) }),
    { allocated: 0, spent: 0 },
  );
}
