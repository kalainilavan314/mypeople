'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { createProfile, updateProfile } from './actions';
import { APPOINTMENT_TARGETS, PROFILE_TEXT_FIELDS } from './forms';

const PAIRS = [
  { pair: 'role', en: 'Official role', hint: 'Such as District Coordinator.', long: false, min: 3, maxTa: 220, maxEn: 160 },
  { pair: 'displayName', en: 'Name shown to members', hint: undefined, long: false, min: 2, maxTa: 160, maxEn: 120 },
  { pair: 'officeHours', en: 'Office hours', hint: 'Members see these, with or without slots.', long: true, min: 3, maxTa: 700, maxEn: 500 },
] as const;

/**
 * D29: a representative's public role profile. A new one names the person by member ID and the
 * District, DS or GN division it covers; that never changes. Contact routes are optional and stay
 * hidden from members until the person approves them in their own calendar (BR-143, FR-APT-007).
 */
export function ProfileForm({ representativeId, current, areaOptions = [] }: { representativeId?: string; current?: Record<string, string>; areaOptions?: readonly AreaOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(representativeId ? updateProfile : createProfile, null);
  const form = representativeId ? 'edit-profile' : 'new-profile';
  const values = state?.values ?? current ?? {};

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={APPOINTMENT_TARGETS} fields={[...PROFILE_TEXT_FIELDS]} />
      {representativeId ? <input type="hidden" name="representativeId" value={representativeId} /> : null}

      {representativeId ? null : (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-base font-bold text-text">
            <span lang="ta">பிரதிநிதி</span> · The person and the area
          </legend>
          <ActionField
            form={form}
            name="memberCode"
            label="Member ID of the person holding the role"
            hint="Their profile can be published only once they hold the permission to manage their own calendar."
            required
            state={state}
            targets={APPOINTMENT_TARGETS}>
            {(control) => <input {...control} required minLength={3} maxLength={40} defaultValue={values.memberCode} className={`${CONTROL} font-mono`} />}
          </ActionField>
          <AreaPicker form={form} options={areaOptions} initial={values.area || undefined} state={state} targets={APPOINTMENT_TARGETS} />
          <p className="text-xs text-muted">A representative covers one District, DS division or GN division, not a province.</p>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">பொது விவரம்</span> · Public profile, in Tamil and English
        </legend>
        {PAIRS.map(({ pair, en, hint, long, min, maxTa, maxEn }) => (
          <div key={pair} className="grid gap-4 md:grid-cols-2">
            {(['Ta', 'En'] as const).map((suffix) => {
              const name = `${pair}${suffix}`;
              const lang = suffix === 'Ta' ? 'ta' : 'en';
              const max = suffix === 'Ta' ? maxTa : maxEn;
              return (
                <ActionField key={name} form={form} name={name} label={`${en}, in ${suffix === 'Ta' ? 'Tamil' : 'English'}`} hint={hint} required state={state} targets={APPOINTMENT_TARGETS}>
                  {(control) =>
                    long ? (
                      <textarea {...control} lang={lang} required minLength={min} maxLength={max} rows={2} defaultValue={values[name]} className={TEXTAREA} />
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
          <span lang="ta">தொடர்பு வழிகள்</span> · Contact routes (optional)
        </legend>
        <p className="text-sm text-muted">
          Official routes only: the office phone, an official e-mail address, the office address. Members see them only after the
          person approves them, and any change here asks them to approve again. Never enter a private address or phone number.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="publicPhone" label="Office phone" hint="For example 021 222 3344 or +94212223344." state={state} targets={APPOINTMENT_TARGETS}>
            {(control) => <input {...control} type="tel" maxLength={20} defaultValue={values.publicPhone} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="publicEmail" label="Official e-mail" state={state} targets={APPOINTMENT_TARGETS}>
            {(control) => <input {...control} type="email" maxLength={200} defaultValue={values.publicEmail} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="officeAddressTa" label="Office address, in Tamil" state={state} targets={APPOINTMENT_TARGETS}>
            {(control) => <textarea {...control} lang="ta" maxLength={450} rows={2} defaultValue={values.officeAddressTa} className={TEXTAREA} />}
          </ActionField>
          <ActionField form={form} name="officeAddressEn" label="Office address, in English" state={state} targets={APPOINTMENT_TARGETS}>
            {(control) => <textarea {...control} lang="en" maxLength={300} rows={2} defaultValue={values.officeAddressEn} className={TEXTAREA} />}
          </ActionField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{representativeId ? 'Save profile' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">Members see nothing until the profile is published.</p>
      </div>
    </form>
  );
}
