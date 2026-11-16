'use server';

import type { PolicyDecisionDraftInput, PolicyDecisionReviewInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function back(key: string, query: string): never {
  redirect(`/policy-decisions/${encodeURIComponent(key)}?${query}`);
}

function refused(key: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(key, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function draftInput(formData: FormData): PolicyDecisionDraftInput {
  const effectiveFrom = value(formData, 'effectiveFrom');
  return {
    decisionText: value(formData, 'decisionText'),
    rationale: value(formData, 'rationale'),
    effectiveFrom: effectiveFrom || null,
  };
}

export async function createRevision(formData: FormData): Promise<void> {
  const key = value(formData, 'key');
  const input = draftInput(formData);
  if (!key || input.decisionText.length < 10 || input.rationale.length < 10) {
    back(key, 'error=invalid_request&problems=decision_content_incomplete');
  }
  try {
    await (await staffApi()).createPolicyDecisionRevision(key, input);
  } catch (error) {
    refused(key, error);
  }
  back(key, 'done=policy_draft_created');
}

export async function updateDraft(formData: FormData): Promise<void> {
  const key = value(formData, 'key');
  const revisionId = value(formData, 'revisionId');
  const input = draftInput(formData);
  if (!key || !revisionId || input.decisionText.length < 10 || input.rationale.length < 10) {
    back(key, 'error=invalid_request&problems=decision_content_incomplete');
  }
  try {
    await (await staffApi()).updatePolicyDecisionDraft(key, revisionId, input);
  } catch (error) {
    refused(key, error);
  }
  back(key, 'done=policy_draft_saved');
}

export async function submitRevision(formData: FormData): Promise<void> {
  const key = value(formData, 'key');
  const revisionId = value(formData, 'revisionId');
  const reason = value(formData, 'reason');
  if (!key || !revisionId || reason.length < 10) {
    back(key, 'error=invalid_request&problems=reason_required');
  }
  if (formData.get('confirmSubmit') !== '1') {
    back(key, 'error=invalid_request&problems=confirmation_required');
  }
  try {
    await (await staffApi()).submitPolicyDecisionRevision(key, revisionId, reason);
  } catch (error) {
    refused(key, error);
  }
  back(key, 'done=policy_submitted');
}

export async function recordReview(formData: FormData): Promise<void> {
  const key = value(formData, 'key');
  const revisionId = value(formData, 'revisionId');
  const input: PolicyDecisionReviewInput = {
    role: value(formData, 'role'),
    outcome: value(formData, 'outcome') as PolicyDecisionReviewInput['outcome'],
    reviewerName: value(formData, 'reviewerName'),
    reviewerTitle: value(formData, 'reviewerTitle'),
    evidenceRef: value(formData, 'evidenceRef'),
    comment: value(formData, 'comment'),
    reviewedAt: value(formData, 'reviewedAt'),
  };
  if (
    !key ||
    !revisionId ||
    !input.role ||
    !['approve', 'reject'].includes(input.outcome) ||
    input.reviewerName.length < 2 ||
    input.reviewerTitle.length < 2 ||
    input.evidenceRef.length < 3 ||
    input.comment.length < 10 ||
    !input.reviewedAt
  ) {
    back(key, 'error=invalid_request&problems=required_fields_missing');
  }
  if (formData.get('confirmEvidence') !== '1') {
    back(key, 'error=invalid_request&problems=confirmation_required');
  }
  try {
    await (await staffApi()).recordPolicyDecisionReview(key, revisionId, input);
  } catch (error) {
    refused(key, error);
  }
  back(key, `done=policy_${input.outcome}_recorded`);
}
