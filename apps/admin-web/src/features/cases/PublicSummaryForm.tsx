'use client';

import { useActionState, useState } from 'react';

import { CONTROL } from '@/components/FormField';

import { setPublicSummary } from './actions';
import { ActionCard, CaseField, CaseFormProblems, CaseSubmit, FieldErrors, TEXTAREA, fieldId, problemsFor } from './fields';
import type { CaseFormState } from './forms';

type Current = { titleTa: string; titleEn: string; summaryTa: string; summaryEn: string };

type Props = {
  caseId: string;
  current: Current;
  /** Unique on the page: the moderation queue shows one form per case. */
  formId?: string;
  /** Set on the moderation queue, so the moderator comes back to it. */
  returnTo?: 'moderation';
  /** The case is closed: the public summary should now give the outcome (BR-032). */
  afterClosure?: boolean;
};

/**
 * BR-032: what the public sees of a public case is the moderator's summary, in Tamil and English,
 * with no names, contact details or photos; or nothing, withheld with a reason. The closing report's
 * own summary reaches only the reporter, so after closure the moderator updates this one.
 */
export function PublicSummaryForm({ caseId, current, formId = 'public', returnTo, afterClosure = false }: Props) {
  const [state, action] = useActionState<CaseFormState, FormData>(setPublicSummary, null);
  return (
    <ActionCard
      id={formId}
      title={afterClosure ? 'Update the public summary with the outcome' : 'Public summary'}
      intro="Write it for the public: no names, phone numbers, addresses or photos. Publishing replaces the summary shown now.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <CaseFormProblems form={formId} state={state} fields={['decision', 'titleTa', 'titleEn', 'summaryTa', 'summaryEn', 'reason']} />
        <input type="hidden" name="caseId" value={caseId} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <PublicSummaryFields form={formId} state={state} current={current} />
      </form>
    </ActionCard>
  );
}

function PublicSummaryFields({ form, state, current }: { form: string; state: CaseFormState; current: Current }) {
  const values = state?.values ?? {};
  const [choice, setChoice] = useState(values.publish ?? '');
  const decisionErrors = problemsFor(state, 'decision');
  const text = (name: keyof Current) => (state ? values[name] : current[name]);

  return (
    <>
      <fieldset id={fieldId(form, 'decision')} tabIndex={-1} className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Decision *</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="publish" value="publish" required defaultChecked={choice === 'publish'} onChange={() => setChoice('publish')} className="size-5" />
          <span className="font-semibold">Publish this summary</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input type="radio" name="publish" value="withhold" required defaultChecked={choice === 'withhold'} onChange={() => setChoice('withhold')} className="size-5" />
          <span className="font-semibold">Withhold it from the public</span>
        </label>
        <FieldErrors id={decisionErrors.length ? `${form}-decision-error` : undefined} problems={decisionErrors} />
      </fieldset>

      {choice === 'publish' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <CaseField form={form} name="titleTa" label="Title in Tamil" required state={state}>
              {(control) => <input {...control} lang="ta" required minLength={5} maxLength={160} defaultValue={text('titleTa')} className={CONTROL} />}
            </CaseField>
            <CaseField form={form} name="titleEn" label="Title in English" required state={state}>
              {(control) => <input {...control} lang="en" required minLength={5} maxLength={120} defaultValue={text('titleEn')} className={CONTROL} />}
            </CaseField>
            <CaseField form={form} name="summaryTa" label="Summary in Tamil" required state={state}>
              {(control) => <textarea {...control} lang="ta" required minLength={10} maxLength={1500} rows={4} defaultValue={text('summaryTa')} className={TEXTAREA} />}
            </CaseField>
            <CaseField form={form} name="summaryEn" label="Summary in English" required state={state}>
              {(control) => <textarea {...control} lang="en" required minLength={10} maxLength={1000} rows={4} defaultValue={text('summaryEn')} className={TEXTAREA} />}
            </CaseField>
          </div>
          <CaseSubmit>Publish summary</CaseSubmit>
        </>
      ) : null}

      {choice === 'withhold' ? (
        <>
          <CaseField form={form} name="reason" label="Reason for withholding" required state={state}>
            {(control) => <textarea {...control} required maxLength={500} rows={2} defaultValue={values.reason} className={TEXTAREA} />}
          </CaseField>
          <CaseSubmit tone="secondary">Withhold</CaseSubmit>
        </>
      ) : null}
    </>
  );
}
