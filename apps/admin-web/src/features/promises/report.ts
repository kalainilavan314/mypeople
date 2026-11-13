import type { PromiseReportRow } from '@my-people/api-client';

export type ReportTotal = { key: string; count: number };

/**
 * FR-PRM-010: the report's rows (status × theme × office × area) added up along one of them, largest
 * first, then by name, so each table reads the same way every time.
 */
export function totalsBy(rows: readonly PromiseReportRow[], pick: (row: PromiseReportRow) => string): ReportTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(pick(row), (totals.get(pick(row)) ?? 0) + row.count);
  return [...totals.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
