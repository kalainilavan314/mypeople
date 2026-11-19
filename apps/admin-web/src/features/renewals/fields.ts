import type { FieldSpec } from '@/components/SimpleForm';

import { KINDS, KIND_LABELS, REASON_MAX, REASON_MIN } from './forms';

/** D25 issue: the member, the kind, and the event for an event-participation certificate. */
export const ISSUE_FIELDS: readonly FieldSpec[] = [
  { name: 'memberCode', label: 'Member ID', required: true, minLength: 3, maxLength: 40, mono: true, hint: 'The exact member ID, for a member in your areas.' },
  {
    name: 'kind',
    label: 'Certificate',
    kind: 'select',
    required: true,
    options: [{ value: '', label: 'Choose' }, ...KINDS.map((kind) => ({ value: kind, label: `${KIND_LABELS[kind].ta} · ${KIND_LABELS[kind].en}` }))],
  },
  {
    name: 'eventId',
    label: 'Event ID',
    required: true,
    mono: true,
    hint: 'The event the member attended; their attendance must have been recorded at check-in.',
    showWhen: { field: 'kind', values: ['event_participation'] },
  },
];

export const REVOKE_FIELDS: readonly FieldSpec[] = [
  {
    name: 'reason',
    label: 'Reason for revoking, shown to the member',
    kind: 'textarea',
    required: true,
    minLength: REASON_MIN,
    maxLength: REASON_MAX,
    hint: 'The certificate then checks as Revoked. The reason stays with the certificate, not in the audit log.',
  },
];

export const REISSUE_FIELDS: readonly FieldSpec[] = [
  {
    name: 'reason',
    label: 'Reason for reissuing',
    kind: 'textarea',
    required: true,
    minLength: REASON_MIN,
    maxLength: REASON_MAX,
    hint: 'A new certificate is made from the current records (a corrected name, more completed assignments); this one then checks as Superseded.',
  },
];
