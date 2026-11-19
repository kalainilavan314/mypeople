'use server';

import type { GalleryImageType } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import {
  CORRECTION_TEXT_FIELDS,
  OFFICIAL_REFUSED,
  STATEMENT_TEXT_FIELDS,
  readCorrection,
  readDraft,
  readPublisher,
  readWithdrawal,
} from './forms';

// D30: publishers draft and sign; Tier 5 registers publishers. The API checks the permission, the
// registration and the signing key again on every call (FR-AUT-001, 002).

const IMAGE_TYPES: Readonly<Record<string, GalleryImageType>> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

function statementIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'statementId');
  if (!id) redirect('/publishing');
  return id;
}

/** A silence window refuses with 409 "silence_period"; say it in this module's words. */
const silenceWords = (_status: number, code: string) => (code === 'silence_period' ? 'official_silence_period' : code);

function backWithError(path: string, error: unknown): never {
  const { code, problems } = failure(error);
  redirect(`${path}?error=${encodeURIComponent(silenceWords(0, code))}&problems=${encodeURIComponent(problems.join(','))}`);
}

export async function createDraft(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, STATEMENT_TEXT_FIELDS);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.draftOfficialStatement(readDraft(formData, null))).id;
  });
  if (failed) return failed;
  redirect(`/publishing/${id}?done=official_drafted`);
}

/** Saved as it is, even incomplete; both languages are checked when it is signed. */
export async function saveDraft(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = statementIdFrom(formData);
  const values = valuesOf(formData, STATEMENT_TEXT_FIELDS);
  const failed = await attempt(values, (api) => api.saveOfficialDraft(id, readDraft(formData, uuidOrNull(formData, 'imageId'))));
  if (failed) return failed;
  redirect(`/publishing/${id}?done=official_saved`);
}

/** Signs the draft and its image as revision 1 (FR-AUT-002). */
export async function publishStatement(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = statementIdFrom(formData);
  const failed = await attempt({}, (api) => api.signAndPublishOfficialStatement(id), silenceWords);
  if (failed) return failed;
  redirect(`/publishing/${id}?done=official_published`);
}

/** A new signed revision with its reason; the original stays (BR-150). */
export async function correctStatement(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = statementIdFrom(formData);
  const values = valuesOf(formData, CORRECTION_TEXT_FIELDS);
  const { input, problems } = readCorrection(formData, uuidOrNull(formData, 'currentImageId'));
  if (!input) return incomplete(OFFICIAL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.correctOfficialStatement(id, input), silenceWords);
  if (failed) return failed;
  redirect(`/publishing/${id}?done=official_corrected`);
}

export async function withdrawStatement(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = statementIdFrom(formData);
  const values = valuesOf(formData, ['reasonTa', 'reasonEn']);
  const { input, problems } = readWithdrawal(formData);
  if (!input) return incomplete(OFFICIAL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.withdrawOfficialStatement(id, input));
  if (failed) return failed;
  redirect(`/publishing/${id}?done=official_withdrawn`);
}

/** The image file from a form, or a redirect back with the reason it cannot be used. */
async function imageFrom(formData: FormData, back: string): Promise<{ body: ArrayBuffer; type: GalleryImageType }> {
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) redirect(`${back}?error=empty_file`);
  const type = IMAGE_TYPES[file.type];
  if (!type) redirect(`${back}?error=unsupported_type`);
  return { body: await file.arrayBuffer(), type };
}

/** Uploads an image and attaches it to the draft, keeping the draft's text as saved. */
export async function attachDraftImage(formData: FormData): Promise<void> {
  const id = statementIdFrom(formData);
  const back = `/publishing/${id}`;
  const image = await imageFrom(formData, back);
  try {
    const api = await staffApi();
    const uploaded = await api.uploadOfficialImage(image.body, image.type);
    const draft = await api.getManagedOfficialStatement(id);
    await api.saveOfficialDraft(id, {
      titleTa: draft.draftTitleTa,
      titleEn: draft.draftTitleEn,
      bodyTa: draft.draftBodyTa,
      bodyEn: draft.draftBodyEn,
      imageId: uploaded.id,
    });
  } catch (error) {
    backWithError(back, error);
  }
  redirect(`${back}?done=official_image_attached`);
}

export async function removeDraftImage(formData: FormData): Promise<void> {
  const id = statementIdFrom(formData);
  const back = `/publishing/${id}`;
  try {
    const api = await staffApi();
    const draft = await api.getManagedOfficialStatement(id);
    await api.saveOfficialDraft(id, {
      titleTa: draft.draftTitleTa,
      titleEn: draft.draftTitleEn,
      bodyTa: draft.draftBodyTa,
      bodyEn: draft.draftBodyEn,
      imageId: null,
    });
  } catch (error) {
    backWithError(back, error);
  }
  redirect(`${back}?done=official_image_removed`);
}

/** Uploads a replacement image; the correction form then offers it (signed only when the correction is). */
export async function uploadCorrectionImage(formData: FormData): Promise<void> {
  const id = statementIdFrom(formData);
  const back = `/publishing/${id}`;
  const image = await imageFrom(formData, back);
  let imageId = '';
  try {
    imageId = (await (await staffApi()).uploadOfficialImage(image.body, image.type)).id;
  } catch (error) {
    backWithError(back, error);
  }
  redirect(`${back}?correctionImage=${imageId}#correction`);
}

export async function registerPublisher(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['memberCode', 'nameTa', 'nameEn']);
  const { input, problems } = readPublisher(formData);
  if (!input) return incomplete(OFFICIAL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.registerOfficialPublisher(input));
  if (failed) return failed;
  redirect('/publishing/publishers?done=publisher_registered');
}

export async function revokePublisher(_previous: FormState, formData: FormData): Promise<FormState> {
  const publisherId = uuidOrNull(formData, 'publisherId');
  if (!publisherId) redirect('/publishing/publishers');
  const values = valuesOf(formData, ['reason']);
  if (values.reason.length < 3) return incomplete(OFFICIAL_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.revokeOfficialPublisher(publisherId, values.reason));
  if (failed) return failed;
  redirect('/publishing/publishers?done=publisher_revoked');
}
