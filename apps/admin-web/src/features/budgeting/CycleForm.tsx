'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { saveCycle } from './actions';
import { BUDGET_TARGETS, DEFAULT_ELIGIBILITY, FUND_KINDS, FUND_KIND_LABELS } from './forms';

const PAIRS = [
  { pair: 'title', en: 'Title', long: false, min: 5, maxTa: 220, maxEn: 160, hint: undefined },
  { pair: 'description', en: 'What members are asked to decide', long: true, min: 10, maxTa: 4500, maxEn: 3000, hint: undefined },
  { pair: 'fundSource', en: 'Fund source', long: false, min: 3, maxTa: 450, maxEn: 300, hint: 'The lawful party or community fund that pays (OD-25).' },
  {
    pair: 'eligibility',
    en: 'Who may vote',
    long: true,
    min: 10,
    maxTa: 4500,
    maxEn: 3000,
    hint: 'Published to members before voting opens. The API checks OD-36 at ballot time: verified, active members aged 18 or over who live in the cycle’s area.',
  },
] as const;

/**
 * FR-PBG-001: a cycle's budget, fund source, dates and eligibility rules in Tamil and English. A new
 * cycle also picks its area, which never changes. Once voting is scheduled nothing here can change.
 */
export function CycleForm({ cycleId, current, areaOptions = [] }: { cycleId?: string; current?: Record<string, string>; areaOptions?: readonly AreaOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveCycle, null);
  const form = cycleId ? 'edit-cycle' : 'new-cycle';
  const values = state?.values ?? current ?? { eligibilityTa: DEFAULT_ELIGIBILITY.ta, eligibilityEn: DEFAULT_ELIGIBILITY.en, maxChoices: '3' };
  const fields = [...PAIRS.flatMap(({ pair }) => [`${pair}Ta`, `${pair}En`]), 'fundKind', 'budget', 'maxChoices', 'votingOpensAt', 'votingClosesAt', 'area'];

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={BUDGET_TARGETS} fields={fields} />
      {cycleId ? <input type="hidden" name="cycleId" value={cycleId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">சுழற்சியும் விதிகளும்</span> · The cycle and its rules, in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, long, min, maxTa, maxEn, hint }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            {(['Ta', 'En'] as const).map((suffix) => {
              const name = `${pair}${suffix}`;
              const lang = suffix === 'Ta' ? 'ta' : 'en';
              const max = suffix === 'Ta' ? maxTa : maxEn;
              return (
                <ActionField key={name} form={form} name={name} label={`${en}, in ${suffix === 'Ta' ? 'Tamil' : 'English'}`} hint={suffix === 'Ta' ? hint : undefined} required state={state} targets={BUDGET_TARGETS}>
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
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">நிதியும் திகதிகளும்</span> · Budget, choices and voting dates
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="fundKind" label="Kind of fund" hint="Never a public or government budget (FR-PBG-009)." required state={state} targets={BUDGET_TARGETS}>
            {(control) => (
              <select {...control} required defaultValue={values.fundKind ?? ''} className={CONTROL}>
                <option value="">Choose the kind of fund</option>
                {FUND_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {FUND_KIND_LABELS[kind].ta} · {FUND_KIND_LABELS[kind].en}
                  </option>
                ))}
              </select>
            )}
          </ActionField>
          <ActionField form={form} name="budget" label="Budget available, in rupees" hint="For example 1,500,000." required state={state} targets={BUDGET_TARGETS}>
            {(control) => <input {...control} required inputMode="decimal" maxLength={20} defaultValue={values.budget} className={`${CONTROL} tabular-nums`} />}
          </ActionField>
          <ActionField form={form} name="maxChoices" label="Projects each member may choose" hint="From 1 to 10; no more than the projects on the ballot." required state={state} targets={BUDGET_TARGETS}>
            {(control) => <input {...control} type="number" required min={1} max={10} defaultValue={values.maxChoices} className={CONTROL} />}
          </ActionField>
          <div aria-hidden="true" className="hidden md:block" />
          <ActionField form={form} name="votingOpensAt" label="Voting opens (Sri Lankan time)" hint="After the rules are published; they cannot change once voting is scheduled." required state={state} targets={BUDGET_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.votingOpensAt} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="votingClosesAt" label="Voting closes (Sri Lankan time)" hint="Voting can be closed only after this time." required state={state} targets={BUDGET_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.votingClosesAt} className={CONTROL} />}
          </ActionField>
        </div>
        {cycleId ? (
          <p className="text-sm text-muted">The area was set when the cycle was created and does not change.</p>
        ) : (
          <AreaPicker form={form} options={areaOptions} initial={state?.values.area || undefined} state={state} targets={BUDGET_TARGETS} />
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{cycleId ? 'Save the rules' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">
          {cycleId
            ? 'After publication, a change publishes the rules again with a new date.'
            : 'Members see nothing until the rules are published.'}
        </p>
      </div>
    </form>
  );
}
