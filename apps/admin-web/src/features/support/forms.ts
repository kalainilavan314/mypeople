import type {
  SupportAppealDecisionInput,
  SupportCategory,
  SupportDecisionInput,
  SupportDeliveryInput,
  SupportIntakeInput,
  SupportPartnerInput,
  SupportProgrammeInput,
} from '@my-people/api-client';

import { checked, readArea, text, uuidOrNull, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the community support API uses, and the one the dashboard's own checks use too. */
export const SUPPORT_REFUSED = 'support_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
type Outcome = SupportDecisionInput['outcome'];

export const CATEGORIES: readonly SupportCategory[] = [
  'food', 'low_income', 'unemployment', 'education', 'disability_access', 'elderly_care', 'housing', 'emergency_needs',
  'vocational_training', 'livelihood',
];
export const CATEGORY_LABELS: Readonly<Record<SupportCategory, Words>> = {
  food: { ta: 'உணவு', en: 'Food' },
  low_income: { ta: 'குறைந்த வருமானம்', en: 'Low income' },
  unemployment: { ta: 'வேலையின்மை', en: 'Unemployment' },
  education: { ta: 'கல்வி', en: 'Education' },
  disability_access: { ta: 'மாற்றுத்திறன் அணுகல்', en: 'Disability access' },
  elderly_care: { ta: 'முதியோர் பராமரிப்பு', en: 'Elderly care' },
  housing: { ta: 'வீடமைப்பு', en: 'Housing' },
  emergency_needs: { ta: 'அவசரத் தேவைகள்', en: 'Emergency needs' },
  vocational_training: { ta: 'தொழிற்பயிற்சி', en: 'Vocational training' },
  livelihood: { ta: 'வாழ்வாதாரம்', en: 'Livelihood' },
};

export const OUTCOMES: readonly Outcome[] = ['approved', 'partly_approved', 'not_eligible', 'referred'];
export const OUTCOME_LABELS: Readonly<Record<Outcome, Words>> = {
  approved: { ta: 'அங்கீகரிக்கப்பட்டது', en: 'Approved' },
  partly_approved: { ta: 'பகுதியளவில் அங்கீகரிக்கப்பட்டது', en: 'Partly approved' },
  not_eligible: { ta: 'தகுதியில்லை', en: 'Not eligible' },
  referred: { ta: 'வேறு சேவைக்குப் பரிந்துரைக்கப்பட்டது', en: 'Referred elsewhere' },
};

export const CASE_STATES = ['screening', 'assessment', 'decided', 'closed', 'withdrawn'] as const;
export const STATE_LABELS: Readonly<Record<string, Words>> = {
  screening: { ta: 'ஆரம்பப் பரிசீலனை', en: 'Screening' },
  assessment: { ta: 'மதிப்பீடு', en: 'Assessment' },
  decided: { ta: 'முடிவுசெய்யப்பட்டது', en: 'Decided' },
  closed: { ta: 'மூடப்பட்டது', en: 'Closed' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};

export const PARTNER_KINDS: readonly SupportPartnerInput['kind'][] = ['ngo', 'public_service', 'hospital', 'other'];
export const PARTNER_KIND_LABELS: Readonly<Record<string, Words>> = {
  ngo: { ta: 'அரச சார்பற்ற நிறுவனம்', en: 'NGO' },
  public_service: { ta: 'அரச சேவை', en: 'Public service' },
  hospital: { ta: 'வைத்தியசாலை', en: 'Hospital' },
  other: { ta: 'ஏனையவை', en: 'Other' },
};

export const SUPPORT_TARGETS: ProblemTargets = {
  category_required: 'category',
  case_summary_required: 'summary',
  full_name_required: 'fullName',
  phone_invalid: 'phone',
  consent_required: 'consent',
  area_required: 'area',
  unknown_area: 'area',
  channel_required: 'channel',
  partner_required: 'partnerId',
  partner_not_found: 'partnerId',
  partner_consent_required: 'consent',
  caseworker_required: 'caseworkerId',
  caseworker_not_eligible: 'caseworkerId',
  case_note_required: 'body',
  outcome_required: 'outcome',
  criteria_version_required: 'criteriaVersionId',
  reason_required: 'reasonTa',
  delivery_incomplete: 'kind',
  close_note_required: 'note',
  decision_required: 'change',
  new_decision_required: 'outcome',
  appeal_reason_required: 'reason',
  programme_text_required: 'nameTa',
  categories_required: 'categories',
  criteria_text_required: 'criteriaTa',
  partner_details_required: 'name',
  referral_state_required: 'state',
};

const PHONE = /^\+?[0-9 ]{9,15}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * S11: a hotline call or a partner's referral, recorded for someone who need not be a member. The
 * caller's consent to collect the case details comes first (FR-AST-004).
 */
export function readIntake(form: FormLike): Read<SupportIntakeInput> {
  const category = CATEGORIES.find((item) => item === text(form, 'category'));
  const channel = text(form, 'channel');
  const partnerId = uuidOrNull(form, 'partnerId');
  const phone = text(form, 'phone');
  const area = readArea(text(form, 'area'));
  const supportArea = area && area.level !== 'province' ? { level: area.level, code: area.code } : null;
  const problems = [
    ...(form.get('consent') === '1' ? [] : ['consent_required']),
    ...(category ? [] : ['category_required']),
    ...(text(form, 'summary').length >= 10 ? [] : ['case_summary_required']),
    ...(text(form, 'fullName').length >= 2 ? [] : ['full_name_required']),
    ...(phone && !PHONE.test(phone) ? ['phone_invalid'] : []),
    ...(supportArea ? [] : ['area_required']),
    ...(channel === 'hotline' || channel === 'partner' ? [] : ['channel_required']),
    ...(channel === 'partner' && !partnerId ? ['partner_required'] : []),
  ];
  if (problems.length > 0 || !category || !supportArea || (channel !== 'hotline' && channel !== 'partner')) return { input: null, problems };
  return {
    input: {
      category,
      summary: text(form, 'summary'),
      emergency: form.get('emergency') === '1',
      consent: true,
      fullName: text(form, 'fullName'),
      phone: phone || null,
      household: text(form, 'household') || null,
      area: supportArea,
      channel,
      partnerId: channel === 'partner' ? partnerId : null,
    },
    problems,
  };
}

/** FR-AST-008: an outcome against the programme's published criteria version, with reasons in both languages. */
export function readDecision(form: FormLike): Read<SupportDecisionInput> {
  const outcome = OUTCOMES.find((item) => item === text(form, 'outcome'));
  const criteriaVersionId = uuidOrNull(form, 'criteriaVersionId');
  const reasonTa = text(form, 'reasonTa');
  const reasonEn = text(form, 'reasonEn');
  const problems = [
    ...(outcome ? [] : ['outcome_required']),
    ...(criteriaVersionId ? [] : ['criteria_version_required']),
    ...(reasonTa.length >= 10 && reasonEn.length >= 10 ? [] : ['reason_required']),
  ];
  if (problems.length > 0 || !outcome || !criteriaVersionId) return { input: null, problems };
  return { input: { outcome, criteriaVersionId, reasonTa, reasonEn }, problems };
}

/** FR-AST-010: what was delivered, how much, when, by whom, and the evidence. */
export function readDelivery(form: FormLike): Read<SupportDeliveryInput> {
  const input = {
    kind: text(form, 'kind'),
    amount: text(form, 'amount'),
    deliveredOn: text(form, 'deliveredOn'),
    provider: text(form, 'provider'),
    evidence: text(form, 'evidence'),
  };
  const complete = input.kind.length >= 3 && input.amount && DATE.test(input.deliveredOn) && input.provider.length >= 2 && input.evidence.length >= 3;
  return complete ? { input, problems: [] } : { input: null, problems: ['delivery_incomplete'] };
}

/**
 * FR-AST-011: uphold the decision with a reason, or change it: a new outcome against a criteria
 * version, with the reason in both languages. Never by the person who made the decision.
 */
export function readAppealDecision(form: FormLike): Read<SupportAppealDecisionInput> {
  const choice = text(form, 'change');
  const reason = text(form, 'reason');
  if (choice !== 'uphold' && choice !== 'change') return { input: null, problems: ['decision_required'] };
  if (reason.length < 10) return { input: null, problems: ['appeal_reason_required'] };
  if (choice === 'uphold') return { input: { change: false, reason }, problems: [] };
  const outcome = OUTCOMES.find((item) => item === text(form, 'outcome'));
  const criteriaVersionId = uuidOrNull(form, 'criteriaVersionId');
  const reasonTa = text(form, 'reasonTa');
  if (!outcome || !criteriaVersionId || reasonTa.length < 10) return { input: null, problems: ['new_decision_required'] };
  return { input: { change: true, reason, outcome, criteriaVersionId, reasonTa }, problems: [] };
}

export function readProgramme(form: FormLike): Read<SupportProgrammeInput> {
  const categories = checked(form, 'categories').filter((item): item is SupportCategory => (CATEGORIES as readonly string[]).includes(item));
  const input = {
    nameTa: text(form, 'nameTa'),
    nameEn: text(form, 'nameEn'),
    descriptionTa: text(form, 'descriptionTa'),
    descriptionEn: text(form, 'descriptionEn'),
    categories,
  };
  const problems = [
    ...(input.nameTa.length >= 3 && input.nameEn.length >= 3 && input.descriptionTa.length >= 10 && input.descriptionEn.length >= 10 ? [] : ['programme_text_required']),
    ...(categories.length > 0 ? [] : ['categories_required']),
  ];
  return problems.length ? { input: null, problems } : { input, problems };
}

export function readPartner(form: FormLike): Read<SupportPartnerInput> {
  const kind = PARTNER_KINDS.find((item) => item === text(form, 'kind'));
  const name = text(form, 'name');
  const contact = text(form, 'contact');
  if (!kind || name.length < 2 || contact.length < 3) return { input: null, problems: ['partner_details_required'] };
  return { input: { name, kind, contact }, problems: [] };
}

/** The current published criteria version of each active programme, for a decision. */
export function criteriaOptions(programmes: readonly { nameEn: string; nameTa: string; active: boolean; criteriaVersionId: string | null; criteriaVersion: number | null }[]) {
  return programmes
    .filter((programme) => programme.active && programme.criteriaVersionId)
    .map((programme) => ({
      value: programme.criteriaVersionId as string,
      label: `${programme.nameTa} · ${programme.nameEn} (criteria v${programme.criteriaVersion})`,
    }));
}

/** Emergencies first, then the oldest; help never waits on anything but need. */
export function queueOrder<T extends { emergency: boolean; createdAt: string }>(cases: readonly T[]): T[] {
  return [...cases].sort((a, b) => Number(b.emergency) - Number(a.emergency) || a.createdAt.localeCompare(b.createdAt));
}
