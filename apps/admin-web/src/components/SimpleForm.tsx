'use client';

import { useActionState, useState } from 'react';

import { ActionCard, ActionField, ActionProblems, ActionSubmit, FieldErrors, TEXTAREA, fieldId, problemsFor } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState, ProblemTargets } from '@/lib/formState';

type Option = { value: string; label: string };

/** One control of a SimpleForm. Tamil fields come before their English pair. */
export type FieldSpec = {
  name: string;
  label: string;
  kind?: 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'select' | 'radio' | 'checkbox' | 'checks' | 'url';
  required?: boolean;
  lang?: 'ta' | 'en';
  hint?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  options?: readonly Option[];
  defaultValue?: string;
  /** Shown only while a radio or select of this form has one of these values. */
  showWhen?: { field: string; values: readonly string[] };
  /** Takes the whole row instead of half of it. */
  wide?: boolean;
  mono?: boolean;
};

export type SubmitSpec = { label: string; name?: string; value?: string; tone?: 'primary' | 'secondary' | 'danger'; showWhen?: FieldSpec['showWhen'] };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * A form for one Server Action, built from a list of fields: its own error summary beside it, each
 * field with its own errors, the values typed kept after a refusal, and fields that appear only for
 * one choice (a reason only to reject). Used for the many short staff actions of the Phase 2 pages.
 */
export function SimpleForm({
  id,
  action,
  hidden = {},
  fields,
  submits,
  targets,
  title,
  intro,
}: {
  id: string;
  action: Action;
  hidden?: Readonly<Record<string, string>>;
  fields: readonly FieldSpec[];
  submits: readonly SubmitSpec[];
  targets: ProblemTargets;
  /** With a title the form sits in its own card; without one it is placed as it is. */
  title?: string;
  intro?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, null);
  const form = (
    <form key={state?.attempt ?? 0} action={formAction} className="flex flex-col gap-3">
      <ActionProblems form={id} state={state} targets={targets} fields={fields.map((field) => field.name)} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Fields id={id} state={state} fields={fields} submits={submits} targets={targets} />
    </form>
  );
  if (!title) return form;
  return (
    <ActionCard id={id} title={title} intro={intro}>
      {form}
    </ActionCard>
  );
}

function Fields({
  id,
  state,
  fields,
  submits,
  targets,
}: {
  id: string;
  state: FormState;
  fields: readonly FieldSpec[];
  submits: readonly SubmitSpec[];
  targets: ProblemTargets;
}) {
  const values = state?.values ?? {};
  const choosers = fields.filter((field) => field.kind === 'radio' || field.kind === 'select');
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries(choosers.map((field) => [field.name, values[field.name] ?? field.defaultValue ?? ''])),
  );
  const visible = (rule?: FieldSpec['showWhen']) => !rule || rule.values.includes(chosen[rule.field] ?? '');
  const choose = (name: string, value: string) => setChosen((all) => ({ ...all, [name]: value }));

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.filter((field) => visible(field.showWhen)).map((field) => (
          <div key={field.name} className={field.wide || field.kind === 'textarea' || field.kind === 'radio' || field.kind === 'checks' ? 'md:col-span-2' : ''}>
            <Control id={id} field={field} state={state} targets={targets} value={values[field.name] ?? field.defaultValue} onChoose={choose} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {submits.filter((submit) => visible(submit.showWhen)).map((submit) => (
          <ActionSubmit key={`${submit.name ?? 'submit'}-${submit.value ?? submit.label}`} name={submit.name} value={submit.value} tone={submit.tone}>
            {submit.label}
          </ActionSubmit>
        ))}
      </div>
    </>
  );
}

function Control({
  id,
  field,
  state,
  targets,
  value,
  onChoose,
}: {
  id: string;
  field: FieldSpec;
  state: FormState;
  targets: ProblemTargets;
  value: string | undefined;
  onChoose: (name: string, value: string) => void;
}) {
  const kind = field.kind ?? 'text';
  if (kind === 'radio') {
    const errors = problemsFor(state, targets, field.name);
    return (
      <fieldset id={fieldId(id, field.name)} tabIndex={-1} className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">
          {field.label}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </legend>
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
            <input
              type="radio"
              name={field.name}
              value={option.value}
              required={field.required}
              defaultChecked={value === option.value}
              onChange={() => onChoose(field.name, option.value)}
              className="size-5"
            />
            <span className="font-semibold">{option.label}</span>
          </label>
        ))}
        <FieldErrors id={errors.length ? `${id}-${field.name}-error` : undefined} problems={errors} />
      </fieldset>
    );
  }
  if (kind === 'checks') {
    const errors = problemsFor(state, targets, field.name);
    return (
      <fieldset id={fieldId(id, field.name)} tabIndex={-1} className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">
          {field.label}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </legend>
        {field.hint ? <p className="text-xs text-muted">{field.hint}</p> : null}
        <div className="grid gap-1 sm:grid-cols-2">
          {(field.options ?? []).map((option) => (
            <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm hover:bg-surface">
              <input type="checkbox" name={field.name} value={option.value} className="size-5" />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <FieldErrors id={errors.length ? `${id}-${field.name}-error` : undefined} problems={errors} />
      </fieldset>
    );
  }
  if (kind === 'checkbox') {
    const errors = problemsFor(state, targets, field.name);
    return (
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
          <input
            id={fieldId(id, field.name)}
            type="checkbox"
            name={field.name}
            value="1"
            required={field.required}
            defaultChecked={value === '1'}
            aria-invalid={errors.length ? true : undefined}
            className="mt-0.5 size-5 shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">
              {field.label}
              {field.required ? <span aria-hidden="true"> *</span> : null}
            </span>
            {field.hint ? <span className="text-xs text-muted">{field.hint}</span> : null}
          </span>
        </label>
        <FieldErrors id={errors.length ? `${id}-${field.name}-error` : undefined} problems={errors} />
      </div>
    );
  }
  return (
    <ActionField form={id} name={field.name} label={field.label} hint={field.hint} required={field.required} state={state} targets={targets}>
      {(control) => {
        const common = {
          ...control,
          lang: field.lang,
          required: field.required,
          defaultValue: value,
          minLength: field.minLength,
          maxLength: field.maxLength,
        };
        if (kind === 'textarea') return <textarea {...common} rows={field.rows ?? 3} className={TEXTAREA} />;
        if (kind === 'select') {
          return (
            <select {...control} required={field.required} defaultValue={value ?? ''} onChange={(event) => onChoose(field.name, event.target.value)} className={CONTROL}>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        const type = kind === 'datetime' ? 'datetime-local' : kind === 'url' ? 'url' : kind;
        return (
          <input
            {...common}
            type={type}
            min={field.min}
            max={field.max}
            inputMode={kind === 'number' ? 'numeric' : undefined}
            pattern={kind === 'url' ? 'https://.*' : undefined}
            className={`${CONTROL} ${field.mono ? 'font-mono' : ''}`}
          />
        );
      }}
    </ActionField>
  );
}
