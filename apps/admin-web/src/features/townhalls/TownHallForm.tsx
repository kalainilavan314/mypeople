'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { saveTownHall } from './actions';
import { LANGUAGES, LANGUAGE_LABELS, TOWNHALL_FIELDS, TOWNHALL_TARGETS } from './forms';

const PAIRS = [
  { pair: 'title', en: 'Title', long: false, min: 5, maxTa: 220, maxEn: 160 },
  { pair: 'description', en: 'Description', long: true, min: 10, maxTa: 3000, maxEn: 2000 },
  { pair: 'speakers', en: 'Speakers', long: false, min: 3, maxTa: 700, maxEn: 500 },
] as const;

const LINKS = [
  { name: 'streamUrl', label: 'Video stream link (optional)' },
  { name: 'audioUrl', label: 'Audio-only link, 64 kbps or less (optional)' },
  { name: 'captionsUrl', label: 'Captions link (optional)' },
] as const;

/** FR-THL-001: a town hall session in Tamil and English. The area is chosen once, when it is made. */
export function TownHallForm({ townhallId, current, areaOptions = [] }: { townhallId?: string; current?: Record<string, string>; areaOptions?: readonly AreaOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveTownHall, null);
  const form = townhallId ? 'edit' : 'new';
  const values = state?.values ?? current ?? {};

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={TOWNHALL_TARGETS} fields={[...TOWNHALL_FIELDS]} />
      {townhallId ? <input type="hidden" name="townhallId" value={townhallId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">அமர்வு</span> · The session, in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, long, min, maxTa, maxEn }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            {(['Ta', 'En'] as const).map((suffix) => {
              const name = `${pair}${suffix}`;
              const lang = suffix === 'Ta' ? 'ta' : 'en';
              const max = suffix === 'Ta' ? maxTa : maxEn;
              return (
                <ActionField key={name} form={form} name={name} label={`${en}, in ${suffix === 'Ta' ? 'Tamil' : 'English'}`} required state={state} targets={TOWNHALL_TARGETS}>
                  {(control) =>
                    long ? (
                      <textarea {...control} lang={lang} required minLength={min} maxLength={max} rows={3} defaultValue={values[name]} className={TEXTAREA} />
                    ) : (
                      <input {...control} lang={lang} required minLength={min} maxLength={max} defaultValue={values[name]} className={CONTROL} />
                    )
                  }
                </ActionField>
              );
            })}
          </div>
        ))}
        <div className="grid gap-4 md:grid-cols-3">
          <ActionField form={form} name="language" label="Language of the session" required state={state} targets={TOWNHALL_TARGETS}>
            {(control) => (
              <select {...control} required defaultValue={values.language ?? 'both'} className={CONTROL}>
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {LANGUAGE_LABELS[language].ta} · {LANGUAGE_LABELS[language].en}
                  </option>
                ))}
              </select>
            )}
          </ActionField>
          <ActionField form={form} name="startsAt" label="Starts (Sri Lankan time)" required state={state} targets={TOWNHALL_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.startsAt} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="endsAt" label="Ends (Sri Lankan time)" required state={state} targets={TOWNHALL_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.endsAt} className={CONTROL} />}
          </ActionField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">ஒளிபரப்பு</span> · Stream and review
        </legend>
        <p className="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-sm text-warning">
          The streaming provider is still to be chosen (OD-44). Add https links when they exist; the session can be made without them.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {LINKS.map((link) => (
            <ActionField key={link.name} form={form} name={link.name} label={link.label} state={state} targets={TOWNHALL_TARGETS}>
              {(control) => <input {...control} type="url" pattern="https://.*" maxLength={500} defaultValue={values[link.name]} className={CONTROL} />}
            </ActionField>
          ))}
        </div>
        <ActionField
          form={form}
          name="legalReviewRef"
          label="Legal review reference"
          hint="Needed when the session falls in an election period."
          state={state}
          targets={TOWNHALL_TARGETS}>
          {(control) => <input {...control} maxLength={200} defaultValue={values.legalReviewRef} className={`${CONTROL} md:max-w-md`} />}
        </ActionField>
        {townhallId ? (
          <p className="text-sm text-muted">The area was set when the session was made and does not change.</p>
        ) : (
          <AreaPicker form={form} options={areaOptions} initial={state?.values.area || undefined} state={state} targets={TOWNHALL_TARGETS} />
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{townhallId ? 'Save changes' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">Members see the session once it is scheduled.</p>
      </div>
    </form>
  );
}
