'use client';

import { useActionState, useState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, CheckRow, FieldErrors, TEXTAREA, fieldId, problemsFor } from '@/components/ActionForm';
import { AreaPicker, type AreaOption } from '@/components/AreaPicker';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { recordIntake } from './actions';
import { CATEGORIES, CATEGORY_LABELS, SUPPORT_TARGETS } from './forms';

const FORM = 'intake';

/**
 * S11 on the web: a hotline call or a partner's referral. Nobody needs to be a member; consent to
 * collect the case details comes first (FR-AST-004). Nothing about membership, verification or
 * political support is asked or shown.
 */
export function IntakeForm({ areaOptions, partners }: { areaOptions: readonly AreaOption[]; partners: readonly { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(recordIntake, null);
  const values = state?.values ?? {};
  const [channel, setChannel] = useState(values.channel ?? 'hotline');
  const consentErrors = problemsFor(state, SUPPORT_TARGETS, 'consent');
  const channelErrors = problemsFor(state, SUPPORT_TARGETS, 'channel');

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-5">
      <ActionProblems
        form={FORM}
        state={state}
        targets={SUPPORT_TARGETS}
        fields={['consent', 'channel', 'partnerId', 'category', 'summary', 'fullName', 'phone', 'area']}
      />

      <div id={fieldId(FORM, 'consent')} tabIndex={-1} className="rounded-lg border border-warning bg-warning-bg p-3">
        <CheckRow
          name="consent"
          label="The caller agreed that we record these details to handle their request."
          hint="Ask first. Without consent, record nothing and give the emergency numbers if needed."
          defaultChecked={values.consent === '1'}
        />
        <FieldErrors id={consentErrors.length ? `${FORM}-consent-error` : undefined} problems={consentErrors} />
      </div>

      <fieldset id={fieldId(FORM, 'channel')} tabIndex={-1} className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">How the request came in *</legend>
        {[
          { value: 'hotline', label: 'Hotline call / உதவி அழைப்பு' },
          { value: 'partner', label: 'Referred by a partner organisation / பங்காளர் நிறுவனப் பரிந்துரை' },
        ].map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
            <input type="radio" name="channel" value={option.value} required defaultChecked={channel === option.value} onChange={() => setChannel(option.value)} className="size-5" />
            <span className="font-semibold">{option.label}</span>
          </label>
        ))}
        <FieldErrors id={channelErrors.length ? `${FORM}-channel-error` : undefined} problems={channelErrors} />
      </fieldset>

      {channel === 'partner' ? (
        <ActionField form={FORM} name="partnerId" label="Partner" required state={state} targets={SUPPORT_TARGETS}>
          {(control) => (
            <select {...control} required defaultValue={values.partnerId ?? ''} className={CONTROL}>
              <option value="">Choose the partner</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          )}
        </ActionField>
      ) : null}

      <CheckRow name="emergency" label="Emergency: needs help today" hint="Emergency cases are shown first in the queue." defaultChecked={values.emergency === '1'} />

      <div className="grid gap-4 md:grid-cols-2">
        <ActionField form={FORM} name="category" label="Kind of help" required state={state} targets={SUPPORT_TARGETS}>
          {(control) => (
            <select {...control} required defaultValue={values.category ?? ''} className={CONTROL}>
              <option value="">Choose the kind of help</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category].ta} · {CATEGORY_LABELS[category].en}
                </option>
              ))}
            </select>
          )}
        </ActionField>
        <ActionField form={FORM} name="fullName" label="Applicant's name" required state={state} targets={SUPPORT_TARGETS}>
          {(control) => <input {...control} required minLength={2} maxLength={120} autoComplete="off" defaultValue={values.fullName} className={CONTROL} />}
        </ActionField>
        <ActionField form={FORM} name="phone" label="Phone number (optional)" hint="Used only to reach the applicant about this request." state={state} targets={SUPPORT_TARGETS}>
          {(control) => <input {...control} type="tel" inputMode="tel" maxLength={16} autoComplete="off" defaultValue={values.phone} className={CONTROL} />}
        </ActionField>
        <ActionField
          form={FORM}
          name="household"
          label="Household (optional)"
          hint="Who lives with the applicant, for example: mother and two school children. Repeat requests are matched by the applicant's name or phone, never by this text."
          state={state}
          targets={SUPPORT_TARGETS}>
          {(control) => <input {...control} maxLength={120} defaultValue={values.household} className={CONTROL} />}
        </ActionField>
      </div>
      <ActionField form={FORM} name="summary" label="What help is needed" required state={state} targets={SUPPORT_TARGETS}>
        {(control) => <textarea {...control} required minLength={10} maxLength={3000} rows={4} defaultValue={values.summary} className={TEXTAREA} />}
      </ActionField>
      <AreaPicker form={FORM} options={areaOptions} initial={values.area || undefined} state={state} targets={SUPPORT_TARGETS} />

      <ActionSubmit>Record the request</ActionSubmit>
    </form>
  );
}
