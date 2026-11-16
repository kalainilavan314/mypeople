'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { decideChallenge } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, FieldErrors, OwnerSelect, TEXTAREA, fieldId, problemsFor } from './fields';
import type { CaseFormState } from './forms';
import { REOPEN_STAGES, STAGE_LABELS, type ReopenStage } from './stages';

type OwnersByStage = Readonly<Record<ReopenStage, readonly CaseOwnerOption[]>>;

/**
 * FR-WEB-027: the reporter challenged the closure. Accepting reopens the case at a chosen stage
 * with a new owner; rejecting answers the reporter with the reason. The history is kept either way.
 */
export function ChallengeForm({ caseId, owners, minDate }: { caseId: string; owners: OwnersByStage; minDate: string }) {
  const [state, action] = useActionState<CaseFormState, FormData>(decideChallenge, null);
  return (
    <ActionCard id="challenge" title="Decide the closure challenge">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form="challenge" state={state} fields={['decision', 'stage', 'ownerId', 'dueDate', 'reason']} />
        <input type="hidden" name="caseId" value={caseId} />
        <ChallengeFields state={state} owners={owners} minDate={minDate} />
      </form>
    </ActionCard>
  );
}

function ChallengeFields({ state, owners, minDate }: { state: CaseFormState; owners: OwnersByStage; minDate: string }) {
  const values = state?.values ?? {};
  const [choice, setChoice] = useState(values.accept ?? '');
  const [stage, setStage] = useState(values.stage ?? '');
  const reopenStage = (REOPEN_STAGES as readonly string[]).includes(stage) ? (stage as ReopenStage) : null;
  const decisionErrors = problemsFor(state, 'decision');

  return (
    <>
      <fieldset id={fieldId('challenge', 'decision')} tabIndex={-1} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Decision *</legend>
        <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="accept" value="accept" required defaultChecked={choice === 'accept'} onChange={() => setChoice('accept')} className="mt-0.5 size-5" />
          <span>
            <span className="block font-semibold">Accept and reopen the case</span>
            <span className="text-muted">Choose the stage it goes back to and its new owner.</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="accept" value="reject" required defaultChecked={choice === 'reject'} onChange={() => setChoice('reject')} className="mt-0.5 size-5" />
          <span>
            <span className="block font-semibold">Reject the challenge</span>
            <span className="text-muted">The case stays resolved; the reporter is told your reason.</span>
          </span>
        </label>
        <FieldErrors id={decisionErrors.length ? 'challenge-decision-error' : undefined} problems={decisionErrors} />
      </fieldset>

      {choice === 'accept' ? (
        <>
          <CaseField form="challenge" name="stage" label="Reopen at" required state={state}>
            {(control) => (
              <select {...control} required defaultValue={stage} onChange={(event) => setStage(event.target.value)} className={CONTROL}>
                <option value="">Choose a stage</option>
                {REOPEN_STAGES.map((code) => (
                  <option key={code} value={code}>
                    {STAGE_LABELS[code].en}
                  </option>
                ))}
              </select>
            )}
          </CaseField>
          {reopenStage ? (
            <CaseField form="challenge" name="ownerId" label={`New owner for ${STAGE_LABELS[reopenStage].en}`} required state={state}>
              {(control) => (
                // A new list for each stage: the owner must hold that stage's permission.
                <OwnerSelect key={reopenStage} control={control} options={owners[reopenStage]} defaultValue={values.stage === reopenStage ? values.ownerId : ''} />
              )}
            </CaseField>
          ) : null}
          {reopenStage === 'implementation' ? (
            <CaseField form="challenge" name="dueDate" label="Implementation due date" required state={state}>
              {(control) => <input {...control} type="date" required min={minDate} defaultValue={values.dueDate} className={CONTROL} />}
            </CaseField>
          ) : null}
        </>
      ) : null}

      {choice ? (
        <>
          <CaseField form="challenge" name="reason" label={choice === 'accept' ? 'Why the challenge is accepted' : 'Why the challenge is rejected'} required state={state}>
            {(control) => <textarea {...control} required minLength={5} maxLength={1000} rows={3} defaultValue={values.reason} className={TEXTAREA} />}
          </CaseField>
          <CaseSubmit tone={choice === 'accept' ? 'primary' : 'secondary'}>{choice === 'accept' ? 'Reopen the case' : 'Reject the challenge'}</CaseSubmit>
        </>
      ) : null}
    </>
  );
}
