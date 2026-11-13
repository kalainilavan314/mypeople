'use server';

import { redirect } from 'next/navigation';

import { PROPOSAL_REFUSED, readModeration } from '@/features/development/forms';
import { proposalRefused } from '@/features/development/refusal';
import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import { FACTCHECK_REFUSED, readMisinfoAppeal, readMisinfoDecision } from './factcheck';

// D12: the moderation queue. The API checks content.moderate over the item's area and refuses a
// moderator's own idea or proposal (own_record); the author is told the outcome and any reason.

const IDEA_REFUSED = 'idea_refused';

export async function moderateIdea(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'itemId');
  if (!id) redirect('/moderation');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readModeration(formData);
  if (!input) return incomplete(IDEA_REFUSED, problems, values);
  try {
    await (await staffApi()).moderateIdea(id, input.publish, input.reason ?? undefined);
  } catch (error) {
    const { code, problems: refusedProblems } = failure(error);
    return { error: code, problems: refusedProblems, values, attempt: Date.now() };
  }
  redirect(`/moderation?done=${input.publish ? 'idea_published' : 'idea_rejected'}`);
}

/** Publishing moves the proposal to review; rejecting needs the reason the author is told. */
export async function moderateProposal(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'itemId');
  if (!id) redirect('/moderation');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readModeration(formData);
  if (!input) return incomplete(PROPOSAL_REFUSED, problems, values);
  try {
    await (await staffApi()).moveProposal(id, input.publish ? { stage: 'review' } : { stage: 'rejected', reason: input.reason });
  } catch (error) {
    return proposalRefused(error, values);
  }
  redirect(`/moderation?done=${input.publish ? 'proposal_review' : 'proposal_rejected'}`);
}

/** BR-149: a person decides a misinformation report; the reporter cannot decide their own (403 own_record). */
export async function decideMisinfo(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'reportId');
  if (!id) redirect('/moderation');
  const values = valuesOf(formData, ['outcome', 'reason']);
  const { input, problems } = readMisinfoDecision(formData);
  if (!input) return incomplete(FACTCHECK_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideMisinfoReport(id, input.outcome, input.reason));
  if (failed) return failed;
  redirect('/moderation?done=misinfo_decided#misinformation');
}

/** An appeal is decided by someone other than the first fact-checker (403 original_decider). */
export async function decideMisinfoAppeal(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'reportId');
  if (!id) redirect('/moderation');
  const values = valuesOf(formData, ['change', 'outcome', 'reason']);
  const { input, problems } = readMisinfoAppeal(formData);
  if (!input) return incomplete(FACTCHECK_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideMisinfoAppeal(id, input.change, input.reason, input.outcome));
  if (failed) return failed;
  redirect(`/moderation?done=${input.change ? 'misinfo_appeal_changed' : 'misinfo_appeal_upheld'}#misinformation`);
}
