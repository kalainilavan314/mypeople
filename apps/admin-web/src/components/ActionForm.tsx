'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { CONTROL } from '@/components/FormField';
import { useLocale } from '@/lib/i18n/context';
import { type FormState, type ProblemTargets, targetOf } from '@/lib/formState';
import { bilingualMessageFor, bilingualProblemText } from '@/lib/messages';

// Several action forms share one page (an opportunity's offers, the moderation queue), so every
// control's id carries its form's name ("decide-1a2b-reason") and each form has its own error
// summary next to it, as on the case file.

export const TEXTAREA = `${CONTROL} py-2 leading-relaxed`;

type Control = { id: string; name: string; 'aria-invalid'?: true; 'aria-describedby'?: string };

export function fieldId(form: string, name: string): string {
  return `${form}-${name}`;
}

/** The problems of the last attempt that point at one field of the form. */
export function problemsFor(state: FormState, targets: ProblemTargets, name: string): string[] {
  return (state?.problems ?? []).filter((problem) => targetOf(targets, problem) === name);
}

type FieldProps = {
  form: string;
  name: string;
  /** The label in the staff member's language; Tamil and English fields each say which they are. */
  label: string;
  hint?: string;
  required?: boolean;
  state: FormState;
  targets: ProblemTargets;
  children: (control: Control) => ReactNode;
};

/** A labelled control with its hint and its own errors tied to it for screen readers (WCAG 1.3.1, 3.3.1). */
export function ActionField({ form, name, label, hint, required, state, targets, children }: FieldProps) {
  const locale = useLocale();
  const id = fieldId(form, name);
  const own = problemsFor(state, targets, name);
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

/** A field's own error lines, for groups (radios, checkboxes, builders) that are not one control. */
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

/**
 * This form's refusal, said next to it: the reason and every problem, each linked to its field.
 * Focus moves here on every refused attempt so it is announced. `linkFor` overrides the link of a
 * problem whose target is not a plain field (a question or lesson in a builder).
 */
export function ActionProblems({
  form,
  state,
  targets,
  fields,
  linkFor,
}: {
  form: string;
  state: FormState;
  targets: ProblemTargets;
  fields: readonly string[];
  linkFor?: (problem: string) => string | undefined;
}) {
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
            const target = targetOf(targets, problem);
            const href = linkFor?.(problem) ?? (target && fields.includes(target) ? `#${fieldId(form, target)}` : undefined);
            const label = (
              <span lang={locale} className="font-semibold">
                {locale === 'ta' ? words.ta : words.en}
              </span>
            );
            return (
              <li key={problem}>
                {href ? (
                  <a href={href} className="underline focus:rounded focus:outline-none focus:ring-1 focus:ring-error">
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

/** A submit button that says it is working while the action runs; a 48 px target. */
export function ActionSubmit({
  children,
  tone = 'primary',
  name,
  value,
  disabled,
  describedBy,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  name?: string;
  value?: string;
  disabled?: boolean;
  describedBy?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      aria-describedby={describedBy}
      className={`inline-flex min-h-12 w-fit items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${TONES[tone]}`}>
      {pending ? 'Working…' : children}
    </button>
  );
}

/** One action's box: its heading, a line on what it does, and the form. */
export function ActionCard({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  const locale = useLocale();
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 id={`${id}-heading`} lang={locale} className="text-base font-bold text-text">
          {title}
        </h3>
        {intro ? <div className="text-sm text-muted">{intro}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A checkbox with its label, a 44 px row. */
export function CheckRow({
  name,
  value = '1',
  label,
  hint,
  defaultChecked,
  checked,
  onChange,
  disabled,
  describedBy,
}: {
  name: string;
  value?: string;
  label: ReactNode;
  hint?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const controlled = checked !== undefined;
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-lg p-2 text-sm hover:bg-surface">
      <input
        type="checkbox"
        name={name}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        {...(controlled ? { checked } : { defaultChecked })}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="mt-0.5 size-5 shrink-0"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
