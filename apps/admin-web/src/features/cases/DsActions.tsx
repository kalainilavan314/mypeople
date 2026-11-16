'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { addFinding, sendDsReport } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, OwnerSelect, TEXTAREA } from './fields';
import type { CaseFormState } from './forms';
import { FINDING_KINDS, FINDING_LABELS } from './stages';

// W04: divisional research. Assistants (Tier 2B) may add findings; only the deciding tier sends
// the report, which the API reflects in the actions it allows (FR-WEB-019, FR-WEB-020).

export function AddFindingForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(addFinding, null);
  return (
    <ActionCard
      id="finding"
      title="Add a research finding"
      intro="Keep verified facts apart from assumptions. A verified fact needs its source.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="finding" state={state} fields={['kind', 'statement', 'source']} />
        <input type="hidden" name="caseId" value={caseId} />
        <FindingFields state={state} />
        <CaseSubmit>Add finding</CaseSubmit>
      </form>
    </ActionCard>
  );
}

function FindingFields({ state }: { state: CaseFormState }) {
  const values = state?.values ?? {};
  const [kind, setKind] = useState(values.kind ?? '');
  const sourceRequired = kind === 'verified_fact';
  return (
    <>
      <CaseField form="finding" name="kind" label="Kind of finding" required state={state}>
        {(control) => (
          <select {...control} required defaultValue={kind} onChange={(event) => setKind(event.target.value)} className={CONTROL}>
            <option value="">Choose a kind</option>
            {FINDING_KINDS.map((code) => (
              <option key={code} value={code}>
                {FINDING_LABELS[code].en}
              </option>
            ))}
          </select>
        )}
      </CaseField>
      <CaseField form="finding" name="statement" label="Finding" required state={state}>
        {(control) => <textarea {...control} required minLength={3} maxLength={1500} rows={3} defaultValue={values.statement} className={TEXTAREA} />}
      </CaseField>
      <CaseField
        form="finding"
        name="source"
        label={sourceRequired ? 'Source' : 'Source (optional)'}
        hint={sourceRequired ? 'A verified fact must say where it was verified.' : undefined}
        required={sourceRequired}
        state={state}>
        {(control) => <input {...control} required={sourceRequired} maxLength={300} defaultValue={values.source} className={CONTROL} />}
      </CaseField>
    </>
  );
}

export function DsReportForm({ caseId, owners }: { caseId: string; owners: readonly CaseOwnerOption[] }) {
  const [state, action] = useActionState<CaseFormState, FormData>(sendDsReport, null);
  const values = state?.values ?? {};
  return (
    <ActionCard
      id="ds-report"
      title="Send the divisional report to the district"
      intro="The report, its evidence and your recommendation go to the district officer you name. Earlier versions are kept.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="ds-report" state={state} fields={['summary', 'evidenceRefs', 'recommendation', 'districtOwnerId']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="ds-report" name="summary" label="Summary of the research" required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={4000} rows={5} defaultValue={values.summary} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="ds-report" name="evidenceRefs" label="Evidence references" hint="One per line, for example a file number or a photo taken on a site visit. Up to 20." state={state}>
          {(control) => <textarea {...control} rows={3} defaultValue={values.evidenceRefs} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="ds-report" name="recommendation" label="Recommendation" required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={2000} rows={3} defaultValue={values.recommendation} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="ds-report" name="districtOwnerId" label="District owner" required state={state} codes={['district_owner_required', 'owner_not_eligible']}>
          {(control) => <OwnerSelect control={control} options={owners} defaultValue={values.districtOwnerId} />}
        </CaseField>
        <CaseSubmit>Send report to the district</CaseSubmit>
      </form>
    </ActionCard>
  );
}
