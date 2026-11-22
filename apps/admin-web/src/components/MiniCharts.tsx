import type { Accent } from '@/components/ModuleIcons';
import type { Locale } from '@/lib/i18n';

/** Bar colours, written out in full so Tailwind finds them. */
const BAR: Readonly<Record<Accent, string>> = {
  purple: 'bg-accent-purple',
  blue: 'bg-accent-blue',
  green: 'bg-accent-green',
  red: 'bg-accent-red',
  orange: 'bg-accent-orange',
  teal: 'bg-accent-teal',
  indigo: 'bg-accent-indigo',
  gold: 'bg-accent-gold',
  pink: 'bg-accent-pink',
};

export type Bar = { label: string; value: number | null; accent: Accent };

/**
 * Vertical bars for a few counts. A null count is a group too small to show (the API hides fewer
 * than 10 people), so it is drawn as an empty bar labelled "fewer than 10", never as a zero.
 */
export function BarChart({ bars, locale, caption }: { bars: readonly Bar[]; locale: Locale; caption: string }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value ?? 0));
  const hidden = locale === 'ta' ? '10க்குக் குறைவு' : 'fewer than 10';
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="flex h-48 items-end gap-3 border-b border-line px-1 sm:gap-6" role="list">
        {bars.map((bar) => (
          <div key={bar.label} role="listitem" className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-sm font-bold tabular-nums text-text" title={bar.value === null ? hidden : undefined}>
              {bar.value ?? '<10'}
            </span>
            <span
              aria-hidden="true"
              className={`w-full max-w-14 rounded-t-lg ${bar.value === null ? 'border-2 border-dashed border-line bg-surface' : BAR[bar.accent]}`}
              style={{ height: `${bar.value === null ? 12 : Math.max(4, Math.round((bar.value / max) * 100))}%` }}
            />
            <span className="sr-only">
              {bar.label}: {bar.value ?? hidden}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-1 sm:gap-6" aria-hidden="true">
        {bars.map((bar) => (
          <span key={bar.label} lang={locale} className="min-w-0 flex-1 text-center text-xs font-medium leading-snug text-muted">
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** A ring showing one share (0 to 1), with the percentage in the middle; null shows a dash. */
export function RingChart({ value, label, locale }: { value: number | null; label: string; locale: Locale }) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="12" className="stroke-surface" />
        {percent !== null ? (
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            className="stroke-accent-teal"
          />
        ) : null}
      </svg>
      <span className="-mt-[5.6rem] mb-12 text-2xl font-bold tabular-nums text-text">{percent === null ? '—' : `${percent}%`}</span>
      <figcaption lang={locale} className="text-center text-xs font-medium text-muted">
        {label}
        <span className="sr-only">: {percent === null ? (locale === 'ta' ? 'தரவு இல்லை' : 'no data') : `${percent}%`}</span>
      </figcaption>
    </figure>
  );
}
