import Link from 'next/link';

import { ACCENT_TILE, getModuleIcon, moduleAccent, type Accent } from '@/components/ModuleIcons';
import type { Locale } from '@/lib/i18n';

export type StatCardProps = {
  href: string;
  title: string;
  count: number;
  countLabel: string;
  subtext: string;
  urgent?: boolean;
  urgentNotice?: string;
  /** Defaults to the colour of the module's sidebar section. */
  accent?: Accent;
  locale: Locale;
};

/** A work queue as a colourful card: icon tile, title, big count, and a badge when it needs action. */
export function StatCard({ href, title, count, countLabel, subtext, urgent, urgentNotice, accent, locale }: StatCardProps) {
  const needsAction = Boolean(urgent && count > 0);
  return (
    <Link
      href={href}
      className="group flex min-h-40 flex-col justify-between gap-4 rounded-2xl border border-line bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${ACCENT_TILE[accent ?? moduleAccent(href)]}`}>
          {/* The icons are plain SVG functions without state, so calling one is safe. */}
          {getModuleIcon(href.split('?')[0])({ className: 'h-6 w-6' })}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span lang={locale} className="text-sm font-semibold leading-snug text-text-secondary group-hover:text-primary">
            {title}
          </span>
          <span className="text-3xl font-bold tabular-nums text-text">{count}</span>
          <span lang={locale} className="text-xs text-muted">
            {countLabel}
          </span>
        </div>
        {needsAction ? (
          <span
            lang={locale}
            className="shrink-0 rounded-full bg-error-bg px-2.5 py-1 text-[11px] font-semibold text-error">
            {locale === 'ta' ? 'நடவடிக்கை தேவை' : 'Needs action'}
          </span>
        ) : null}
      </div>
      {urgentNotice ? (
        <p lang={locale} className="rounded-lg bg-error-bg px-3 py-1.5 text-xs font-medium text-error">
          ! {urgentNotice}
        </p>
      ) : null}
      <p lang={locale} className="border-t border-divider pt-3 text-xs leading-5 text-muted">
        {subtext}
      </p>
    </Link>
  );
}
