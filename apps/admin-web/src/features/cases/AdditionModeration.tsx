'use client';

import { useActionState } from 'react';

import { CONTROL } from '@/components/FormField';

import { moderateAddition } from './actions';
import { CaseField, CaseFormProblems, CaseSubmit } from './fields';
import type { CaseFormState } from './forms';

/**
 * Approve information a member added to a case, or reject it with a reason. The reason is needed
 * only to reject, so the form is not blocked by the browser and the API answers for a missing one.
 */
export function AdditionModeration({ caseId, additionId }: { caseId: string; additionId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(moderateAddition, null);
  const form = `addition-${additionId.slice(0, 8)}`;
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <CaseFormProblems form={form} state={state} fields={['reason']} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="additionId" value={additionId} />
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
