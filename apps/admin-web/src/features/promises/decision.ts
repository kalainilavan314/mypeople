import type { FieldSpec } from '@/components/SimpleForm';

/** Approve, or return with the reason the drafter is told (publication and updates). */
export const DECISION_FIELDS: readonly FieldSpec[] = [
  {
    name: 'decision',
    label: 'Decision',
    kind: 'radio',
    required: true,
    options: [
      { value: 'approve', label: 'Approve' },
      { value: 'return', label: 'Return with a reason' },
    ],
  },
  { name: 'reason', label: 'Reason, sent to the person who drafted it', kind: 'textarea', required: true, maxLength: 1000, showWhen: { field: 'decision', values: ['return'] } },
];

/** Publish member feedback, or reject it with the reason the member is told. */
export const MODERATION_FIELDS: readonly FieldSpec[] = [
  {
    name: 'decision',
    label: 'Decision',
    kind: 'radio',
    required: true,
    options: [
      { value: 'approve', label: 'Publish' },
      { value: 'return', label: 'Reject with a reason' },
    ],
  },
  { name: 'reason', label: 'Reason, sent to the member', kind: 'textarea', required: true, maxLength: 500, showWhen: { field: 'decision', values: ['return'] } },
];

export const REPLY_FIELDS: readonly FieldSpec[] = [
  { name: 'replyTa', label: 'Office reply in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 3, maxLength: 3000 },
  { name: 'replyEn', label: 'Office reply in English', kind: 'textarea', lang: 'en', required: true, minLength: 3, maxLength: 2000 },
];
