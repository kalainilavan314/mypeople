'use client';

import type { ReactNode } from 'react';

import { useLocale } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';

type Props = {
  /** Tamil title */
  ta: string;
  /** English title */
  en: string;
  /** Optional override for locale */
  locale?: Locale;
  children?: ReactNode;
};

/**
 * The page's one h1, rendered cleanly in the active language (Priority 1 / Milestone 1).
 * Eliminates noisy stacked duplication while preserving type safety and accessibility.
 */
export function PageHeader({ ta, en, locale: propLocale, children }: Props) {
  const contextLocale = useLocale();
  const locale = propLocale ?? contextLocale;
  const title = locale === 'ta' ? ta : en;

  return (
    <header className="flex min-h-10 flex-wrap items-end justify-between gap-4">
      <h1 lang={locale} className="text-2xl font-semibold tracking-tight text-text">
        {title}
      </h1>
      {children}
    </header>
  );
}
