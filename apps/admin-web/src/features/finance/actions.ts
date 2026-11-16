'use server';

import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(contributionId: string, query: string): never {
  redirect(`/finance/${contributionId}?${query}`);
}

function refused(contributionId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(contributionId, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

export async function claimContributionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('contributionId') ?? '');
  if (!UUID.test(id)) redirect('/finance');
  try {
    const api = await staffApi();
    await api.claimFinanceContribution(id);
  } catch (error) {
    refused(id, error);
  }
  back(id, 'done=claimed');
}

export async function reconcileContributionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('contributionId') ?? '');
  if (!UUID.test(id)) redirect('/finance');
  const action = String(formData.get('action') ?? '') as 'matched' | 'needs_correction' | 'reject' | 'hold';
  const statementReference = String(formData.get('statementReference') ?? '').trim() || null;
  const reason = String(formData.get('reason') ?? '').trim();

  if (action === 'matched' && !statementReference) {
    back(id, 'error=statement_reference_required');
  }
  if (!reason || reason.length < 5) {
    back(id, 'error=reason_required');
  }

  try {
    const api = await staffApi();
    await api.reconcileFinanceContribution(id, {
      action,
      statementReference,
      reason,
    });
  } catch (error) {
    refused(id, error);
  }
  back(id, 'done=reconciled');
}

export async function approveContributionAction(formData: FormData): Promise<void> {
  const id = String(formData.get('contributionId') ?? '');
  if (!UUID.test(id)) redirect('/finance');
  const action = String(formData.get('action') ?? '') as 'approve' | 'reject' | 'hold';
  const reason = String(formData.get('reason') ?? '').trim();
  const relatedPartyConflict = formData.get('relatedPartyConflict') === '1';
  const confirmed = formData.get('confirmIndependentReview') === '1';

  if (!confirmed && action === 'approve') {
    back(id, 'error=confirmation_required');
  }
  if (relatedPartyConflict && action === 'approve') {
    back(id, 'error=related_party_conflict_must_hold_or_reassign');
  }
  if (!reason || reason.length < 5) {
    back(id, 'error=reason_required');
  }

  try {
    const api = await staffApi();
    await api.approveFinanceContribution(id, {
      action,
      reason,
      relatedPartyConflict,
    });
  } catch (error) {
    refused(id, error);
  }
  back(id, 'done=approved');
}
