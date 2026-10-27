'use server';

import type { ReviewDecisionInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(reviewId: string, query: string): never {
  redirect(`/verification/${reviewId}?${query}`);
}

function refused(reviewId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(reviewId, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function reviewIdOf(formData: FormData): string {
  const id = String(formData.get('reviewId') ?? '');
  if (!UUID.test(id)) redirect('/verification');
  return id;
}

/** Claim or release: one reviewer holds a review at a time (FR-WEB-004). */
export async function claimOrRelease(formData: FormData): Promise<void> {
  const reviewId = reviewIdOf(formData);
  const release = formData.get('do') === 'release';
  try {
    const api = await staffApi();
    if (release) await api.releaseIdentityReview(reviewId);
    else await api.claimIdentityReview(reviewId);
  } catch (error) {
    refused(reviewId, error);
  }
  back(reviewId, `done=${release ? 'released' : 'claimed'}`);
}

/** W02: exactly one of three decisions, with the checklist, items and reason the rules ask for (FR-WEB-007 to 011). */
export async function decide(formData: FormData): Promise<void> {
  const reviewId = reviewIdOf(formData);
  const decision = String(formData.get('decision')) as ReviewDecisionInput['decision'];
  const reason = String(formData.get(`reason_${decision}`) ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const input: ReviewDecisionInput = {
    decision,
    checklist: formData.getAll('checklist').map(String),
    items: decision === 'request_update' ? formData.getAll('items').map(String) : [],
    reasonCategory: decision === 'approve' ? null : reason || null,
    note: note || null,
  };
  try {
    await (await staffApi()).decideIdentityReview(reviewId, input);
  } catch (error) {
    refused(reviewId, error);
  }
  back(reviewId, 'done=decision_recorded');
}

/** FR-WEB-012: report a suspected duplicate account from the review the reviewer holds. */
export async function reportDuplicate(formData: FormData): Promise<void> {
  const reviewId = reviewIdOf(formData);
  const memberId = String(formData.get('memberId') ?? '');
  const otherCode = String(formData.get('otherCode') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  try {
    const api = await staffApi();
    const other = await api.lookupMember(otherCode);
    await api.reportDuplicate({ memberId, otherMemberId: other.memberId, reason });
  } catch (error) {
    refused(reviewId, error);
  }
  back(reviewId, 'done=duplicate_reported');
}
