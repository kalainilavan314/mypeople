'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ACCENT_TILE, getModuleIcon, moduleAccent } from '@/components/ModuleIcons';

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
  // The module's icon in its sidebar colour, so every page shows where you are at a glance.
  const section = '/' + (usePathname().split('/')[1] ?? '');

  return (
    <header className="flex min-h-10 flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-card ${ACCENT_TILE[moduleAccent(section)]}`}>
          {/* The icons are plain SVG functions without state, so calling one is safe. */}
          {getModuleIcon(section)({ className: 'h-6 w-6' })}
        </span>
        <h1 lang={locale} className="text-2xl font-semibold tracking-tight text-text">
          {title}
        </h1>
      </div>
      {children}
    </header>
  );
}
