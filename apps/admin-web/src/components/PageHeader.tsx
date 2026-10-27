import type { ReactNode } from 'react';

type Props = {
  /** Tamil first, English under it, as everywhere in the product (CLAUDE.md). */
  ta: string;
  en: string;
  brd?: string;
  children?: ReactNode;
};

/** The page's one h1, with the screen's BRD reference and an optional action area. */
export function PageHeader({ ta, en, brd, children }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <p lang="ta" className="text-sm font-semibold text-muted">
          {ta}
        </p>
        <h1 className="text-2xl font-bold">{en}</h1>
        {brd ? <p className="text-xs text-muted">BRD {brd}</p> : null}
      </div>
      {children}
    </header>
  );
}
