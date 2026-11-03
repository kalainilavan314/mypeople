'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useLocale } from '@/lib/i18n/context';

export type Column<T> = { header: ReactNode; cell: (row: T) => ReactNode };

type Props<T> = {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  /** The first column links to the record. */
  href: (row: T) => string;
  linkText: (row: T) => string;
  rowKey: (row: T) => string;
  empty: ReactNode | string;
  refHeader?: ReactNode;
};

/** A queue table: the reference links to the record; nothing is decided from the list. */
export function RecordTable<T>({ caption, rows, columns, href, linkText, rowKey, empty, refHeader }: Props<T>) {
  const locale = useLocale();

  if (rows.length === 0) {
    if (typeof empty === 'string') {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-card p-8 text-center text-muted">
          <p className="text-sm font-medium">{empty}</p>
        </div>
      );
    }
    return <div className="rounded-xl border border-line bg-card p-8">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">
              {refHeader ?? (
                <span lang={locale} className="font-semibold text-text">
                  {locale === 'ta' ? 'குறிப்பு எண்' : 'Reference'}
                </span>
              )}
            </th>
            {columns.map((column, idx) => (
              <th key={idx} scope="col" className="px-3 py-2 font-semibold text-text">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              <td className="px-3 py-2">
                <Link href={href(row)} className="font-mono font-semibold text-primary underline">
                  {linkText(row)}
                </Link>
              </td>
              {columns.map((column, idx) => (
                <td key={idx} className="px-3 py-2">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
