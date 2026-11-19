import type { FieldSpec } from '@/components/SimpleForm';

import { SLOT_MODES, SLOT_MODE_LABELS } from './forms';

/** A series of consecutive slots of one length, from a start in Sri Lankan time. */
export const SLOT_SERIES_FIELDS: readonly FieldSpec[] = [
  { name: 'startsAt', label: 'First slot starts (Sri Lankan time)', kind: 'datetime', required: true },
  {
    name: 'mode',
    label: 'How they meet',
    kind: 'select',
    required: true,
    defaultValue: 'in_person',
    options: SLOT_MODES.map((mode) => ({ value: mode, label: `${SLOT_MODE_LABELS[mode].ta} · ${SLOT_MODE_LABELS[mode].en}` })),
  },
  { name: 'minutes', label: 'Minutes in each slot', kind: 'number', required: true, min: 10, max: 120, defaultValue: '30', hint: '10 to 120.' },
  { name: 'count', label: 'Number of slots, one after another', kind: 'number', required: true, min: 1, max: 16, defaultValue: '4', hint: '1 to 16.' },
  {
    name: 'placeTa',
    label: 'Place in Tamil (an official office)',
    lang: 'ta',
    required: true,
    minLength: 3,
    maxLength: 450,
    showWhen: { field: 'mode', values: ['in_person'] },
  },
  {
    name: 'placeEn',
    label: 'Place in English (an official office)',
    lang: 'en',
    required: true,
    minLength: 3,
    maxLength: 300,
    showWhen: { field: 'mode', values: ['in_person'] },
  },
];

export const REASON_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Reason', kind: 'textarea', required: true, minLength: 3, maxLength: 500 },
];

/** A cancelled booking's reason is shown to the member. */
export const CANCEL_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Reason, shown to the member', kind: 'textarea', required: true, minLength: 3, maxLength: 500 },
];

/** FR-APT-006: the outcome, and the note the member reads on the appointment and in My Activity. */
export const FOLLOW_UP_FIELDS: readonly FieldSpec[] = [
  {
    name: 'outcome',
    label: 'What happened',
    kind: 'radio',
    required: true,
    options: [
      { value: 'completed', label: 'We met' },
      { value: 'no_show', label: 'They did not come' },
    ],
  },
  {
    name: 'note',
    label: 'Follow-up note for the member',
    kind: 'textarea',
    maxLength: 2000,
    hint: 'The member reads this. Needed when you met. Write the next steps, not private details about anyone else.',
  },
];
