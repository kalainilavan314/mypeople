'use client';

import { useActionState } from 'react';

import { ActionField, ActionProblems, ActionSubmit, TEXTAREA } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState } from '@/lib/formState';

import { saveSource } from './actions';
import { KINDS, KIND_LABELS, SOURCE_TARGETS, SOURCE_TEXT_FIELDS } from './forms';

/**
 * D20, ENT-62: an approved source in Tamil, English or both, with who issued it and the next review
 * date. Saved as a draft; it is used by the assistant only after a second Knowledge Editor approves it.
 */
export function SourceForm({ sourceId, current }: { sourceId?: string; current: Record<string, string> }) {
  const [state, action] = useActionState<FormState, FormData>(saveSource, null);
  const form = sourceId ? 'edit-source' : 'new-source';
  const values = state?.values ?? current;

  return (
    <form key={state?.attempt ?? 0} action={action} className="flex flex-col gap-6">
      <ActionProblems form={form} state={state} targets={SOURCE_TARGETS} fields={[...SOURCE_TEXT_FIELDS]} />
      {sourceId ? <input type="hidden" name="sourceId" value={sourceId} /> : null}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">மூலம்</span> · The source
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="kind" label="Kind of source" hint="Only these four kinds may be used (FR-AIA-003)." required state={state} targets={SOURCE_TARGETS}>
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
          <ActionField form={form} name="publisher" label="Issued by" hint="For example: TMK central committee, Divisional Secretariat, Jaffna." required state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} required minLength={2} maxLength={200} defaultValue={values.publisher} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="titleTa" label="Title, in Tamil" required state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} lang="ta" required minLength={3} maxLength={300} defaultValue={values.titleTa} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="titleEn" label="Title, in English" required state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} lang="en" required minLength={3} maxLength={200} defaultValue={values.titleEn} className={CONTROL} />}
          </ActionField>
        </div>
        <ActionField
          form={form}
          name="bodyTa"
          label="Approved text, in Tamil"
          hint="Paste the text exactly as approved. The assistant quotes it word for word as official text. Leave empty if there is no Tamil version."
          state={state}
          targets={SOURCE_TARGETS}>
          {(control) => <textarea {...control} lang="ta" maxLength={60000} rows={10} defaultValue={values.bodyTa} className={TEXTAREA} />}
        </ActionField>
        <ActionField
          form={form}
          name="bodyEn"
          label="Approved text, in English"
          hint="Leave empty if there is no English version. At least one of the two texts is needed."
          state={state}
          targets={SOURCE_TARGETS}>
          {(control) => <textarea {...control} lang="en" maxLength={40000} rows={10} defaultValue={values.bodyEn} className={TEXTAREA} />}
        </ActionField>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-6">
        <legend className="mb-2 text-base font-bold text-text">
          <span lang="ta">வெளியீடும் மீளாய்வும்</span> · Publication and review
        </legend>
        <div className="grid gap-4 md:grid-cols-2">
          <ActionField form={form} name="sourceUrl" label="Link to the published source (optional)" hint="Starts with https://" state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} type="url" maxLength={500} pattern="https://.*" defaultValue={values.sourceUrl} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="publishedOn" label="Date it was published (optional)" state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} type="date" defaultValue={values.publishedOn} className={CONTROL} />}
          </ActionField>
          <ActionField
            form={form}
            name="reviewDue"
            label="Next review date"
            hint="After this date the assistant stops using the source until someone reviews it again. At most two years ahead."
            required
            state={state}
            targets={SOURCE_TARGETS}>
            {(control) => <input {...control} type="date" required defaultValue={values.reviewDue} className={CONTROL} />}
          </ActionField>
          <ActionField form={form} name="changeNote" label="What changed in this version (optional)" state={state} targets={SOURCE_TARGETS}>
            {(control) => <input {...control} maxLength={1000} defaultValue={values.changeNote} className={CONTROL} />}
          </ActionField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <ActionSubmit>{sourceId ? 'Save draft' : 'Save as draft'}</ActionSubmit>
        <p className="text-sm text-muted">The assistant uses a source only after a second Knowledge Editor approves it.</p>
      </div>
    </form>
  );
}
