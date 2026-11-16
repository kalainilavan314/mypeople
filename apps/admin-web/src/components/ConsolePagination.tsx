import Link from 'next/link';

type Props = {
  pathname: string;
  page: number;
  hasMore: boolean;
  filters?: Record<string, string | undefined>;
};

/** A bounded, keyboard-accessible pager that keeps the active console filters. */
export function ConsolePagination({ pathname, page, hasMore, filters = {} }: Props) {
  if (page === 1 && !hasMore) return null;

  function href(target: number): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set('page', String(target));
    const suffix = query.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  }

  return (
    <nav aria-label="List pages" className="flex items-center justify-between gap-4 border-t border-line pt-4 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-medium text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Previous
        </Link>
      ) : <span />}
      <span className="text-muted" aria-current="page">Page {page}</span>
      {hasMore && page < 4000 ? (
        <Link href={href(page + 1)} rel="next" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-medium text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Next
        </Link>
      ) : <span />}
    </nav>
  );
}
