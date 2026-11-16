'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { PROMISE_REFUSED, PROMISE_TEXT_FIELDS, readDecision, readPromise, readPromiseUpdate } from './forms';

// D16: the Promise Office drafts; a second person with promise.publish approves every publication
// and every update (403 "own_draft" for the requester). The API checks permission and area again.

function promiseIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'promiseId');
  if (!id) redirect('/promises');
  return id;
}

/** Back to the page the form was on: the promise, or the list's pending work. */
function back(formData: FormData, id: string | null, done: string): never {
  redirect(id && text(formData, 'returnTo') !== 'list' ? `/promises/${id}?done=${done}` : `/promises?done=${done}`);
}

export async function savePromise(_previous: FormState, formData: FormData): Promise<FormState> {
  const existing = uuidOrNull(formData, 'promiseId');
  const values = valuesOf(formData, PROMISE_TEXT_FIELDS);
  const { input, problems } = readPromise(formData, { needsArea: !existing });
  if (!input) return incomplete(PROMISE_REFUSED, problems, values);
  let id = existing;
  const failed = await attempt(values, async (api) => {
    id = existing ? (await api.updatePromiseDraft(existing, input)).id : (await api.draftPromise(input)).id;
  });
  if (failed) return failed;
  redirect(`/promises/${id}?done=${existing ? 'promise_saved' : 'promise_drafted'}`);
}

export async function requestPublication(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = promiseIdFrom(formData);
  const failed = await attempt({}, (api) => api.requestPromisePublication(id));
  if (failed) return failed;
  back(formData, id, 'promise_publication_requested');
}

/** Approve, or return with the reason; the requester gets 403 "own_draft". */
export async function decidePublication(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = promiseIdFrom(formData);
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readDecision(formData);
  if (!input) return incomplete(PROMISE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decidePromisePublication(id, input.approve, input.reason));
  if (failed) return failed;
  back(formData, id, input.approve ? 'promise_published' : 'promise_returned');
}

export async function draftUpdate(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = promiseIdFrom(formData);
  const values = valuesOf(formData, ['newStatus', 'noteTa', 'noteEn', 'evidenceRefs', 'correctsId']);
  const { input, problems } = readPromiseUpdate(formData);
  if (!input) return incomplete(PROMISE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.draftPromiseUpdate(id, input));
  if (failed) return failed;
  back(formData, id, 'promise_update_drafted');
}

export async function decideUpdate(_previous: FormState, formData: FormData): Promise<FormState> {
  const updateId = uuidOrNull(formData, 'updateId');
  if (!updateId) redirect('/promises');
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readDecision(formData);
  if (!input) return incomplete(PROMISE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decidePromiseUpdate(updateId, input.approve, input.reason));
  if (failed) return failed;
  back(formData, uuidOrNull(formData, 'promiseId'), input.approve ? 'promise_update_approved' : 'promise_update_rejected');
}

export async function moderateFeedback(_previous: FormState, formData: FormData): Promise<FormState> {
  const feedbackId = uuidOrNull(formData, 'feedbackId');
  if (!feedbackId) redirect('/promises');
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readDecision(formData);
  if (!input) return incomplete(PROMISE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.moderatePromiseFeedback(feedbackId, input.approve, input.reason));
  if (failed) return failed;
  back(formData, uuidOrNull(formData, 'promiseId'), input.approve ? 'feedback_published' : 'feedback_rejected');
}

/** The office's reply to published feedback, in Tamil and English. */
export async function replyToFeedback(_previous: FormState, formData: FormData): Promise<FormState> {
  const feedbackId = uuidOrNull(formData, 'feedbackId');
  if (!feedbackId) redirect('/promises');
  const values = valuesOf(formData, ['replyTa', 'replyEn']);
  if (values.replyTa.length < 3 || values.replyEn.length < 3) return incomplete(PROMISE_REFUSED, ['reply_required'], values);
  const failed = await attempt(values, (api) => api.replyToPromiseFeedback(feedbackId, values.replyEn, values.replyTa));
  if (failed) return failed;
  back(formData, uuidOrNull(formData, 'promiseId'), 'feedback_replied');
}
