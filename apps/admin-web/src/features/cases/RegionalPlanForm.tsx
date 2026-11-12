'use client';

import { useActionState } from 'react';

import { CONTROL } from '@/components/FormField';

import { submitRegionalPlan } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, TEXTAREA } from './fields';
import type { CaseFormState } from './forms';

const TIERS = [
  { value: '3A', label: 'Tier 3A · district' },
  { value: '3B', label: 'Tier 3B · district' },
  { value: '4', label: 'Tier 4 · region' },
  { value: '5', label: 'Tier 5 · executive' },
] as const;

/** W06 (FR-WEB-023): the regional plan goes to Tier 5 for approval; earlier versions are kept. */
export function RegionalPlanForm({ caseId }: { caseId: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(submitRegionalPlan, null);
  const values = state?.values ?? {};
  return (
    <ActionCard id="regional" title="Regional plan" intro="The plan goes to executive approval. A plan returned for clarification is sent again as a new version.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="regional" state={state} fields={['solution', 'responsibleTier', 'resources', 'expectedOutcome', 'reportingPlan']} />
        <input type="hidden" name="caseId" value={caseId} />
        <CaseField form="regional" name="solution" label="Proposed solution" required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={4000} rows={5} defaultValue={values.solution} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="regional" name="responsibleTier" label="Responsible tier" required state={state}>
          {(control) => (
            <select {...control} required defaultValue={values.responsibleTier ?? ''} className={CONTROL}>
              <option value="">Choose a tier</option>
              {TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          )}
        </CaseField>
        <CaseField form="regional" name="resources" label="Resources" required state={state}>
          {(control) => <textarea {...control} required minLength={3} maxLength={2000} rows={3} defaultValue={values.resources} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="regional" name="expectedOutcome" label="Expected outcome" required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={2000} rows={3} defaultValue={values.expectedOutcome} className={TEXTAREA} />}
        </CaseField>
        <CaseField form="regional" name="reportingPlan" label="Reporting plan" hint="Who reports progress, how often, and to whom." required state={state}>
          {(control) => <textarea {...control} required minLength={10} maxLength={2000} rows={3} defaultValue={values.reportingPlan} className={TEXTAREA} />}
        </CaseField>
        <CaseSubmit>Send plan for executive approval</CaseSubmit>
      </form>
    </ActionCard>
  );
}
