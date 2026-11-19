'use server';

import type { ApiClient } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { GUIDE_REFUSED, GUIDE_TEXT_FIELDS, readGuideEntry, readReason, readResolution, readReview, renameProblems } from './forms';

// D28: editors (guide.edit) draft and change entries; a second person with guide.review publishes
// them (403 "own_entry" for the one who asked or last changed it). The API checks everything again.

/** attempt(), with the API's problem codes in this module's own words. */
async function tryCall(values: Record<string, string>, call: (api: ApiClient) => Promise<unknown>): Promise<FormState> {
  const failed = await attempt(values, call);
  return failed ? { ...failed, problems: renameProblems(failed.problems) } : null;
}

function entryIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'entryId');
  if (!id) redirect('/livelihood');
  return id;
}

/** Back to the entry, or to the list when the form was on the list's report queue. */
function back(formData: FormData, id: string | null, done: string): never {
  redirect(id && text(formData, 'returnTo') !== 'list' ? `/livelihood/${id}?done=${done}` : `/livelihood?done=${done}#reports`);
}

/** A draft may be incomplete; saving a published entry takes it off the guide until reviewed again. */
export async function saveGuideEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  const existing = uuidOrNull(formData, 'entryId');
  const values = valuesOf(formData, GUIDE_TEXT_FIELDS);
  const { input, problems } = readGuideEntry(formData);
  if (!input) return incomplete(GUIDE_REFUSED, problems, values);
  let id = existing;
  const failed = await tryCall(values, async (api) => {
    id = existing ? (await api.saveGuideEntry(existing, input)).id : (await api.draftGuideEntry(input)).id;
  });
  if (failed) return failed;
  redirect(`/livelihood/${id}?done=${existing ? 'guide_entry_saved' : 'guide_entry_drafted'}`);
}

export async function requestGuideReview(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = entryIdFrom(formData);
  const failed = await tryCall({}, (api) => api.requestGuideReview(id));
  if (failed) return failed;
  back(formData, id, 'guide_review_requested');
}

export async function reviewGuideEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = entryIdFrom(formData);
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readReview(formData);
  if (!input) return incomplete(GUIDE_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.reviewGuideEntry(id, input.approve, input.note));
  if (failed) return failed;
  back(formData, id, input.approve ? 'guide_entry_published' : 'guide_entry_returned');
}

export async function markGuideVerified(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = entryIdFrom(formData);
  const failed = await tryCall({}, (api) => api.markGuideEntryVerified(id));
  if (failed) return failed;
  back(formData, id, 'guide_entry_verified');
}

export async function withdrawGuideEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = entryIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(GUIDE_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.withdrawGuideEntry(id, input));
  if (failed) return failed;
  back(formData, id, 'guide_entry_withdrawn');
}

export async function resolveGuideReport(_previous: FormState, formData: FormData): Promise<FormState> {
  const reportId = uuidOrNull(formData, 'reportId');
  if (!reportId) redirect('/livelihood');
  const values = valuesOf(formData, ['outcome', 'reason']);
  const { input, problems } = readResolution(formData);
  if (!input) return incomplete(GUIDE_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.resolveGuideReport(reportId, input.outcome, input.note));
  if (failed) return failed;
  back(formData, uuidOrNull(formData, 'entryId'), input.outcome === 'fixed' ? 'guide_report_fixed' : 'guide_report_dismissed');
}
