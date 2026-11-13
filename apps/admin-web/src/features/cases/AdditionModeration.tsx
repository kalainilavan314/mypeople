'use client';

import { useActionState } from 'react';

import { CONTROL } from '@/components/FormField';

import { moderateAddition } from './actions';
import { CaseField, CaseFormProblems, CaseSubmit, TEXTAREA } from './fields';
import type { CaseFormState } from './forms';

/**
 * D12: approve information a member added to a case, as written or as an edited version with names,
 * phone numbers or other personal details taken out, or reject it with a reason. The reason is
 * needed only to reject, so the form is not blocked by the browser and the API answers for a
 * missing one. The edited version is used only when approving.
 */
export function AdditionModeration({
  caseId,
  additionId,
  returnTo,
}: {
  caseId: string;
  additionId: string;
  /** Set on the moderation queue, so the moderator comes back to it. */
  returnTo?: 'moderation';
}) {
  const [state, action] = useActionState<CaseFormState, FormData>(moderateAddition, null);
  const form = `addition-${additionId.slice(0, 8)}`;
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <CaseFormProblems form={form} state={state} fields={['reason', 'editedBody']} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="additionId" value={additionId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <CaseField
        form={form}
        name="editedBody"
        label="Edited version to publish (optional)"
        hint="Leave empty to publish it as written. Write it here to take out names, phone numbers or other personal details first; members then see only this version."
        state={state}>
        {(control) => <textarea {...control} minLength={5} maxLength={2000} rows={2} defaultValue={state?.values.editedBody} className={TEXTAREA} />}
      </CaseField>
      <CaseField form={form} name="reason" label="Reason (needed to reject)" state={state}>
        {(control) => <input {...control} maxLength={500} defaultValue={state?.values.reason} className={CONTROL} />}
      </CaseField>
      <div className="flex flex-wrap gap-3">
        <CaseSubmit name="approve" value="1">
          Approve
        </CaseSubmit>
        <CaseSubmit name="approve" value="0" tone="danger">
          Reject
        </CaseSubmit>
      </div>
    </form>
  );
}
