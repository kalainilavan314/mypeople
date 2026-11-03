import type { ReactNode } from 'react';

type Props = {
  /** Tamil first, English directly below it. */
  ta: string;
  en: string;
  children?: ReactNode;
};

/** The page's one h1, with Tamil first and English directly below it. */
export function PageHeader({ ta, en, children }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="flex flex-col gap-0.5 text-2xl font-bold">
          <span lang="ta" className="text-2xl font-bold text-text">
            {ta}
          </span>
          <span lang="en" className="text-sm font-medium text-muted">
            {en}
          </span>
        </h1>
      </div>
      {children}
    </header>
  );
}
