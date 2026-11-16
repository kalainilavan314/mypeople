'use client';

import type { VolunteerOpportunityState } from '@my-people/api-client';
import { useActionState } from 'react';

import { ActionCard, ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import type { FormState } from '@/lib/formState';

import { moveOpportunity } from './actions';
import { MOVE_LABELS, OPPORTUNITY_MOVES, VOLUNTEER_TARGETS } from './forms';

/** The moves the opportunity's state allows: open or close, and cancel with a reason. */
export function OpportunityMoves({ opportunityId, state: current, waiting, confirmed }: {
  opportunityId: string;
  state: VolunteerOpportunityState;
  waiting: number;
  confirmed: number;
}) {
  const moves = OPPORTUNITY_MOVES[current];
  const plain = moves.filter((move): move is 'open' | 'closed' => move !== 'cancelled');
  if (moves.length === 0) return <p className="text-sm text-muted">A cancelled opportunity cannot be opened again.</p>;
  return (
    <div className="flex flex-col gap-4">
      {plain.length > 0 ? <PlainMoves opportunityId={opportunityId} moves={plain} /> : null}
      {moves.includes('cancelled') ? <CancelForm opportunityId={opportunityId} told={waiting + confirmed} /> : null}
    </div>
  );
}

function PlainMoves({ opportunityId, moves }: { opportunityId: string; moves: readonly ('open' | 'closed')[] }) {
  const [state, action] = useActionState<FormState, FormData>(moveOpportunity, null);
  return (
    <ActionCard
      id="move"
      title="Open or close"
      intro="Members in the area see an open opportunity and can offer to help. Closing stops new offers; confirmed volunteers stay confirmed.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3">
        <ActionProblems form="move" state={state} targets={VOLUNTEER_TARGETS} fields={[]} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <div className="flex flex-wrap gap-3">
          {moves.map((move) => (
            <ActionSubmit key={move} name="state" value={move} tone={move === 'open' ? 'primary' : 'secondary'}>
              <span lang="ta">{MOVE_LABELS[move].ta}</span>
              <span className="mx-1" aria-hidden="true">
                ·
              </span>
              <span lang="en">{MOVE_LABELS[move].en}</span>
            </ActionSubmit>
          ))}
        </div>
      </form>
    </ActionCard>
  );
}

function CancelForm({ opportunityId, told }: { opportunityId: string; told: number }) {
  const [state, action] = useActionState<FormState, FormData>(moveOpportunity, null);
  return (
    <ActionCard
      id="cancel"
      title="Cancel the opportunity"
      intro={
        <>
          Everyone who offered is told, with your reason
          {told > 0 ? ` (${told} ${told === 1 ? 'person' : 'people'} waiting or confirmed now)` : ''}. A cancelled opportunity cannot be
          opened again.
        </>
      }>
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3">
        <ActionProblems form="cancel" state={state} targets={VOLUNTEER_TARGETS} fields={['reason']} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="state" value="cancelled" />
        <ActionField form="cancel" name="reason" label="Reason, sent to everyone who offered" required state={state} targets={VOLUNTEER_TARGETS}>
          {(control) => <textarea {...control} required maxLength={500} rows={2} defaultValue={state?.values.reason} className={TEXTAREA} />}
        </ActionField>
        <ActionSubmit tone="danger">Cancel and tell everyone who offered</ActionSubmit>
      </form>
    </ActionCard>
  );
}
