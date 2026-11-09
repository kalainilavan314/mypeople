'use client';

import { useActionState } from 'react';

import { Feedback } from '@/components/Feedback';
import { CONTROL, FormField } from '@/components/FormField';
import { SubmitButton } from '@/components/SubmitButton';
import { publishNotice } from '@/features/elections/actions';
import type { FormState } from '@/features/elections/forms';
import { getDictionary } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n/context';

/**
 * FR-ELX-004 notice form for one declared period. A refusal (such as official_source_required)
 * comes back with what was typed, so the bilingual text is never lost.
 */
export function PublishNoticeForm({ periodId }: { periodId: string }) {
  const locale = useLocale();
  const words = getDictionary(locale).elections;
  const [state, formAction] = useActionState<FormState, FormData>(publishNotice, null);
  const values = state?.values ?? {};
  const problems = state?.problems ?? [];

  return (
    // Remounted after each refusal so every control starts from the values just typed.
    <form key={state?.attempt ?? 0} action={formAction} aria-labelledby="publish-heading" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1 border-b border-line pb-2">
        <h2 id="publish-heading" lang={locale} className="text-base font-bold">
          {words.publishTitle}
        </h2>
        <p lang={locale} className="text-sm text-muted">
          {words.publishIntro}
        </p>
      </div>
      <Feedback error={state?.error} problems={problems.join(',')} />
      <input type="hidden" name="periodId" value={periodId} />

      <FormField name="source" label={words.fieldSource} required problems={problems} locale={locale}>
        {(control) => (
          <select {...control} required defaultValue={values.source ?? ''} className={CONTROL}>
            <option value="" disabled>
              —
            </option>
            <option value="election_commission">{words.sourceElectionCommission}</option>
            <option value="party">{words.sourceParty}</option>
          </select>
        )}
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField name="titleTa" label={words.fieldTitleTa} required problems={problems} locale={locale}>
          {(control) => <input {...control} lang="ta" required maxLength={160} defaultValue={values.titleTa} className={CONTROL} />}
        </FormField>
        <FormField name="titleEn" label={words.fieldTitleEn} required problems={problems} locale={locale}>
          {(control) => <input {...control} lang="en" required maxLength={160} defaultValue={values.titleEn} className={CONTROL} />}
        </FormField>
        <FormField name="bodyTa" label={words.fieldBodyTa} required problems={problems} locale={locale}>
          {(control) => (
            <textarea {...control} lang="ta" required rows={5} maxLength={2000} defaultValue={values.bodyTa} className={`${CONTROL} py-2 leading-relaxed`} />
          )}
        </FormField>
        <FormField name="bodyEn" label={words.fieldBodyEn} required problems={problems} locale={locale}>
          {(control) => (
            <textarea {...control} lang="en" required rows={5} maxLength={2000} defaultValue={values.bodyEn} className={`${CONTROL} py-2`} />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField name="sourceUrl" label={words.fieldNoticeSourceUrl} hint={words.commissionHint} problems={problems} locale={locale}>
          {(control) => (
            <input {...control} type="url" maxLength={500} pattern="https://.+" inputMode="url" defaultValue={values.sourceUrl} className={CONTROL} />
          )}
        </FormField>
        <FormField name="documentReference" label={words.fieldDocumentReference} hint={words.commissionHint} problems={problems} locale={locale}>
          {(control) => <input {...control} maxLength={200} defaultValue={values.documentReference} className={CONTROL} />}
        </FormField>
        <FormField
          name="sourcePublishedAt"
          label={words.fieldNoticeSourcePublishedAt}
          hint={`${words.commissionHint} ${words.timeHint}`}
          problems={problems}
          locale={locale}>
          {(control) => <input {...control} type="datetime-local" defaultValue={values.sourcePublishedAt} className={CONTROL} />}
        </FormField>
      </div>

      <div className="flex justify-end">
        <SubmitButton tone="primary">
          <span lang={locale}>{words.submitPublish}</span>
        </SubmitButton>
      </div>
    </form>
  );
}
