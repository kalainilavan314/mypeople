import type { FieldSpec } from '@/components/SimpleForm';

/** Publish the entry, or return it to the editors with a note (FR-LIV-003). */
export const REVIEW_FIELDS: readonly FieldSpec[] = [
  {
    name: 'decision',
    label: 'Decision',
    kind: 'radio',
    required: true,
    options: [
      { value: 'approve', label: 'Publish to members' },
      { value: 'return', label: 'Return to the editors with a note' },
    ],
  },
  {
    name: 'reason',
    label: 'Note for the editors',
    kind: 'textarea',
    required: true,
    minLength: 3,
    maxLength: 1000,
    showWhen: { field: 'decision', values: ['return'] },
  },
];

/** A member's report of an outdated entry: fixed, or dismissed with the reason. */
export const RESOLUTION_FIELDS: readonly FieldSpec[] = [
  {
    name: 'outcome',
    label: 'Outcome',
    kind: 'radio',
    required: true,
    options: [
      { value: 'fixed', label: 'Fixed: the entry was corrected, or it is right as it is now' },
      { value: 'dismissed', label: 'Dismiss with a reason' },
    ],
  },
  {
    name: 'reason',
    label: 'Note (needed to dismiss; never shown with the reporter’s name)',
    kind: 'textarea',
    maxLength: 500,
  },
];

export const WITHDRAW_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Why it leaves the guide', kind: 'textarea', required: true, minLength: 3, maxLength: 500 },
];
