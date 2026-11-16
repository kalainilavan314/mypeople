import type { ProposalMoveInput, ProposalStage } from '@my-people/api-client';

import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';
import { moveFor } from './stages.ts';

/** The refusal code the proposals API uses, and the one the dashboard's own checks use too. */
export const PROPOSAL_REFUSED = 'proposal_refused';
/** Said when the API answers 403 "forbidden" to a stage move: the viewer's tier lacks that authority. */
export const TIER_CANNOT_RECORD = 'tier_cannot_record';

export const PROPOSAL_TARGETS: ProblemTargets = {
  reason_required: 'reason',
};

type Read<T> = { input: T | null; problems: string[] };

/** One stage move from the proposal's current stage; steps that need a reason are refused without one. */
export function readStageMove(form: FormLike, current: ProposalStage): Read<ProposalMoveInput> {
  const move = moveFor(current, text(form, 'stage'));
  if (!move) return { input: null, problems: [`not_allowed_from:${current}`] };
  const reason = text(form, 'reason');
  if (move.reasonRequired && !reason) return { input: null, problems: ['reason_required'] };
  return { input: { stage: move.to, reason: reason || null }, problems: [] };
}

/** Publish an idea or a proposal, or reject it with the reason its author is told. */
export function readModeration(form: FormLike): Read<{ publish: boolean; reason: string | null }> {
  const choice = text(form, 'publish');
  if (choice === '1') return { input: { publish: true, reason: null }, problems: [] };
  if (choice !== '0') return { input: null, problems: ['decision_required'] };
  const reason = text(form, 'reason');
  return reason ? { input: { publish: false, reason }, problems: [] } : { input: null, problems: ['reason_required'] };
}

/**
 * The code a refused stage move shows. A 403 "forbidden" on a move means the viewer's tier does not
 * hold the authority for that step (it was shown because every valid step is shown); other codes
 * (own_record, outside_your_area, proposal_refused) keep their own words.
 */
export function stageRefusalCode(status: number, code: string): string {
  return status === 403 && code === 'forbidden' ? TIER_CANNOT_RECORD : code;
}
