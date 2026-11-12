'use client';

import type { CaseOwnerOption } from '@my-people/api-client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { CONTROL } from '@/components/FormField';
import { useLocale } from '@/lib/i18n/context';
import { bilingualMessageFor, bilingualProblemText } from '@/lib/messages';

import type { CaseFormState } from './forms';

// The case file shows several action forms on one page, so every control's id carries its form's
// name ("forward-ownerId") and each form has its own error summary next to it.

/** The field each refusal reason points at; the summary links to it and the field repeats it. */
export const PROBLEM_FIELDS: Readonly<Record<string, string>> = {
  completeness_check_incomplete: 'checklist',
  owner_required: 'ownerId',
  owner_not_eligible: 'ownerId',
  already_owner: 'ownerId',
  district_owner_required: 'districtOwnerId',
  regional_owner_required: 'regionalOwnerId',
  recommendation_required: 'recommendation',
  authority_required: 'authority',
  resources_required: 'resources',
  office_required: 'office',
  due_date_required: 'dueDate',
  due_date_in_past: 'dueDate',
  reason_and_decision_required: 'reason',
  conditions_and_implementer_required: 'conditions',
  scope_and_due_date_required: 'scope',
  reporting_duty_required: 'reportingDuty',
  question_required: 'question',
  reason_required: 'reason',
  evidence_required: 'evidenceRefs',
  bilingual_summary_required: 'summaryTa',
  stage_required: 'stage',
  parent_not_found: 'parentCaseNumber',
  parent_not_open: 'parentCaseNumber',
  cannot_link_to_itself: 'parentCaseNumber',
  source_required: 'source',
  finding_kind_required: 'kind',
  responsible_tier_required: 'responsibleTier',
  photo_not_found: 'photos',
  too_many_photos: 'photos',
  decision_required: 'decision',
};

export const TEXTAREA = `${CONTROL} py-2 leading-relaxed`;

type Control = { id: string; name: string; 'aria-invalid'?: true; 'aria-describedby'?: string };

type FieldProps = {
  form: string;
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  state: CaseFormState;
  /** Problem codes this field shows, when they are not the ones PROBLEM_FIELDS points here. */
  codes?: readonly string[];
  children: (control: Control) => ReactNode;
};

export function fieldId(form: string, name: string): string {
  return `${form}-${name}`;
}

/** A labelled control with its hint and its own errors tied to it for screen readers (WCAG 1.3.1, 3.3.1). */
export function CaseField({ form, name, label, hint, required, state, codes, children }: FieldProps) {
  const locale = useLocale();
  const id = fieldId(form, name);
  const own = (state?.problems ?? []).filter((problem) => (codes ? codes.includes(problem) : PROBLEM_FIELDS[problem] === name));
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = own.length > 0 ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        <span lang={locale}>{label}</span>
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {hint ? (
        <p id={hintId} lang={locale} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, name, 'aria-invalid': own.length > 0 ? true : undefined, 'aria-describedby': describedBy })}
      <FieldErrors id={errorId} problems={own} />
    </div>
  );
}

/** A field's own error lines, for groups (radios, checkboxes) that are not a single control. */
export function FieldErrors({ id, problems }: { id: string | undefined; problems: readonly string[] }) {
  const locale = useLocale();
  if (!id || problems.length === 0) return null;
  return (
    <ul id={id} className="flex flex-col gap-0.5 text-xs font-semibold text-error">
      {problems.map((problem) => (
        <li key={problem} lang={locale}>
          ! {locale === 'ta' ? bilingualProblemText(problem).ta : bilingualProblemText(problem).en}
        </li>
      ))}
    </ul>
  );
}

/** The problems of the last attempt that point at one field of the form. */
export function problemsFor(state: CaseFormState, name: string): string[] {
  return (state?.problems ?? []).filter((problem) => PROBLEM_FIELDS[problem] === name);
}

/**
 * This form's refusal, said next to it: the reason and every problem, each linked to its field.
 * Focus moves here on every refused attempt so it is announced.
 */
export function CaseFormProblems({ form, state, fields }: { form: string; state: CaseFormState; fields: readonly string[] }) {
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const attempt = state?.attempt;

  useEffect(() => {
    if (attempt) ref.current?.focus();
  }, [attempt]);

  if (!state?.error) return null;
  const message = bilingualMessageFor(state.error);
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="flex flex-col gap-2 rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error outline-none focus:ring-2 focus:ring-error">
      <p lang={locale} className="font-semibold">
        ! {locale === 'ta' ? message.ta : message.en}
      </p>
      {state.problems.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-xs">
          {state.problems.map((problem) => {
            const words = bilingualProblemText(problem);
            const target = PROBLEM_FIELDS[problem];
            const label = <span lang={locale} className="font-semibold">{locale === 'ta' ? words.ta : words.en}</span>;
            return (
              <li key={problem}>
                {target && fields.includes(target) ? (
                  <a href={`#${fieldId(form, target)}`} className="underline focus:rounded focus:outline-none focus:ring-1 focus:ring-error">
                    {label}
                  </a>
                ) : (
                  label
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const TONES = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'border border-line bg-card text-primary hover:bg-surface',
  danger: 'border border-error bg-card text-error hover:bg-error-bg',
};

/**
 * A submit button that says it is working while the action runs, and can wait for the form to be
 * complete (FR-WEB-017, FR-WEB-026); `describedBy` names the text that says what is missing.
 */
export function CaseSubmit({
  children,
  ready = true,
  describedBy,
  tone = 'primary',
  name,
  value,
}: {
  children: ReactNode;
  ready?: boolean;
  describedBy?: string;
  tone?: keyof typeof TONES;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || !ready}
      aria-busy={pending}
      aria-describedby={describedBy}
      className={`inline-flex min-h-12 w-fit items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]}`}>
      {pending ? 'Working…' : children}
    </button>
  );
}

/** The people who may take the next step, from the API; an empty list says so instead of offering nothing. */
export function OwnerSelect({
  control,
  options,
  defaultValue,
  value,
  onChange,
}: {
  control: Control;
  options: readonly CaseOwnerOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (memberId: string) => void;
}) {
  const controlled = value !== undefined;
  return (
    <>
      <select
        {...control}
        required
        disabled={options.length === 0}
        {...(controlled ? { value } : { defaultValue: defaultValue ?? '' })}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={CONTROL}>
        <option value="">Choose a person</option>
        {options.map((option) => (
          <option key={option.memberId} value={option.memberId}>
            {option.fullName} · Tier {option.tier}
          </option>
        ))}
      </select>
      {options.length === 0 ? (
        <p className="text-xs text-muted">No one in this case&rsquo;s area holds this permission yet, so no owner can be named.</p>
      ) : null}
    </>
  );
}

/** One action's box: its heading, a line on what it does, and the form. */
export function ActionCard({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  const locale = useLocale();
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-heading`} lang={locale} className="text-base font-bold text-text">
          {title}
        </h3>
        {intro ? (
          <p lang={locale} className="text-sm text-muted">
            {intro}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
