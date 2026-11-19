import type { FieldSpec } from '@/components/SimpleForm';

import { FAIRNESS_LABELS, FAIRNESS_OUTCOMES, PROVIDER_CODES, PROVIDER_LABELS, TASKS, TASK_LABELS } from './forms';

/** NFR-AI-01: what a registry entry records. Tamil labels sit with English in each option. */
export const MODEL_FIELDS: readonly FieldSpec[] = [
  {
    name: 'task',
    label: 'Task',
    kind: 'select',
    required: true,
    options: [{ value: '', label: 'Choose the task' }, ...TASKS.map((task) => ({ value: task, label: `${TASK_LABELS[task].ta} · ${TASK_LABELS[task].en}` }))],
  },
  { name: 'name', label: 'Model name', required: true, minLength: 2, maxLength: 120, hint: 'For example: Claude Opus' },
  { name: 'provider', label: 'Who runs it', required: true, minLength: 2, maxLength: 120, hint: 'For example: Anthropic (hosted API)' },
  {
    name: 'providerCode',
    label: 'Where it runs',
    kind: 'select',
    required: true,
    hint: 'The assistant answers only with a live anthropic entry whose model id matches the server settings.',
    options: [
      { value: '', label: 'Choose where it runs' },
      ...PROVIDER_CODES.map((code) => ({ value: code, label: `${PROVIDER_LABELS[code].ta} · ${PROVIDER_LABELS[code].en}` })),
    ],
  },
  { name: 'modelRef', label: 'Model id as the provider names it', required: true, maxLength: 120, mono: true, hint: 'For example: claude-opus-5-5' },
  { name: 'version', label: 'Version', required: true, maxLength: 60 },
  { name: 'licence', label: 'Licence (DEP-24)', required: true, minLength: 3, maxLength: 300, wide: true },
  {
    name: 'licenceCommercialUse',
    label: 'The licence allows commercial use (DEP-24)',
    kind: 'checkbox',
    hint: 'Checked against the licence text. Many public models do not allow it.',
  },
  {
    name: 'noTrainingTerms',
    label: 'The provider may not train on what is sent (OD-42)',
    kind: 'checkbox',
    hint: 'Needed before a provider-hosted model can go live. Not needed for self-hosted or on-device models.',
  },
  { name: 'dataLocation', label: 'Where the data is processed', required: true, minLength: 2, maxLength: 200, hint: 'For example: United States (provider-hosted), or our server in Sri Lanka.' },
  { name: 'trainingDataSummary', label: 'Training data summary (NFR-AI-01)', kind: 'textarea', required: true, minLength: 10, maxLength: 2000 },
  { name: 'artefactHash', label: 'Artefact SHA-256 (optional)', maxLength: 64, mono: true, hint: 'For a self-hosted model file: 64 hexadecimal characters.' },
  { name: 'notes', label: 'Notes (optional)', kind: 'textarea', maxLength: 2000 },
];

/** NFR-AI-05: the assistant's monthly 200-question test; the API decides pass or fail. */
export function assistantEvaluationFields(today: string): readonly FieldSpec[] {
  return [
    { name: 'evaluatedOn', label: 'Date of the evaluation', kind: 'date', required: true, defaultValue: today },
    { name: 'questions', label: 'Questions asked', kind: 'number', required: true, min: 1, max: 100000, hint: 'At least 200 (Tamil and English).' },
    { name: 'groundedPct', label: 'Grounded answers (%)', required: true, maxLength: 6, hint: '95 or more to pass. Up to two decimals.' },
    { name: 'unsupportedPct', label: 'Unsupported claims (%)', required: true, maxLength: 6, hint: '2 or fewer to pass.' },
    { name: 'persuasionFailures', label: 'Persuasion red-team failures', kind: 'number', required: true, min: 0, max: 100000, hint: 'Must be 0.' },
    { name: 'fabricationFailures', label: 'Fabrication red-team failures', kind: 'number', required: true, min: 0, max: 100000, hint: 'Must be 0.' },
    { name: 'summary', label: 'Summary', kind: 'textarea', required: true, minLength: 10, maxLength: 3000 },
    { name: 'reportRef', label: 'Where the evaluation report is kept', required: true, minLength: 3, maxLength: 300, wide: true },
  ];
}

/** Other tasks: the evaluator states the result against the task's own criteria (15B.3). */
export function otherEvaluationFields(today: string): readonly FieldSpec[] {
  return [
    { name: 'evaluatedOn', label: 'Date of the evaluation', kind: 'date', required: true, defaultValue: today },
    {
      name: 'result',
      label: 'Result',
      kind: 'radio',
      required: true,
      options: [
        { value: 'passed', label: 'Passed its thresholds' },
        { value: 'failed', label: 'Failed' },
      ],
    },
    { name: 'summary', label: 'Summary, with the figures', kind: 'textarea', required: true, minLength: 10, maxLength: 3000 },
    { name: 'reportRef', label: 'Where the evaluation report is kept', required: true, minLength: 3, maxLength: 300, wide: true },
  ];
}

export function fairnessFields(today: string): readonly FieldSpec[] {
  return [
    { name: 'reviewedOn', label: 'Date of the review', kind: 'date', required: true, defaultValue: today },
    {
      name: 'outcome',
      label: 'Outcome',
      kind: 'radio',
      required: true,
      options: FAIRNESS_OUTCOMES.map((outcome) => ({ value: outcome, label: `${FAIRNESS_LABELS[outcome].ta} · ${FAIRNESS_LABELS[outcome].en}` })),
    },
    { name: 'groups', label: 'Groups compared', kind: 'textarea', required: true, minLength: 3, maxLength: 1000, hint: 'For example: Jaffna, Vanni, Mannar, Batticaloa and Trincomalee speakers; age bands; Tamil and English.' },
    { name: 'findings', label: 'Findings', kind: 'textarea', required: true, minLength: 10, maxLength: 3000 },
  ];
}

export const DECISION_REASON_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Reason, kept in the registry', kind: 'textarea', required: true, minLength: 3, maxLength: 1000 },
];
