'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState } from 'react';

import { addNote, assignOwner, takeCase } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, OwnerSelect, TEXTAREA } from './fields';
import type { CaseFormState } from './forms';

/** FR-WEB-029: a handover inside the stage keeps the previous owner, the new owner, the note and the time. */
export function AssignForm({ caseId, owners, currentOwnerId }: { caseId: string; owners: readonly CaseOwnerOption[]; currentOwnerId: string | null }) {
  const [state, action] = useActionState<CaseFormState, FormData>(assignOwner, null);
  const values = state?.values ?? {};
  const choices = owners.filter((owner) => owner.memberId !== currentOwnerId);
  return (
    <ActionCard id="assign" title="Hand over this case" intro="Name who owns the case at this stage. The handover is recorded in the history.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="assign" state={state} fields={['ownerId', 'note']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="assign" name="ownerId" label="New owner" required state={state}>
          {(control) => <OwnerSelect control={control} options={choices} defaultValue={values.ownerId} />}
        </CaseField>
        <CaseField form="assign" name="note" label="Handover note" required state={state}>
          {(control) => <textarea {...control} required minLength={3} maxLength={1000} rows={2} defaultValue={values.note} className={TEXTAREA} />}
        </CaseField>
        <CaseSubmit tone="secondary">Hand over</CaseSubmit>
      </form>
    </ActionCard>
  );
}

/** An unowned case taken by the person looking at it; the API names them from their session. */
export function TakeCaseForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(takeCase, null);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-warning bg-warning-bg p-4 text-sm">
      <p className="font-semibold text-warning">No one owns this case at this stage.</p>
      <CaseFormProblems form="take" state={state} fields={[]} />
      <input type="hidden" name="caseId" value={caseId} />
      <CaseSubmit>Take this case</CaseSubmit>
    </form>
  );
}

export function NoteForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(addNote, null);
  const values = state?.values ?? {};
  return (
    <ActionCard id="note" title="Add a note" intro="Notes are for the case team and stay in the history; the reporter does not see them.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="note" state={state} fields={['text']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="note" name="text" label="Note" required state={state}>
          {(control) => <textarea {...control} required minLength={3} maxLength={2000} rows={3} defaultValue={values.text} className={TEXTAREA} />}
        </CaseField>
        <CaseSubmit tone="secondary">Add note</CaseSubmit>
      </form>
    </ActionCard>
  );
}
