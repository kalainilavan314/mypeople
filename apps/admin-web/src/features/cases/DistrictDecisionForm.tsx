'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { decideAtDistrict } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, FieldErrors, OwnerSelect, TEXTAREA, fieldId, problemsFor } from './fields';
import type { CaseFormState } from './forms';

type Owners = { implementers: readonly CaseOwnerOption[]; regional: readonly CaseOwnerOption[] };

/**
 * W05 (FR-WEB-021): act within the district's delegated authority, or escalate to the regional
 * plan with the reason and the decision needed. An escalation is recorded as "Escalated", never
 * as an approval.
 */
export function DistrictDecisionForm({ caseId, owners, minDate }: { caseId: string; owners: Owners; minDate: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(decideAtDistrict, null);
  return (
    <ActionCard id="district" title="District decision" intro="Choose one. Both are recorded in the case history with your name.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems
          form="district"
          state={state}
          fields={['decision', 'authority', 'scope', 'resources', 'office', 'ownerId', 'dueDate', 'reason', 'decisionRequired', 'regionalOwnerId']}
        />
        <input type="hidden" name="caseId" value={caseId} />
        <DistrictFields state={state} owners={owners} minDate={minDate} />
      </form>
    </ActionCard>
  );
}

function DistrictFields({ state, owners, minDate }: { state: CaseFormState; owners: Owners; minDate: string }) {
  const values = state?.values ?? {};
  const [decision, setDecision] = useState(values.decision ?? '');
  const decisionErrors = problemsFor(state, 'decision');

  return (
    <>
      <fieldset id={fieldId('district', 'decision')} tabIndex={-1} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Decision *</legend>
        <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="decision" value="act" required defaultChecked={decision === 'act'} onChange={() => setDecision('act')} className="mt-0.5 size-5" />
          <span>
            <span className="block font-semibold">Act within delegated authority</span>
            <span className="text-muted">The district acts now and names who implements it, by when.</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="decision" value="escalate" required defaultChecked={decision === 'escalate'} onChange={() => setDecision('escalate')} className="mt-0.5 size-5" />
          <span>
            <span className="block font-semibold">Escalate to a regional plan</span>
            <span className="text-muted">The case needs a decision beyond the district&rsquo;s authority.</span>
          </span>
        </label>
        <FieldErrors id={decisionErrors.length ? 'district-decision-error' : undefined} problems={decisionErrors} />
      </fieldset>

      {decision === 'act' ? (
        <>
          <CaseField form="district" name="authority" label="Delegated authority used" hint="For example the circular or the budget line that allows the district to act." required state={state}>
            {(control) => <input {...control} required maxLength={500} defaultValue={values.authority} className={CONTROL} />}
          </CaseField>
          <CaseField
            form="district"
            name="scope"
            label="Approved scope"
            hint="The work the implementation owner is to do, and nothing beyond it. It is shown at implementation."
            required
            state={state}>
            {(control) => <textarea {...control} required maxLength={2000} rows={3} defaultValue={values.scope} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="district" name="resources" label="Resources" required state={state}>
            {(control) => <textarea {...control} required maxLength={1000} rows={2} defaultValue={values.resources} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="district" name="office" label="Responsible office" required state={state}>
            {(control) => <input {...control} required maxLength={300} defaultValue={values.office} className={CONTROL} />}
          </CaseField>
          <div className="grid gap-4 md:grid-cols-2">
            <CaseField form="district" name="ownerId" label="Implementation owner" required state={state}>
              {(control) => <OwnerSelect control={control} options={owners.implementers} defaultValue={values.ownerId} />}
            </CaseField>
            <CaseField form="district" name="dueDate" label="Due date" required state={state}>
              {(control) => <input {...control} type="date" required min={minDate} defaultValue={values.dueDate} className={CONTROL} />}
            </CaseField>
          </div>
          <CaseSubmit>Record the district action</CaseSubmit>
        </>
      ) : null}

      {decision === 'escalate' ? (
        <>
          <CaseField form="district" name="reason" label="Why the district cannot decide this" required state={state}>
            {(control) => <textarea {...control} required maxLength={2000} rows={3} defaultValue={values.reason} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="district" name="decisionRequired" label="Decision required from the region" required state={state} codes={['reason_and_decision_required']}>
            {(control) => <textarea {...control} required maxLength={1000} rows={2} defaultValue={values.decisionRequired} className={TEXTAREA} />}
          </CaseField>
          <CaseField form="district" name="regionalOwnerId" label="Regional owner" required state={state} codes={['regional_owner_required', 'owner_not_eligible']}>
            {(control) => <OwnerSelect control={control} options={owners.regional} defaultValue={values.regionalOwnerId} />}
          </CaseField>
          <CaseSubmit>Escalate</CaseSubmit>
        </>
      ) : null}
    </>
  );
}
