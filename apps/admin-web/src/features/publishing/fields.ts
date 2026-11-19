import type { FieldSpec } from '@/components/SimpleForm';

import { LIMITS } from './forms';

/** The statement in Tamil and English, Tamil first. A draft may be saved incomplete. */
export const STATEMENT_FIELDS: readonly FieldSpec[] = [
  { name: 'titleTa', label: 'Title in Tamil', lang: 'ta', maxLength: LIMITS.title },
  { name: 'titleEn', label: 'Title in English', lang: 'en', maxLength: LIMITS.title },
  { name: 'bodyTa', label: 'Statement in Tamil', kind: 'textarea', lang: 'ta', maxLength: LIMITS.bodyTa, rows: 8 },
  { name: 'bodyEn', label: 'Statement in English', kind: 'textarea', lang: 'en', maxLength: LIMITS.bodyEn, rows: 8 },
];

/** A correction: the whole new text, required, and the reason shown with it (BR-150). */
export const CORRECTION_FIELDS: readonly FieldSpec[] = [
  ...STATEMENT_FIELDS.map((field) => ({ ...field, required: true, minLength: 1 })),
  { name: 'reasonTa', label: 'Reason for the correction in Tamil (shown to everyone)', kind: 'textarea', lang: 'ta', required: true, minLength: 3, maxLength: LIMITS.reasonTa, rows: 3 },
  { name: 'reasonEn', label: 'Reason for the correction in English (shown to everyone)', kind: 'textarea', lang: 'en', required: true, minLength: 3, maxLength: LIMITS.reasonEn, rows: 3 },
];

export const WITHDRAWAL_FIELDS: readonly FieldSpec[] = [
  { name: 'reasonTa', label: 'Why it is withdrawn, in Tamil (shown to everyone who checks it)', kind: 'textarea', lang: 'ta', required: true, minLength: 3, maxLength: LIMITS.reasonTa, rows: 3 },
  { name: 'reasonEn', label: 'Why it is withdrawn, in English (shown to everyone who checks it)', kind: 'textarea', lang: 'en', required: true, minLength: 3, maxLength: LIMITS.reasonEn, rows: 3 },
];

export const PUBLISHER_FIELDS: readonly FieldSpec[] = [
  { name: 'memberCode', label: 'Member code of the person', required: true, minLength: 3, maxLength: 40, mono: true, hint: 'They must already hold content.sign_publish (Roles and access). You cannot register yourself.' },
  { name: 'nameTa', label: 'Name shown on statements, in Tamil', lang: 'ta', required: true, minLength: 2, maxLength: LIMITS.name, hint: 'A role or office, such as the media office.' },
  { name: 'nameEn', label: 'Name shown on statements, in English', lang: 'en', required: true, minLength: 2, maxLength: LIMITS.name },
];

export const REVOKE_FIELDS: readonly FieldSpec[] = [
  { name: 'reason', label: 'Reason for revoking', kind: 'textarea', required: true, minLength: 3, maxLength: 500, rows: 2 },
];
