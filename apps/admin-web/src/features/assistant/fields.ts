import type { FieldSpec } from '@/components/SimpleForm';

/** A second Knowledge Editor approves the version, or sends it back with the reason the drafter reads. */
export const SOURCE_DECISION_FIELDS: readonly FieldSpec[] = [
  {
    name: 'decision',
    label: 'Decision',
    kind: 'radio',
    required: true,
    options: [
      { value: 'approve', label: 'Approve: the assistant starts using this version' },
      { value: 'return', label: 'Send back with a reason' },
    ],
  },
  { name: 'reason', label: 'Reason, shown to the person who drafted it', kind: 'textarea', required: true, minLength: 3, maxLength: 1000, showWhen: { field: 'decision', values: ['return'] } },
];

export function reviewFields(defaultDate: string): readonly FieldSpec[] {
  return [
    {
      name: 'reviewDue',
      label: 'Next review date',
      kind: 'date',
      required: true,
      defaultValue: defaultDate,
      hint: 'You checked the text still stands. At most two years ahead.',
    },
  ];
}

export const RETIRE_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Why it is no longer used', kind: 'textarea', required: true, minLength: 3, maxLength: 1000 },
];

/** FR-AIA-008: the Knowledge Editor closes each report with what was done. */
export const RESOLVE_FIELDS: readonly FieldSpec[] = [
  {
    name: 'outcome',
    label: 'Outcome',
    kind: 'radio',
    required: true,
    options: [
      { value: 'fixed', label: 'Fixed: a source was corrected or added' },
      { value: 'no_change', label: 'No change needed' },
    ],
  },
  { name: 'resolution', label: 'What was done, or why nothing needs to change', kind: 'textarea', required: true, minLength: 5, maxLength: 2000 },
];

export const HANDOVER_REPLY_FIELDS: readonly FieldSpec[] = [
  {
    name: 'reply',
    label: 'Reply to the member',
    kind: 'textarea',
    required: true,
    minLength: 5,
    maxLength: 3000,
    hint: 'The member reads it in the app, in the language they wrote in. Never ask for an ID number or a password.',
  },
];
