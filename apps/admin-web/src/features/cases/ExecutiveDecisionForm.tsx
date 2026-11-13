'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { decideExecutive } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, FieldErrors, OwnerSelect, TEXTAREA, fieldId, problemsFor } from './fields';
import type { CaseFormState } from './forms';

const CHOICES = [
  { value: 'approve', title: 'Approve with conditions', text: 'Name the conditions, the implementer, the scope, the reporting duty and the due date.' },
  { value: 'return', title: 'Return for clarification', text: 'The plan goes back to the regional planner with your question.' },
  { value: 'decline', title: 'Decline', text: 'The case closes as declined, with your reason shown in its history.' },
] as const;

/** W07 (FR-WEB-024): the executive decision on the regional plan. */
export function ExecutiveDecisionForm({ caseId, implementers, minDate }: { caseId: string; implementers: readonly CaseOwnerOption[]; minDate: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(decideExecutive, null);
  return (
    <ActionCard id="executive" title="Executive decision" intro="Read the latest regional plan above before deciding.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems
          form="executive"
          state={state}
          fields={['decision', 'conditions', 'implementerId', 'scope', 'reportingDuty', 'dueDate', 'question', 'reason']}
        />
        <input type="hidden" name="caseId" value={caseId} />
        <ExecutiveFields state={state} implementers={implementers} minDate={minDate} />
      </form>
    </ActionCard>
  );
}

function ExecutiveFields({ state, implementers, minDate }: { state: CaseFormState; implementers: readonly CaseOwnerOption[]; minDate: string }) {
  const values = state?.values ?? {};
  const [decision, setDecision] = useState(values.decision ?? '');
  const decisionErrors = problemsFor(state, 'decision');

  return (
    <>
      <fieldset id={fieldId('executive', 'decision')} tabIndex={-1} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Decision *</legend>
        {CHOICES.map((choice) => (
          <label key={choice.value} className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
            <input
              type="radio"
              name="decision"
              value={choice.value}
              required
              defaultChecked={decision === choice.value}
              onChange={() => setDecision(choice.value)}
              className="mt-0.5 size-5"
            />
            <span>
              <span className="block font-semibold">{choice.title}</span>
              <span className="text-muted">{choice.text}</span>
            </span>
          </label>
        ))}
        <FieldErrors id={decisionErrors.length ? 'executive-decision-error' : undefined} problems={decisionErrors} />
      </fieldset>

      {decision === 'approve' ? (
        <>
          <CaseField form="executive" name="conditions" label="Conditions" required state={state}>
            {(control) => <textarea {...control} required maxLength={2000} rows={3} defaultValue={values.conditions} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="executive" name="implementerId" label="Implementer" required state={state} codes={['conditions_and_implementer_required', 'owner_not_eligible']}>
            {(control) => <OwnerSelect control={control} options={implementers} defaultValue={values.implementerId} />}
          </CaseField>
          <CaseField form="executive" name="scope" label="Approved scope" required state={state}>
            {(control) => <textarea {...control} required maxLength={2000} rows={3} defaultValue={values.scope} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="executive" name="reportingDuty" label="Reporting duty" hint="What the implementer reports, and how often." required state={state}>
            {(control) => <textarea {...control} required maxLength={1000} rows={2} defaultValue={values.reportingDuty} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="executive" name="dueDate" label="Due date" required state={state} codes={['scope_and_due_date_required', 'due_date_required', 'due_date_in_past']}>
            {(control) => <input {...control} type="date" required min={minDate} defaultValue={values.dueDate} className={CONTROL} />}
          </CaseField>
          <CaseSubmit>Approve with these conditions</CaseSubmit>
        </>
      ) : null}

      {decision === 'return' ? (
        <>
          <CaseField form="executive" name="question" label="What needs clarifying?" required state={state}>
            {(control) => <textarea {...control} required maxLength={1000} rows={3} defaultValue={values.question} className={TEXTAREA} />}
          </CaseField>
          <CaseSubmit tone="secondary">Return for clarification</CaseSubmit>
        </>
      ) : null}

      {decision === 'decline' ? (
        <>
          <CaseField form="executive" name="reason" label="Reason for declining" required state={state}>
            {(control) => <textarea {...control} required maxLength={2000} rows={3} defaultValue={values.reason} className={TEXTAREA} />}
          </CaseField>
          <CaseSubmit tone="danger">Decline the case</CaseSubmit>
        </>
      ) : null}
    </>
  );
}
