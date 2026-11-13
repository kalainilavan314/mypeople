'use client';

import { useActionState } from 'react';

import { ActionCard, ActionField, ActionProblems, ActionSubmit } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { ROSTER_TARGETS } from './roster';
import { createShift } from './rosterActions';

const TEXTS = [
  { name: 'roleTa', label: 'Role in Tamil', lang: 'ta', max: 160 },
  { name: 'roleEn', label: 'Role in English', lang: 'en', max: 120 },
  { name: 'siteTa', label: 'Site in Tamil', lang: 'ta', max: 300 },
  { name: 'siteEn', label: 'Site in English', lang: 'en', max: 200 },
] as const;

/** FR-ELX-006: a duty shift in this period, inside its election area. */
export function ShiftForm({ periodId, areaOptions }: { periodId: string; areaOptions: readonly AreaOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(createShift, null);
  const values = state?.values ?? {};
  return (
    <ActionCard id="shift" title="New duty shift" intro="Shifts are offered by member ID; the volunteer accepts or declines in the app. No location is ever recorded at check-in.">
      <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-4">
        <ActionProblems form="shift" state={state} targets={ROSTER_TARGETS} fields={['roleTa', 'siteTa', 'startsAt', 'endsAt', 'places', 'area']} />
        <input type="hidden" name="periodId" value={periodId} />
        <div className="grid gap-4 md:grid-cols-2">
          {TEXTS.map((field) => (
            <ActionField key={field.name} form="shift" name={field.name} label={field.label} required state={state} targets={ROSTER_TARGETS}>
              {(control) => <input {...control} lang={field.lang} required minLength={3} maxLength={field.max} defaultValue={values[field.name]} className={CONTROL} />}
            </ActionField>
          ))}
          <ActionField form="shift" name="startsAt" label="Starts (Sri Lankan time)" required state={state} targets={ROSTER_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.startsAt} className={CONTROL} />}
          </ActionField>
          <ActionField form="shift" name="endsAt" label="Ends (Sri Lankan time)" required state={state} targets={ROSTER_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.endsAt} className={CONTROL} />}
          </ActionField>
          <ActionField form="shift" name="places" label="Places (1 to 200)" required state={state} targets={ROSTER_TARGETS}>
            {(control) => <input {...control} type="number" inputMode="numeric" min={1} max={200} required defaultValue={values.places} className={CONTROL} />}
          </ActionField>
        </div>
        <AreaPicker form="shift" options={areaOptions} initial={values.area || undefined} state={state} targets={ROSTER_TARGETS} />
        <ActionSubmit>Create shift</ActionSubmit>
      </form>
    </ActionCard>
  );
}
