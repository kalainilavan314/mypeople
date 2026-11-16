'use client';

import type { ProposalStage } from '@my-people/api-client';
import { useActionState } from 'react';

import { ActionCard, ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import type { FormState } from '@/lib/formState';

import { moveProposalStage } from './actions';
import { PROPOSAL_TARGETS } from './forms';
import { AUTHORITY, type Move } from './stages';

/**
 * One step a proposal may take from its stage, with who records it. Every valid step is shown; the
 * API refuses a step the viewer's tier cannot record, and the form says so next to it.
 */
export function StageMoveForm({ proposalId, current, move, held }: { proposalId: string; current: ProposalStage; move: Move; held: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(moveProposalStage, null);
  const form = `move-${move.to}`;
  const authority = AUTHORITY[move.permission];
  return (
    <ActionCard
      id={form}
      title={`${move.label.en}`}
      intro={
        <span className="flex flex-col gap-1">
          <span lang="ta" className="font-semibold text-text">
            {move.label.ta}
          </span>
          <span>{move.intro}</span>
          <span>
            Recorded by: <span lang="ta">{authority?.ta}</span> · {authority?.en ?? move.permission}
          </span>
          {held ? null : (
            <span className="font-semibold text-warning">! You do not hold this permission, so the API will refuse this step.</span>
          )}
        </span>
      }>
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3">
        <ActionProblems form={form} state={state} targets={PROPOSAL_TARGETS} fields={['reason']} />
        <input type="hidden" name="proposalId" value={proposalId} />
        <input type="hidden" name="currentStage" value={current} />
        <input type="hidden" name="stage" value={move.to} />
        <ActionField
          form={form}
          name="reason"
          label={move.reasonRequired ? 'Reason, shown to members and the author' : 'Note (optional), shown to members and the author'}
          required={move.reasonRequired}
          state={state}
          targets={PROPOSAL_TARGETS}>
          {(control) => (
            <textarea {...control} required={move.reasonRequired} maxLength={2000} rows={3} defaultValue={state?.values.reason} className={TEXTAREA} />
          )}
        </ActionField>
        <ActionSubmit tone={move.tone}>{move.label.en}</ActionSubmit>
      </form>
    </ActionCard>
  );
}
