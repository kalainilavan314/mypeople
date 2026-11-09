'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { Feedback } from '@/components/Feedback';
import { CONTROL, FormField } from '@/components/FormField';
import { SubmitButton } from '@/components/SubmitButton';
import { declarePeriod } from '@/features/elections/actions';
import { AREA_LEVELS, ELECTION_TYPES, type FormState } from '@/features/elections/forms';
import { electionTypeText } from '@/features/elections/periods';
import { getDictionary } from '@/lib/i18n';
import { useLocale } from '@/lib/i18n/context';

type District = { code: string; name: string };

/**
 * D22 declare form. A refusal comes back in the action's answer with what was typed, so the
 * thirteen fields are never lost to a silence-window mistake.
 */
export function DeclarePeriodForm({ districts }: { districts: District[] }) {
  const locale = useLocale();
  const words = getDictionary(locale).elections;
  const [state, formAction] = useActionState<FormState, FormData>(declarePeriod, null);
  const values = state?.values ?? {};
  const problems = state?.problems ?? [];
  const confirmProblem = problems.includes('confirmation_required');

  const levelText: Record<(typeof AREA_LEVELS)[number], string> = {
    platform: words.wholeCountry,
    province: words.levelProvince,
    district: words.levelDistrict,
    ds: words.levelDs,
    gn: words.levelGn,
  };

  return (
    // A new key after each refusal remounts the form, so every control (selects included) starts from
    // the values just typed rather than being reset to the first render's defaults.
    <form key={state?.attempt ?? 0} action={formAction} className="flex flex-col gap-6 rounded-xl border border-line bg-card p-4 sm:p-6">
      <Feedback error={state?.error} problems={problems.join(',')} />

      <section aria-labelledby="declare-election" className="flex flex-col gap-4">
        <h2 id="declare-election" lang={locale} className="text-base font-bold">
          {words.sectionElection}
        </h2>
        <FormField name="electionType" label={words.fieldElectionType} required problems={problems} locale={locale}>
          {(control) => (
            <select {...control} required defaultValue={values.electionType ?? ''} className={CONTROL}>
              <option value="" disabled>
                —
              </option>
              {ELECTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {electionTypeText(type, words)}
                </option>
              ))}
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
        </div>
      </section>

      <section aria-labelledby="declare-area" className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 id="declare-area" lang={locale} className="text-base font-bold">
          {words.sectionArea}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField name="areaLevel" label={words.fieldAreaLevel} required problems={problems} locale={locale}>
            {(control) => (
              <select {...control} required defaultValue={values.areaLevel ?? 'district'} className={CONTROL}>
                {AREA_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {levelText[level]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField name="areaCode" label={words.fieldAreaCode} hint={words.areaCodeHint} problems={problems} locale={locale}>
            {(control) => (
              <input
                {...control}
                list={districts.length > 0 ? 'district-codes' : undefined}
                autoComplete="off"
                maxLength={20}
                defaultValue={values.areaCode}
                className={`${CONTROL} font-mono`}
              />
            )}
          </FormField>
        </div>
        {districts.length > 0 ? (
          <datalist id="district-codes">
            {districts.map((district) => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
          </datalist>
        ) : null}
      </section>

      <section aria-labelledby="declare-dates" className="flex flex-col gap-4 border-t border-line pt-6">
        <div className="flex flex-col gap-1">
          <h2 id="declare-dates" lang={locale} className="text-base font-bold">
            {words.sectionDates}
          </h2>
          <p lang={locale} className="text-sm text-muted">
            {words.silenceHint} {words.timeHint}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField name="startsAt" label={words.fieldStartsAt} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.startsAt} className={CONTROL} />}
          </FormField>
          <FormField name="endsAt" label={words.fieldEndsAt} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.endsAt} className={CONTROL} />}
          </FormField>
          <FormField name="silenceStartsAt" label={words.fieldSilenceStartsAt} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.silenceStartsAt} className={CONTROL} />}
          </FormField>
          <FormField name="silenceEndsAt" label={words.fieldSilenceEndsAt} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.silenceEndsAt} className={CONTROL} />}
          </FormField>
          <FormField name="pollingDay" label={words.fieldPollingDay} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="date" required defaultValue={values.pollingDay} className={CONTROL} />}
          </FormField>
        </div>
      </section>

      <section aria-labelledby="declare-source" className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 id="declare-source" lang={locale} className="text-base font-bold">
          {words.sectionSource}
        </h2>
        <FormField name="sourceUrl" label={words.fieldSourceUrl} hint={words.sourceUrlHint} required problems={problems} locale={locale}>
          {(control) => (
            <input
              {...control}
              type="url"
              required
              maxLength={500}
              pattern="https://.+"
              inputMode="url"
              defaultValue={values.sourceUrl}
              className={CONTROL}
            />
          )}
        </FormField>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField name="sourceReference" label={words.fieldSourceReference} hint={words.sourceReferenceHint} required problems={problems} locale={locale}>
            {(control) => <input {...control} required maxLength={200} defaultValue={values.sourceReference} className={CONTROL} />}
          </FormField>
          <FormField name="sourcePublishedAt" label={words.fieldSourcePublishedAt} hint={words.timeHint} required problems={problems} locale={locale}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.sourcePublishedAt} className={CONTROL} />}
          </FormField>
        </div>
      </section>

      <div className="rounded-lg border border-line bg-surface p-4">
        <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
          <input
            id="input-confirm"
            type="checkbox"
            name="confirm"
            value="1"
            required
            aria-invalid={confirmProblem ? true : undefined}
            className="mt-0.5 h-5 w-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <span lang={locale}>{words.confirmDeclare}</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-6">
        <Link
          href="/elections"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span lang={locale}>{getDictionary(locale).common.cancel}</span>
        </Link>
        <SubmitButton tone="primary">
          <span lang={locale}>{words.submitDeclare}</span>
        </SubmitButton>
      </div>
    </form>
  );
}
