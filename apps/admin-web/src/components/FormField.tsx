import type { ReactNode } from 'react';

import type { Locale } from '@/lib/i18n/types';
import { bilingualProblemText, problemTargetField } from '@/lib/messages';

/** Shared look for text inputs, selects and text areas: a 48 px control with a visible focus outline. */
export const CONTROL =
  'min-h-12 w-full rounded-lg border border-line bg-card px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[invalid=true]:border-error';

type Control = {
  id: string;
  name: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
};

type Props = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Every problem code from the last attempt; the field shows the ones that point at it. */
  problems: readonly string[];
  locale: Locale;
  children: (control: Control) => ReactNode;
};

/**
 * A labelled control with its hint and its own error message tied to it for screen readers
 * (WCAG 1.3.1, 3.3.1). The id is the one the error summary in Feedback links to.
 */
export function FormField({ name, label, hint, required, problems, locale, children }: Props) {
  const id = `input-${name}`;
  const own = problems.filter((problem) => problemTargetField(problem) === name);
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
      {errorId ? (
        <ul id={errorId} className="flex flex-col gap-0.5 text-xs font-semibold text-error">
          {own.map((problem) => (
            <li key={problem} lang={locale}>
              ! {locale === 'ta' ? bilingualProblemText(problem).ta : bilingualProblemText(problem).en}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
