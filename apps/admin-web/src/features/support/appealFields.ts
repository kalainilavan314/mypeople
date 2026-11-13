import type { FieldSpec } from '@/components/SimpleForm';

import { OUTCOMES, OUTCOME_LABELS } from './forms';

/**
 * FR-AST-011: uphold with a reason, or change: a new outcome against a criteria version, with the
 * reason in both languages. The person whose decision is appealed cannot decide it.
 */
export function appealFields(criteria: readonly { value: string; label: string }[]): FieldSpec[] {
  const change = { field: 'change', values: ['change'] } as const;
  return [
    {
      name: 'change',
      label: 'Decision on the appeal',
      kind: 'radio',
      required: true,
      options: [
        { value: 'uphold', label: 'Uphold the decision' },
        { value: 'change', label: 'Change the decision' },
      ],
    },
    { name: 'reason', label: 'Reason in English, sent to the applicant', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 2000 },
    {
      name: 'outcome',
      label: 'New outcome',
      kind: 'select',
      required: true,
      showWhen: change,
      options: [{ value: '', label: 'Choose the outcome' }, ...OUTCOMES.map((outcome) => ({ value: outcome, label: `${OUTCOME_LABELS[outcome].ta} · ${OUTCOME_LABELS[outcome].en}` }))],
    },
    {
      name: 'criteriaVersionId',
      label: 'Criteria version',
      kind: 'select',
      required: true,
      showWhen: change,
      options: [{ value: '', label: criteria.length ? 'Choose the criteria' : 'No published criteria' }, ...criteria],
    },
    { name: 'reasonTa', label: 'Reason in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 3000, showWhen: change },
  ];
}
