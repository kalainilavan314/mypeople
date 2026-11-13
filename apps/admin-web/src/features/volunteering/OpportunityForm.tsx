'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, CheckRow, FieldErrors, TEXTAREA, fieldId, problemsFor } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { createOpportunity, updateOpportunity } from './actions';
import { MAX_SKILLS, TEXT_FIELDS, VOLUNTEER_TARGETS, type TextPair } from './forms';

type Skill = { key: string; nameEn: string; nameTa: string };
type EventChoice = { id: string; eventRef: string; titleEn: string };

/** What the form starts with when editing: every text field, the times as Sri Lankan time, places. */
export type OpportunityValues = Record<string, string>;

const PAIRS: readonly { pair: TextPair; en: string; long?: boolean; min: number; maxTa: number; maxEn: number; hint?: string }[] = [
  { pair: 'title', en: 'Title', min: 5, maxTa: 160, maxEn: 120 },
  { pair: 'role', en: 'Role', min: 3, maxTa: 160, maxEn: 120, hint: 'What the volunteer does, e.g. “Registration desk”.' },
  { pair: 'description', en: 'Description', long: true, min: 10, maxTa: 3000, maxEn: 2000 },
  { pair: 'place', en: 'Place', min: 3, maxTa: 300, maxEn: 200 },
  { pair: 'bring', en: 'What to bring', min: 2, maxTa: 800, maxEn: 500 },
  { pair: 'team', en: 'Team', min: 3, maxTa: 160, maxEn: 120, hint: 'The team or coordinator volunteers report to.' },
];

/**
 * A volunteering opportunity in Tamil and English (S10). A new one also picks its area, the skills
 * it needs and an optional linked event; those are fixed once it exists, so editing leaves them out.
 */
export function OpportunityForm({
  opportunityId,
  current,
  areaOptions = [],
  skills = [],
  events = [],
}: {
  opportunityId?: string;
  current?: OpportunityValues;
  areaOptions?: readonly AreaOption[];
  skills?: readonly Skill[];
  events?: readonly EventChoice[];
}) {
  const editing = Boolean(opportunityId);
  const [state, action] = useActionState<FormState, FormData>(editing ? updateOpportunity : createOpportunity, null);
  const form = editing ? 'edit' : 'new';
  const values = state?.values ?? current ?? {};
  const chosenSkills = new Set((state?.values.skills ?? '').split(',').filter(Boolean));
  const skillErrors = problemsFor(state, VOLUNTEER_TARGETS, 'skills');
  const fields = [...TEXT_FIELDS, 'startsAt', 'endsAt', 'places', 'area', 'skills'];

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={VOLUNTEER_TARGETS} fields={fields} />
      {opportunityId ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">விவரங்கள்</span> · Details in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, long, min, maxTa, maxEn, hint }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            <ActionField form={form} name={`${pair}Ta`} label={`${en} in Tamil`} hint={hint} required state={state} targets={VOLUNTEER_TARGETS}>
              {(control) =>
                long ? (
                  <textarea {...control} lang="ta" required minLength={min} maxLength={maxTa} rows={4} defaultValue={values[`${pair}Ta`]} className={TEXTAREA} />
                ) : (
                  <input {...control} lang="ta" required minLength={min} maxLength={maxTa} defaultValue={values[`${pair}Ta`]} className={CONTROL} />
                )
              }
            </ActionField>
            <ActionField form={form} name={`${pair}En`} label={`${en} in English`} required state={state} targets={VOLUNTEER_TARGETS}>
              {(control) =>
                long ? (
                  <textarea {...control} lang="en" required minLength={min} maxLength={maxEn} rows={4} defaultValue={values[`${pair}En`]} className={TEXTAREA} />
                ) : (
                  <input {...control} lang="en" required minLength={min} maxLength={maxEn} defaultValue={values[`${pair}En`]} className={CONTROL} />
                )
              }
            </ActionField>
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">நேரமும் இடங்களும்</span> · Time and places
        </legend>
        <div className="grid gap-4 md:grid-cols-3">
          <ActionField form={form} name="startsAt" label="Starts (Sri Lankan time)" required state={state} targets={VOLUNTEER_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.startsAt} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="endsAt" label="Ends (Sri Lankan time)" required state={state} targets={VOLUNTEER_TARGETS}>
            {(control) => <input {...control} type="datetime-local" required defaultValue={values.endsAt} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="places" label="Places" hint="How many volunteers can be confirmed (1 to 500)." required state={state} targets={VOLUNTEER_TARGETS}>
            {(control) => <input {...control} type="number" inputMode="numeric" min={1} max={500} required defaultValue={values.places} className={CONTROL} />}
          </ActionField>
        </div>
        {editing && current ? (
          <>
            <input type="hidden" name="startsAtWas" value={current.startsAt ?? ''} />
            <input type="hidden" name="endsAtWas" value={current.endsAt ?? ''} />
          </>
        ) : null}
      </fieldset>

      {editing ? null : (
        <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
          <legend className="mb-2 text-base font-bold text-text">
            <span lang="ta">பகுதி, திறன்கள், நிகழ்வு</span> · Area, skills and event
          </legend>
          <p className="text-sm text-muted">These are fixed once the opportunity is saved.</p>
          <AreaPicker form={form} options={areaOptions} initial={state?.values.area || undefined} state={state} targets={VOLUNTEER_TARGETS} />

          <fieldset id={fieldId(form, 'skills')} tabIndex={-1} className="flex flex-col gap-1" aria-describedby={`${form}-skills-hint`}>
            <legend className="text-sm font-semibold">Skills needed (optional)</legend>
            <p id={`${form}-skills-hint`} className="text-xs text-muted">
              Up to {MAX_SKILLS}. Volunteers who shared these skills can see that the opportunity needs them.
            </p>
            {skills.length === 0 ? (
              <p className="text-sm text-muted">The skills list is empty or could not be loaded.</p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((skill) => (
                  <CheckRow
                    key={skill.key}
                    name="skills"
                    value={skill.key}
                    defaultChecked={chosenSkills.has(skill.key)}
                    label={
                      <>
                        <span lang="ta" className="block">
                          {skill.nameTa}
                        </span>
                        <span lang="en" className="block text-xs font-normal text-muted">
                          {skill.nameEn}
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            )}
            <FieldErrors id={skillErrors.length ? `${form}-skills-error` : undefined} problems={skillErrors} />
          </fieldset>

          <ActionField
            form={form}
            name="eventId"
            label="Linked event (optional)"
            hint="Members see the opportunity with the event it helps."
            state={state}
            targets={VOLUNTEER_TARGETS}>
            {(control) => (
              <select {...control} defaultValue={values.eventId ?? ''} className={CONTROL}>
                <option value="">No linked event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.eventRef} · {event.titleEn}
                  </option>
                ))}
              </select>
            )}
          </ActionField>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{editing ? 'Save changes' : 'Save as draft'}</ActionSubmit>
        {editing ? null : <p className="text-sm text-muted">A draft reaches members only when you open it.</p>}
      </div>
    </form>
  );
}
