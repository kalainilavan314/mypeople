'use server';

import { redirect } from 'next/navigation';

import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { staffApi } from '@/lib/session';

import { PROPOSAL_REFUSED, readStageMove } from './forms';
import { proposalRefused } from './refusal';
import { isProposalStage } from './stages';

// D15: a development proposal's stage moves. The API checks the permission each step needs, the
// viewer's tier and area, and that the viewer is not the author, again on every call.

export async function moveProposalStage(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'proposalId');
  if (!id) redirect('/development');
  const current = text(formData, 'currentStage');
  if (!isProposalStage(current)) redirect(`/development/${id}`);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readStageMove(formData, current);
  if (!input) return incomplete(PROPOSAL_REFUSED, problems, values);
  try {
    await (await staffApi()).moveProposal(id, input);
  } catch (error) {
    return proposalRefused(error, values);
  }
  redirect(`/development/${id}?done=proposal_${input.stage}`);
}
