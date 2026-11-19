import type {
  OfficialCorrectionInput,
  OfficialDraftInput,
  OfficialPublisherInput,
  OfficialStatementState,
  OfficialWithdrawInput,
} from '@my-people/api-client';

import { text, uuidOrNull, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the official content API uses, and the one the dashboard's own checks use too. */
export const OFFICIAL_REFUSED = 'official_refused';

type Words = { ta: string; en: string };
type Read<T> = { input: T | null; problems: string[] };

// The API's limits (OfficialDraftIn, OfficialCorrectionIn, OfficialWithdrawIn, PublisherIn).
export const LIMITS = { title: 200, bodyEn: 5000, bodyTa: 6000, reasonEn: 1000, reasonTa: 1200, name: 120 } as const;

export const STATES: readonly OfficialStatementState[] = ['draft', 'published', 'withdrawn'];
export const STATE_LABELS: Readonly<Record<OfficialStatementState, Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  published: { ta: 'கையொப்பமிட்டு வெளியிடப்பட்டது', en: 'Signed and published' },
  withdrawn: { ta: 'மீளப்பெறப்பட்டது', en: 'Withdrawn' },
};
export const STATE_TONES: Readonly<Record<OfficialStatementState, 'waiting' | 'done' | 'neutral'>> = {
  draft: 'waiting',
  published: 'done',
  withdrawn: 'neutral',
};
export const SIGNED_LABEL: Words = { ta: 'கையொப்பம் உறுதிப்படுகிறது', en: 'Signature verifies' };
export const UNSIGNED_LABEL: Words = { ta: 'கையொப்பம் உறுதிப்படவில்லை', en: 'Signature does not verify' };

export const STATEMENT_TEXT_FIELDS = ['titleTa', 'titleEn', 'bodyTa', 'bodyEn'] as const;
export const CORRECTION_TEXT_FIELDS = [...STATEMENT_TEXT_FIELDS, 'reasonTa', 'reasonEn', 'image'] as const;

export const OFFICIAL_TARGETS: ProblemTargets = {
  title_ta_required: 'titleTa',
  title_en_required: 'titleEn',
  body_ta_required: 'bodyTa',
  body_en_required: 'bodyEn',
  correction_reason_required: 'reasonTa',
  withdrawal_reason_required: 'reasonTa',
  nothing_changed: 'bodyTa',
  image_not_found: 'image',
  member_not_found: 'memberCode',
  needs_sign_publish_permission: 'memberCode',
  already_registered: 'memberCode',
  publisher_name_required: 'nameTa',
};

function statementText(form: FormLike) {
  return { titleTa: text(form, 'titleTa'), titleEn: text(form, 'titleEn'), bodyTa: text(form, 'bodyTa'), bodyEn: text(form, 'bodyEn') };
}

/** Both languages are needed before signing; the same order as the API's problems. */
export function textProblems(values: { titleTa: string; titleEn: string; bodyTa: string; bodyEn: string }): string[] {
  const problems: string[] = [];
  if (!values.titleTa) problems.push('title_ta_required');
  if (!values.titleEn) problems.push('title_en_required');
  if (!values.bodyTa) problems.push('body_ta_required');
  if (!values.bodyEn) problems.push('body_en_required');
  return problems;
}

/** A draft may be incomplete (it is saved as it is); the image stays as it was unless changed. */
export function readDraft(form: FormLike, imageId: string | null): OfficialDraftInput {
  return { ...statementText(form), imageId };
}

/**
 * A correction: the whole new text, the reason in both languages (shown to everyone with the
 * correction, BR-150), and the image to keep, remove or replace with a newly uploaded one.
 */
export function readCorrection(form: FormLike, currentImageId: string | null): Read<OfficialCorrectionInput> {
  const values = statementText(form);
  const reasonTa = text(form, 'reasonTa');
  const reasonEn = text(form, 'reasonEn');
  const problems = textProblems(values);
  if (reasonTa.length < 3 || reasonEn.length < 3) problems.push('correction_reason_required');
  const choice = text(form, 'image');
  const imageId = choice === 'remove' ? null : choice === 'new' ? uuidOrNull(form, 'newImageId') : currentImageId;
  if (choice === 'new' && !imageId) problems.push('image_not_found');
  if (problems.length > 0) return { input: null, problems };
  return { input: { ...values, reasonTa, reasonEn, imageId }, problems };
}

export function readWithdrawal(form: FormLike): Read<OfficialWithdrawInput> {
  const reasonTa = text(form, 'reasonTa');
  const reasonEn = text(form, 'reasonEn');
  if (reasonTa.length < 3 || reasonEn.length < 3) return { input: null, problems: ['withdrawal_reason_required'] };
  return { input: { reasonTa, reasonEn }, problems: [] };
}

export function readPublisher(form: FormLike): Read<OfficialPublisherInput> {
  const memberCode = text(form, 'memberCode');
  const nameTa = text(form, 'nameTa');
  const nameEn = text(form, 'nameEn');
  const problems: string[] = [];
  if (memberCode.length < 3) problems.push('member_not_found');
  if (nameTa.length < 2 || nameEn.length < 2) problems.push('publisher_name_required');
  if (problems.length > 0) return { input: null, problems };
  return { input: { memberCode, nameTa, nameEn }, problems };
}
