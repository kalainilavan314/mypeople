'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { saveGuideEntry } from './actions';
import { CATEGORIES, CATEGORY_LABELS, GUIDE_TARGETS, GUIDE_TEXT_FIELDS, TEXT_PAIRS } from './forms';

/**
 * D28: a guide entry in Tamil and English with its source and dates (FR-LIV-002, 005). Only the
 * category is needed to save a draft; review asks for everything. The guide never says who
 * qualifies (FR-LIV-004): write what the provider offers and how to apply, not who is eligible.
 */
export function EntryForm({ entryId, current, published = false }: { entryId?: string; current?: Record<string, string>; published?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveGuideEntry, null);
  const form = entryId ? 'edit-entry' : 'new-entry';
  const values = state?.values ?? current ?? {};

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={GUIDE_TARGETS} fields={[...GUIDE_TEXT_FIELDS]} />
      {entryId ? <input type="hidden" name="entryId" value={entryId} /> : null}

      <ActionField form={form} name="category" label="Category" required state={state} targets={GUIDE_TARGETS}>
        {(control) => (
          <select {...control} required defaultValue={values.category ?? ''} className={CONTROL}>
            <option value="">Choose a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category].ta} · {CATEGORY_LABELS[category].en}
              </option>
            ))}
          </select>
        )}
      </ActionField>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">பதிவு</span> · The entry, in Tamil and English
        </legend>
        <p className="text-sm text-muted">
          Describe what the provider offers and how to apply. Never write that a reader qualifies or will receive something: the app
          shows every entry with “check eligibility with the provider”, and wording such as “you qualify” is refused.
        </p>
        {TEXT_PAIRS.map(({ pair, en, long, maxTa, maxEn }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            {(['Ta', 'En'] as const).map((suffix) => {
              const name = `${pair}${suffix}`;
              const lang = suffix === 'Ta' ? 'ta' : 'en';
              const max = suffix === 'Ta' ? maxTa : maxEn;
              return (
                <ActionField key={name} form={form} name={name} label={`${en}, in ${suffix === 'Ta' ? 'Tamil' : 'English'}`} state={state} targets={GUIDE_TARGETS}>
                  {(control) =>
                    long ? (
                      <textarea {...control} lang={lang} maxLength={max} rows={pair === 'body' ? 6 : 3} defaultValue={values[name]} className={TEXTAREA} />
                    ) : (
                      <input {...control} lang={lang} maxLength={max} defaultValue={values[name]} className={CONTROL} />
                    )
                  }
                </ActionField>
              );
            })}
          </div>
        ))}
        <ActionField
          form={form}
          name="contact"
          label="Public contact of the office (optional)"
          hint="An official office's phone, e-mail or address only, never a private person's."
          state={state}
          targets={GUIDE_TARGETS}>
          {(control) => <input {...control} maxLength={300} defaultValue={values.contact} className={CONTROL} />}
        </ActionField>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">மூலமும் திகதிகளும்</span> · Source and dates
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <ActionField form={form} name="sourceUrl" label="Source link" hint="The provider's own page or notice, starting with https://" state={state} targets={GUIDE_TARGETS}>
              {(control) => <input {...control} type="url" maxLength={500} defaultValue={values.sourceUrl} className={`${CONTROL} font-mono`} />}
            </ActionField>
          </div>
          <ActionField form={form} name="publishedOn" label="Date the provider published it" state={state} targets={GUIDE_TARGETS}>
            {(control) => <input {...control} type="date" defaultValue={values.publishedOn} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="verifiedOn" label="Date you last checked it against the source" state={state} targets={GUIDE_TARGETS}>
            {(control) => <input {...control} type="date" defaultValue={values.verifiedOn} className={CONTROL} />}
          </ActionField>
          <ActionField
            form={form}
            name="expiresOn"
            label="End date (optional)"
            hint="The closing date. The entry leaves the guide the day after it."
            state={state}
            targets={GUIDE_TARGETS}>
            {(control) => <input {...control} type="date" defaultValue={values.expiresOn} className={CONTROL} />}
          </ActionField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{entryId ? 'Save changes' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">
          {published
            ? 'Saving takes this entry off the guide until a reviewer approves it again.'
            : 'A draft may be saved incomplete. Members see nothing until a second person reviews and publishes it.'}
        </p>
      </div>
    </form>
  );
}
