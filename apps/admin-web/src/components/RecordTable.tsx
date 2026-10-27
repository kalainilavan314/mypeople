import Link from 'next/link';
import type { ReactNode } from 'react';

type Column<T> = { header: string; cell: (row: T) => ReactNode };

type Props<T> = {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  /** The first column links to the record. */
  href: (row: T) => string;
  linkText: (row: T) => string;
  rowKey: (row: T) => string;
  empty: string;
};

/** A queue table: the reference links to the record; nothing is decided from the list (FR-WEB-003). */
export function RecordTable<T>({ caption, rows, columns, href, linkText, rowKey, empty }: Props<T>) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-line text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2">
              Reference
            </th>
            {columns.map((column) => (
              <th key={column.header} scope="col" className="px-3 py-2">
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
              {columns.map((column) => (
                <td key={column.header} className="px-3 py-2">
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
