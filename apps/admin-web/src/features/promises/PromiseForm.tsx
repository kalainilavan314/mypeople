'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import { RowsBuilder } from '@/components/RowsBuilder';
import type { FormState } from '@/lib/formState';

import { savePromise } from './actions';
import { KINDS, KIND_LABELS, PROMISE_TARGETS, THEMES, THEME_LABELS } from './forms';

const PAIRS = [
  { pair: 'title', en: 'Title', long: false, min: 5, maxTa: 220, maxEn: 160, required: true },
  { pair: 'description', en: 'Description', long: true, min: 10, maxTa: 4500, maxEn: 3000, required: true },
  { pair: 'office', en: 'Office responsible', long: false, min: 3, maxTa: 300, maxEn: 200, required: true },
  { pair: 'target', en: 'Measurable target', long: true, min: 5, maxTa: 1500, maxEn: 1000, required: true },
  { pair: 'blockers', en: 'Known blockers (optional)', long: true, min: 0, maxTa: 3000, maxEn: 2000, required: false },
] as const;

/**
 * FR-PRM-001: a promise draft in Tamil and English. A new one also picks its area, which never
 * changes; a published promise changes only through approved updates.
 */
export function PromiseForm({ promiseId, current, areaOptions = [] }: { promiseId?: string; current?: Record<string, string>; areaOptions?: readonly AreaOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(savePromise, null);
  const form = promiseId ? 'edit' : 'new';
  const values = state?.values ?? current ?? {};
  const fields = [...PAIRS.flatMap(({ pair }) => [`${pair}Ta`, `${pair}En`]), 'sourceReference', 'kind', 'theme', 'plannedStart', 'dueDate', 'area', 'milestonesJson'];

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={PROMISE_TARGETS} fields={fields} />
      {promiseId ? <input type="hidden" name="promiseId" value={promiseId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">வாக்குறுதி</span> · The promise, in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, long, min, maxTa, maxEn, required }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            {(['Ta', 'En'] as const).map((suffix) => {
              const name = `${pair}${suffix}`;
              const lang = suffix === 'Ta' ? 'ta' : 'en';
              const max = suffix === 'Ta' ? maxTa : maxEn;
              return (
                <ActionField key={name} form={form} name={name} label={`${en}, in ${suffix === 'Ta' ? 'Tamil' : 'English'}`} required={required} state={state} targets={PROMISE_TARGETS}>
                  {(control) =>
                    long ? (
                      <textarea {...control} lang={lang} required={required} minLength={min || undefined} maxLength={max} rows={3} defaultValue={values[name]} className={TEXTAREA} />
                    ) : (
                      <input {...control} lang={lang} required={required} minLength={min || undefined} maxLength={max} defaultValue={values[name]} className={CONTROL} />
                    )
                  }
                </ActionField>
              );
            })}
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">மூலமும் வகையும்</span> · Source, kind and dates
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="sourceReference" label="Where it was first published" hint="A manifesto page, a speech, a gazette." required state={state} targets={PROMISE_TARGETS}>
            {(control) => <input {...control} required minLength={3} maxLength={500} defaultValue={values.sourceReference} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="sourcePublishedOn" label="Date it was published" required state={state} targets={PROMISE_TARGETS}>
            {(control) => <input {...control} type="date" required defaultValue={values.sourcePublishedOn} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="kind" label="Kind" hint="FR-PRM-004: a party commitment, or a responsibility that belongs to the government." required state={state} targets={PROMISE_TARGETS}>
            {(control) => (
              <select {...control} required defaultValue={values.kind ?? ''} className={CONTROL}>
                <option value="">Choose the kind</option>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind].ta} · {KIND_LABELS[kind].en}
                  </option>
                ))}
              </select>
            )}
          </ActionField>
          <ActionField form={form} name="theme" label="Theme" required state={state} targets={PROMISE_TARGETS}>
            {(control) => (
              <select {...control} required defaultValue={values.theme ?? ''} className={CONTROL}>
                <option value="">Choose a theme</option>
                {THEMES.map((theme) => (
                  <option key={theme} value={theme}>
                    {THEME_LABELS[theme].ta} · {THEME_LABELS[theme].en}
                  </option>
                ))}
              </select>
            )}
          </ActionField>
          <ActionField form={form} name="plannedStart" label="Planned start" required state={state} targets={PROMISE_TARGETS}>
            {(control) => <input {...control} type="date" required defaultValue={values.plannedStart} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="dueDate" label="Due date" hint="A published promise past this date becomes Delayed." required state={state} targets={PROMISE_TARGETS}>
            {(control) => <input {...control} type="date" required defaultValue={values.dueDate} className={CONTROL} />}
          </ActionField>
        </div>
        {promiseId ? (
          <p className="text-sm text-muted">The area was set when the promise was drafted and does not change.</p>
        ) : (
          <AreaPicker form={form} options={areaOptions} initial={state?.values.area || undefined} state={state} targets={PROMISE_TARGETS} />
        )}
      </fieldset>

      <div className="border-t border-line pt-6">
        <RowsBuilder
          form={form}
          name="milestonesJson"
          legend="Milestones / மைல்கற்கள்"
          rowLabel="Milestone"
          hint="Publication needs at least one milestone."
          max={30}
          initialJson={values.milestonesJson ?? '[]'}
          problems={(state?.problems ?? []).filter((problem) => PROMISE_TARGETS[problem.split(':')[0]] === 'milestonesJson')}
          columns={[
            { key: 'titleTa', label: 'Milestone in Tamil', lang: 'ta', required: true, maxLength: 300 },
            { key: 'titleEn', label: 'Milestone in English', lang: 'en', required: true, maxLength: 200 },
            { key: 'dueDate', label: 'Due (optional)', kind: 'date' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{promiseId ? 'Save draft' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">Nothing is public until a second person approves the publication.</p>
      </div>
    </form>
  );
}
