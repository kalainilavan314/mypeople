'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

type Props = {
  children: ReactNode;
  /** Another Server Action than the form's own, for a second button. */
  formAction?: (formData: FormData) => void | Promise<void>;
  tone?: 'primary' | 'secondary' | 'danger';
  name?: string;
  value?: string;
};

const TONES = {
  primary: 'bg-primary text-on-primary hover:opacity-90',
  secondary: 'border border-line bg-card text-primary hover:bg-surface',
  danger: 'border border-error bg-card text-error hover:bg-error-bg',
};

/** A real submit button that says it is working while the action runs (spec §3), keeping its width. */
export function SubmitButton({ children, formAction, tone = 'primary', name, value }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex min-h-12 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 ${TONES[tone]}`}>
      {pending ? 'Working…' : children}
    </button>
  );
}
