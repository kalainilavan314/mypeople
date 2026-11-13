'use client';

import { useActionState, useState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, FieldErrors, TEXTAREA, fieldId, problemsFor } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { decideOffer } from './actions';
import { VOLUNTEER_TARGETS } from './forms';

/**
 * S10: confirm a volunteer with a meeting point in Tamil and English (the role is the opportunity's
 * unless changed here), or decline with a reason. The volunteer is told either way.
 */
export function OfferDecisionForm({ opportunityId, offerId, placesLeft }: { opportunityId: string; offerId: string; placesLeft: number }) {
  const [state, action] = useActionState<FormState, FormData>(decideOffer, null);
  const form = `offer-${offerId.slice(0, 8)}`;
  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-3 border-t border-line pt-3">
      <ActionProblems form={form} state={state} targets={VOLUNTEER_TARGETS} fields={['decision', 'meetingPointTa', 'meetingPointEn', 'reason']} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="offerId" value={offerId} />
      <DecisionFields form={form} state={state} placesLeft={placesLeft} />
    </form>
  );
}

function DecisionFields({ form, state, placesLeft }: { form: string; state: FormState; placesLeft: number }) {
  const values = state?.values ?? {};
  const [choice, setChoice] = useState(values.decision ?? '');
  const decisionErrors = problemsFor(state, VOLUNTEER_TARGETS, 'decision');
  const full = placesLeft <= 0;

  return (
    <>
      <fieldset id={fieldId(form, 'decision')} tabIndex={-1} className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Decision *</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="decision" value="confirm" required defaultChecked={choice === 'confirm'} onChange={() => setChoice('confirm')} className="size-5" />
          <span className="font-semibold">Confirm this volunteer</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="decision" value="decline" required defaultChecked={choice === 'decline'} onChange={() => setChoice('decline')} className="size-5" />
          <span className="font-semibold">Decline with a reason</span>
        </label>
        <FieldErrors id={decisionErrors.length ? `${form}-decision-error` : undefined} problems={decisionErrors} />
      </fieldset>

      {choice === 'confirm' ? (
        <>
          {full ? (
            <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
              ! Every place is filled. Add places to the opportunity before confirming anyone else.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <ActionField form={form} name="meetingPointTa" label="Meeting point in Tamil" required state={state} targets={VOLUNTEER_TARGETS}>
              {(control) => <input {...control} lang="ta" required minLength={3} maxLength={300} defaultValue={values.meetingPointTa} className={CONTROL} />}
            </ActionField>
            <ActionField form={form} name="meetingPointEn" label="Meeting point in English" required state={state} targets={VOLUNTEER_TARGETS}>
              {(control) => <input {...control} lang="en" required minLength={3} maxLength={200} defaultValue={values.meetingPointEn} className={CONTROL} />}
            </ActionField>
            <ActionField form={form} name="roleTa" label="Role in Tamil (optional)" hint="Leave empty to keep the opportunity’s role." state={state} targets={VOLUNTEER_TARGETS}>
              {(control) => <input {...control} lang="ta" minLength={3} maxLength={160} defaultValue={values.roleTa} className={CONTROL} />}
            </ActionField>
            <ActionField form={form} name="roleEn" label="Role in English (optional)" hint="Leave empty to keep the opportunity’s role." state={state} targets={VOLUNTEER_TARGETS}>
              {(control) => <input {...control} lang="en" minLength={3} maxLength={120} defaultValue={values.roleEn} className={CONTROL} />}
            </ActionField>
          </div>
          <ActionSubmit disabled={full}>Confirm volunteer</ActionSubmit>
        </>
      ) : null}

      {choice === 'decline' ? (
        <>
          <ActionField form={form} name="reason" label="Reason, sent to the volunteer" required state={state} targets={VOLUNTEER_TARGETS}>
            {(control) => <textarea {...control} required maxLength={500} rows={2} defaultValue={values.reason} className={TEXTAREA} />}
          </ActionField>
          <ActionSubmit tone="danger">Decline offer</ActionSubmit>
        </>
      ) : null}
    </>
  );
}
