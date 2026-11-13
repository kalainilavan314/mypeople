/** The eight figures every area gets for a quarter, in the order shown (FR-ACS-001). */
export const METRICS = [
  'accepted',
  'closed_with_evidence',
  'resolution_rate',
  'on_time_rate',
  'currently_delayed',
  'average_processing_days',
  'member_confirmed_rate',
  'reopen_rate',
] as const;

export type MetricKey = (typeof METRICS)[number];

const RATES: ReadonlySet<MetricKey> = new Set(['resolution_rate', 'on_time_rate', 'member_confirmed_rate', 'reopen_rate']);

export type Metric = { value: number | null; numerator: number | null; denominator: number | null };

/** A period's figures: "insufficient" under 10 accepted cases, else each metric with its parts. */
export type Figures = { insufficient: true } | { insufficient: false; metrics: Partial<Record<MetricKey, Metric>> };

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The API's figures object, read defensively: anything unexpected counts as insufficient. */
export function readFigures(raw: Record<string, unknown>): Figures {
  const metrics = raw.metrics;
  if (raw.insufficient !== false || typeof metrics !== 'object' || metrics === null) return { insufficient: true };
  const read: Partial<Record<MetricKey, Metric>> = {};
  for (const key of METRICS) {
    const item = (metrics as Record<string, unknown>)[key];
    if (typeof item !== 'object' || item === null) continue;
    const parts = item as Record<string, unknown>;
    read[key] = {
      value: numberOrNull(parts.value),
      numerator: numberOrNull(parts.numerator),
      denominator: numberOrNull(parts.denominator),
    };
  }
  return { insufficient: false, metrics: read };
}

export function isRate(key: MetricKey): boolean {
  return RATES.has(key);
}
