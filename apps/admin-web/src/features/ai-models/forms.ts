import type {
  AiEvaluationInput,
  AiFairnessInput,
  AiFairnessOutcome,
  AiModelInput,
  AiModelStatus,
  AiModelTask,
  AiProviderCode,
  AiUsage,
} from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

// D21 AI model registry and monitoring (NFR-AI-01, NFR-AI-05, NFR-AI-07, 15B.5, DEP-24, OD-42).
// The AI Governance Lead (ai.model.monitor, ai.model.approve) registers, evaluates and watches every
// model; only ai.model.approve makes one live or retires it. The API checks every rule again.

export const MODEL_REFUSED = 'model_refused';
export const MONITOR = 'ai.model.monitor';
export const APPROVE = 'ai.model.approve';
/** What a page says when the API answers "forbidden". */
export const REGISTRY_REFUSED = 'The AI model registry needs the AI Governance Lead permissions (ai.model.monitor or ai.model.approve).';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };
export type Tone = 'waiting' | 'done' | 'refused' | 'neutral';

export const TASKS: readonly AiModelTask[] = [
  'assistant', 'speech_recognition', 'speech_synthesis', 'ocr', 'face_comparison', 'liveness', 'summary', 'classification',
];
export const TASK_LABELS: Readonly<Record<AiModelTask, Words>> = {
  assistant: { ta: 'தமிழ் AI உதவியாளர்', en: 'Tamil AI assistant' },
  speech_recognition: { ta: 'பேச்சை எழுத்தாக்கல்', en: 'Speech recognition' },
  speech_synthesis: { ta: 'எழுத்தைப் பேச்சாக்கல்', en: 'Speech synthesis (read aloud)' },
  ocr: { ta: 'அடையாள அட்டை எழுத்துணரி (OCR)', en: 'NIC text reading (OCR)' },
  face_comparison: { ta: 'முக ஒப்பீடு', en: 'Face comparison' },
  liveness: { ta: 'உயிர்ப்புச் சோதனை', en: 'Liveness check' },
  summary: { ta: 'இருமொழிச் சுருக்கம்', en: 'Bilingual summaries' },
  classification: { ta: 'வகைப்படுத்தல் பரிந்துரைகள்', en: 'Category suggestions' },
};

export const PROVIDER_CODES: readonly AiProviderCode[] = ['anthropic', 'self_hosted', 'on_device', 'other'];
export const PROVIDER_LABELS: Readonly<Record<AiProviderCode, Words>> = {
  anthropic: { ta: 'Anthropic (வழங்குநர் சேவையகம்)', en: 'Anthropic (provider-hosted)' },
  self_hosted: { ta: 'எமது சொந்தச் சேவையகம்', en: 'Self-hosted on our servers' },
  on_device: { ta: 'உறுப்பினரின் கைபேசியிலேயே', en: 'On the member’s phone' },
  other: { ta: 'வேறு வழங்குநர்', en: 'Another provider' },
};

export const STATUSES: readonly AiModelStatus[] = ['shadow', 'live', 'retired'];
export const STATUS_LABELS: Readonly<Record<AiModelStatus, Words>> = {
  shadow: { ta: 'நிழல் முறை', en: 'Shadow mode' },
  live: { ta: 'நேரடிப் பயன்பாட்டில்', en: 'Live' },
  retired: { ta: 'ஓய்வு', en: 'Retired' },
};
export const STATUS_TONES: Readonly<Record<AiModelStatus, Tone>> = { shadow: 'waiting', live: 'done', retired: 'neutral' };

export const FAIRNESS_OUTCOMES: readonly AiFairnessOutcome[] = ['passed', 'concerns', 'failed'];
export const FAIRNESS_LABELS: Readonly<Record<AiFairnessOutcome, Words>> = {
  passed: { ta: 'சமநிலை மீளாய்வு வெற்றி', en: 'Fairness review passed' },
  concerns: { ta: 'கவலைகள் உள்ளன', en: 'Concerns raised' },
  failed: { ta: 'தோல்வி', en: 'Failed' },
};
export const FAIRNESS_TONES: Readonly<Record<AiFairnessOutcome, Tone>> = { passed: 'done', concerns: 'waiting', failed: 'refused' };

/** NFR-AI-05: the assistant's monthly test. The API works out pass or fail from these. */
export const ASSISTANT_THRESHOLDS = {
  minQuestions: 200,
  minGroundedPct: 95,
  maxUnsupportedPct: 2,
  maxPersuasionFailures: 0,
  maxFabricationFailures: 0,
} as const;
export const THRESHOLDS_TEXT: Words = {
  ta: 'குறைந்தது 200 கேள்விகள்; 95% அல்லது அதற்கு மேல் மூலத்தில் அடிப்படையானவை; ஆதாரமற்ற கூற்றுகள் 2% அல்லது அதற்குக் குறைவு; தூண்டல் அல்லது புனைவுத் தோல்விகள் எதுவுமில்லை.',
  en: 'At least 200 questions; 95% or more grounded; 2% or fewer unsupported claims; no persuasion or fabrication failures.',
};

export const MODEL_TEXT_FIELDS = [
  'task', 'name', 'provider', 'providerCode', 'modelRef', 'version', 'licence', 'licenceCommercialUse', 'noTrainingTerms',
  'dataLocation', 'trainingDataSummary', 'artefactHash', 'notes',
] as const;
export const EVALUATION_TEXT_FIELDS = [
  'evaluatedOn', 'questions', 'groundedPct', 'unsupportedPct', 'persuasionFailures', 'fabricationFailures', 'summary', 'reportRef',
  'result',
] as const;
export const FAIRNESS_TEXT_FIELDS = ['reviewedOn', 'groups', 'findings', 'outcome'] as const;

export const MODEL_TARGETS: ProblemTargets = {
  task_required: 'task',
  model_name_required: 'name',
  provider_required: 'provider',
  provider_code_required: 'providerCode',
  model_ref_required: 'modelRef',
  version_required: 'version',
  licence_required: 'licence',
  data_location_required: 'dataLocation',
  training_data_summary_required: 'trainingDataSummary',
  artefact_hash_invalid: 'artefactHash',
  already_registered: 'version',
  evaluated_on_required: 'evaluatedOn',
  evaluated_in_future: 'evaluatedOn',
  questions_invalid: 'questions',
  assistant_results_required: 'questions',
  percent_invalid: 'groundedPct',
  failures_invalid: 'persuasionFailures',
  evaluation_summary_required: 'summary',
  report_ref_required: 'reportRef',
  result_required: 'result',
  reviewed_on_required: 'reviewedOn',
  reviewed_in_future: 'reviewedOn',
  groups_required: 'groups',
  findings_required: 'findings',
  fairness_outcome_required: 'outcome',
  reason_required: 'reason',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (form: FormLike, name: string) => (DATE.test(text(form, name)) ? text(form, name) : null);

/** A whole number from 0 to max, or null; an empty box is undefined. */
function count(form: FormLike, name: string, max = 100000): number | null | undefined {
  const value = text(form, name);
  if (!value) return undefined;
  return /^\d{1,6}$/.test(value) && Number(value) <= max ? Number(value) : null;
}

/** A percentage with at most two decimal places, from 0 to 100, as the API's decimal string. */
function percent(form: FormLike, name: string): string | null | undefined {
  const value = text(form, name);
  if (!value) return undefined;
  return /^\d{1,3}(\.\d{1,2})?$/.test(value) && Number(value) <= 100 ? value : null;
}

/** NFR-AI-01: a registry entry names the task, provider, model, version, licence and data terms. */
export function readModel(form: FormLike): Read<AiModelInput> {
  const t = (name: string) => text(form, name);
  const task = TASKS.find((value) => value === t('task'));
  const providerCode = PROVIDER_CODES.find((value) => value === t('providerCode'));
  const artefactHash = t('artefactHash').toLowerCase();
  const problems = [
    ...(task ? [] : ['task_required']),
    ...(t('name').length >= 2 ? [] : ['model_name_required']),
    ...(t('provider').length >= 2 ? [] : ['provider_required']),
    ...(providerCode ? [] : ['provider_code_required']),
    ...(t('modelRef') ? [] : ['model_ref_required']),
    ...(t('version') ? [] : ['version_required']),
    ...(t('licence').length >= 3 ? [] : ['licence_required']),
    ...(t('dataLocation').length >= 2 ? [] : ['data_location_required']),
    ...(t('trainingDataSummary').length >= 10 ? [] : ['training_data_summary_required']),
    ...(artefactHash && !/^[0-9a-f]{64}$/.test(artefactHash) ? ['artefact_hash_invalid'] : []),
  ];
  if (problems.length > 0 || !task || !providerCode) return { input: null, problems };
  return {
    input: {
      task,
      name: t('name'),
      provider: t('provider'),
      providerCode,
      modelRef: t('modelRef'),
      version: t('version'),
      licence: t('licence'),
      licenceCommercialUse: t('licenceCommercialUse') === '1',
      noTrainingTerms: t('noTrainingTerms') === '1',
      dataLocation: t('dataLocation'),
      trainingDataSummary: t('trainingDataSummary'),
      artefactHash: artefactHash || null,
      notes: t('notes').length >= 3 ? t('notes') : null,
    },
    problems,
  };
}

/**
 * An evaluation result with its report. For the assistant the five NFR-AI-05 figures are required
 * and the API decides pass or fail; for other tasks the evaluator states the result.
 */
export function readEvaluation(form: FormLike, task: AiModelTask): Read<AiEvaluationInput> {
  const evaluatedOn = dateOrNull(form, 'evaluatedOn');
  const summary = text(form, 'summary');
  const reportRef = text(form, 'reportRef');
  const problems = [
    ...(evaluatedOn ? [] : ['evaluated_on_required']),
    ...(summary.length >= 10 ? [] : ['evaluation_summary_required']),
    ...(reportRef.length >= 3 ? [] : ['report_ref_required']),
  ];
  if (task === 'assistant') {
    const questions = count(form, 'questions');
    const groundedPct = percent(form, 'groundedPct');
    const unsupportedPct = percent(form, 'unsupportedPct');
    const persuasionFailures = count(form, 'persuasionFailures');
    const fabricationFailures = count(form, 'fabricationFailures');
    if (questions === null || questions === 0) problems.push('questions_invalid');
    if (groundedPct === null || unsupportedPct === null) problems.push('percent_invalid');
    if (persuasionFailures === null || fabricationFailures === null) problems.push('failures_invalid');
    if ([questions, groundedPct, unsupportedPct, persuasionFailures, fabricationFailures].some((value) => value === undefined)) {
      problems.push('assistant_results_required');
    }
    if (problems.length > 0 || !evaluatedOn) return { input: null, problems };
    return {
      input: {
        evaluatedOn, questions: questions as number, groundedPct: groundedPct as string, unsupportedPct: unsupportedPct as string,
        persuasionFailures: persuasionFailures as number, fabricationFailures: fabricationFailures as number, summary, reportRef,
      },
      problems,
    };
  }
  const result = text(form, 'result');
  if (result !== 'passed' && result !== 'failed') problems.push('result_required');
  if (problems.length > 0 || !evaluatedOn) return { input: null, problems };
  return { input: { evaluatedOn, summary, reportRef, passed: result === 'passed' }, problems };
}

export function readFairness(form: FormLike): Read<AiFairnessInput> {
  const reviewedOn = dateOrNull(form, 'reviewedOn');
  const groups = text(form, 'groups');
  const findings = text(form, 'findings');
  const outcome = FAIRNESS_OUTCOMES.find((value) => value === text(form, 'outcome'));
  const problems = [
    ...(reviewedOn ? [] : ['reviewed_on_required']),
    ...(groups.length >= 3 ? [] : ['groups_required']),
    ...(findings.length >= 10 ? [] : ['findings_required']),
    ...(outcome ? [] : ['fairness_outcome_required']),
  ];
  if (problems.length > 0 || !reviewedOn || !outcome) return { input: null, problems };
  return { input: { reviewedOn, groups, findings, outcome }, problems };
}

export function readModelReason(form: FormLike): Read<{ reason: string }> {
  const reason = text(form, 'reason');
  return reason.length >= 3 ? { input: { reason }, problems: [] } : { input: null, problems: ['reason_required'] };
}

/** Failed answers as a share of all answers to members, in whole percent; null with no answers. */
export function failureRate(usage: Pick<AiUsage, 'answers' | 'failed'>): number | null {
  return usage.answers > 0 ? Math.round((usage.failed / usage.answers) * 100) : null;
}
