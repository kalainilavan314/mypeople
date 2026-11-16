import Link from 'next/link';
import type { ReactNode } from 'react';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** A page section with its heading in Tamil first and English under it. */
export function Section({ id, ta, en, intro, children }: { id: string; ta: string; en: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="flex flex-col text-lg font-bold text-text">
          <span lang="ta">{ta}</span>
          <span lang="en" className="text-sm font-semibold text-muted">
            {en}
          </span>
        </h2>
        {intro ? <div className="text-sm text-muted">{intro}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-text">{children}</dd>
    </div>
  );
}

/** Text written in both languages, Tamil first. */
export function Both({ ta, en }: { ta: string | null | undefined; en: string | null | undefined }) {
  return (
    <span className="flex flex-col gap-1">
      <span lang="ta" className="whitespace-pre-wrap text-text">
        {ta || '—'}
      </span>
      <span lang="en" className="whitespace-pre-wrap text-muted">
        {en || '—'}
      </span>
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
      ← {children}
    </Link>
  );
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
      {children}
    </Link>
  );
}

/** A module whose feature switch is off answers 404 "feature_unavailable"; the page says so plainly. */
export function NotSwitchedOn({ what }: { what: string }) {
  return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">{what} is not switched on yet.</p>;
}

export const FOCUS_RING = FOCUS;
