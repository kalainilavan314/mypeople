'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { PROPOSAL_TARGETS } from '@/features/development/forms';
import type { FormState } from '@/lib/formState';

import { moderateIdea, moderateProposal } from './actions';

/**
 * Publish an idea or a proposal, or reject it with the reason its author is told. The reason is
 * needed only to reject, so the browser does not block publishing; the form says when it is missing.
 */
export function ModerationForm({ kind, itemId }: { kind: 'idea' | 'proposal'; itemId: string }) {
  const [state, action] = useActionState<FormState, FormData>(kind === 'idea' ? moderateIdea : moderateProposal, null);
  const form = `${kind}-${itemId.slice(0, 8)}`;
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <ActionProblems form={form} state={state} targets={PROPOSAL_TARGETS} fields={['reason']} />
      <input type="hidden" name="itemId" value={itemId} />
      <ActionField form={form} name="reason" label="Reason (needed to reject), sent to the author" state={state} targets={PROPOSAL_TARGETS}>
        {(control) => <textarea {...control} maxLength={kind === 'idea' ? 500 : 2000} rows={2} defaultValue={state?.values.reason} className={TEXTAREA} />}
      </ActionField>
      <div className="flex flex-wrap gap-3">
        <ActionSubmit name="publish" value="1">
          {kind === 'idea' ? 'Publish idea' : 'Publish for review'}
        </ActionSubmit>
        <ActionSubmit name="publish" value="0" tone="danger">
          Reject
        </ActionSubmit>
      </div>
    </form>
  );
}
