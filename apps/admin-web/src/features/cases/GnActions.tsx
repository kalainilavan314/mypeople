'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { addFact, forwardToDs, linkDuplicate, returnForDetails } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, FieldErrors, OwnerSelect, TEXTAREA, fieldId, problemsFor } from './fields';
import type { CaseFormState } from './forms';

// W03: what the GN officer does with a new report (FR-WEB-015 to FR-WEB-018).

export function AddFactForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(addFact, null);
  const values = state?.values ?? {};
  return (
    <ActionCard id="fact" title="Add an observed fact" intro="Write what was seen or confirmed, and who or what it comes from.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="fact" state={state} fields={['statement', 'source']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="fact" name="statement" label="Fact" required state={state}>
          {(control) => <textarea {...control} required minLength={3} maxLength={1000} rows={3} defaultValue={values.statement} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="fact" name="source" label="Source" hint="For example: site visit on 12 November, or the GN office register." required state={state}>
          {(control) => <input {...control} required minLength={2} maxLength={300} defaultValue={values.source} className={CONTROL} />}
        </CaseField>
        <CaseSubmit>Add fact</CaseSubmit>
      </form>
    </ActionCard>
  );
}

export function ReturnForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(returnForDetails, null);
  const values = state?.values ?? {};
  return (
    <ActionCard
      id="return"
      title="Return to the reporter for details"
      intro="The report is kept. The reporter sees your question and can add what is missing.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="return" state={state} fields={['question']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="return" name="question" label="What should the reporter add?" required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={1000} rows={3} defaultValue={values.question} className={TEXTAREA} />}
        </CaseField>
        <CaseSubmit tone="secondary">Return for details</CaseSubmit>
      </form>
    </ActionCard>
  );
}

export function LinkForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(linkDuplicate, null);
  const values = state?.values ?? {};
  return (
    <ActionCard
      id="link"
      title="Link as a duplicate"
      intro="This report joins an open case about the same issue. Its reporter keeps the receipt and follows that case.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="link" state={state} fields={['parentCaseNumber', 'note']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="link" name="parentCaseNumber" label="Case ID of the open case" required state={state}>
          {(control) => (
            <input {...control} required minLength={4} maxLength={20} autoComplete="off" defaultValue={values.parentCaseNumber} className={`${CONTROL} font-mono uppercase`} />
          )}
        </CaseField>
        <CaseField form="link" name="note" label="Note (optional)" state={state}>
          {(control) => <textarea {...control} maxLength={1000} rows={2} defaultValue={values.note} className={TEXTAREA} />}
        </CaseField>
        <CaseSubmit tone="secondary">Link to that case</CaseSubmit>
      </form>
    </ActionCard>
  );
}

const CHECKS = [
  { name: 'locationConfirmed', label: 'The location is confirmed' },
  { name: 'descriptionClear', label: 'The description is clear' },
  { name: 'evidenceReviewed', label: 'The evidence has been reviewed' },
] as const;

/** FR-WEB-017: Forward stays off until all three checks are ticked and a divisional owner is chosen. */
export function ForwardForm({ caseId, owners, factCount }: { caseId: string; owners: readonly CaseOwnerOption[]; factCount: number }) {
  const [state, action] = useActionState<CaseFormState, FormData>(forwardToDs, null);
  return (
    <ActionCard
      id="forward"
      title="Forward to divisional research"
      intro="Complete the check, then name the divisional officer who takes the case next.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="forward" state={state} fields={['checklist', 'ownerId', 'note']} />
        <input type="hidden" name="caseId" value={caseId} />
        <ForwardFields state={state} owners={owners} factCount={factCount} />
      </form>
    </ActionCard>
  );
}

function ForwardFields({ state, owners, factCount }: { state: CaseFormState; owners: readonly CaseOwnerOption[]; factCount: number }) {
  const values = state?.values ?? {};
  const [ticked, setTicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHECKS.map((check) => [check.name, values[check.name] === '1'])),
  );
  const [ownerId, setOwnerId] = useState(values.ownerId ?? '');
  const ready = CHECKS.every((check) => ticked[check.name]) && ownerId !== '' && factCount > 0;
  const checklistErrors = problemsFor(state, 'checklist');

  return (
    <>
      <fieldset id={fieldId('forward', 'checklist')} tabIndex={-1} className="flex flex-col gap-2" aria-describedby={checklistErrors.length ? 'forward-checklist-error' : undefined}>
        <legend className="mb-1 text-sm font-semibold">Completeness check *</legend>
        {CHECKS.map((check) => (
          <label key={check.name} className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
            <input
              type="checkbox"
              name={check.name}
              value="1"
              defaultChecked={ticked[check.name]}
              onChange={(event) => setTicked((current) => ({ ...current, [check.name]: event.target.checked }))}
              className="size-5"
            />
            <span>{check.label}</span>
          </label>
        ))}
        <FieldErrors id="forward-checklist-error" problems={checklistErrors} />
      </fieldset>
      <CaseField form="forward" name="ownerId" label="Divisional owner" required state={state}>
        {(control) => <OwnerSelect control={control} options={owners} defaultValue={ownerId} onChange={setOwnerId} />}
      </CaseField>
      <CaseField form="forward" name="note" label="Handover note" required state={state}>
        {(control) => <textarea {...control} required minLength={3} maxLength={2000} rows={3} defaultValue={values.note} className={TEXTAREA} />}
      </CaseField>
      {!ready ? (
        <p id="forward-waiting" className="text-sm text-muted">
          {factCount === 0
            ? 'Add at least one observed fact first. '
            : ''}
          Forward is available once all three checks are ticked and a divisional owner is chosen.
        </p>
      ) : null}
      <CaseSubmit ready={ready} describedBy={!ready ? 'forward-waiting' : undefined}>
        Forward to divisional research
      </CaseSubmit>
    </>
  );
}
