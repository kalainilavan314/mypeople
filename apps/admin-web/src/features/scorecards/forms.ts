import { text, type FormLike, type ProblemTargets } from '../../lib/formState.ts';

/** The refusal code the scorecards API uses, and the one the dashboard's own checks use too. */
export const SCORECARD_REFUSED = 'scorecard_refused';

type Words = { ta: string; en: string };

export const PERIOD = /^\d{4}-Q[1-4]$/;

export const SCORECARD_TARGETS: ProblemTargets = {
  period_invalid: 'period',
  period_not_finished: 'period',
  draft_exists: 'period',
  unknown_metric: 'metric',
  area_key_required: 'areaKey',
  area_not_on_scorecard: 'areaKey',
  reason_required: 'reason',
  decision_required: 'decision',
  decision_note_required: 'note',
  note_text_required: 'noteTa',
};

export const STATE_LABELS: Readonly<Record<'draft' | 'shared' | 'published' | 'superseded', Words>> = {
  draft: { ta: 'வரைவு', en: 'Draft' },
  shared: { ta: 'பொறுப்பான நிலைகளுடன் பகிரப்பட்டது', en: 'Shared for review' },
  published: { ta: 'வெளியிடப்பட்டது', en: 'Published' },
  superseded: { ta: 'புதிய பதிப்பால் மாற்றப்பட்டது', en: 'Replaced by a newer version' },
};

/** FR-ACS-002: the same figures for every GN, DS division and district. */
export const METRICS: readonly { key: string; label: Words; unit: 'count' | 'percent' | 'days' }[] = [
  { key: 'accepted', label: { ta: 'ஏற்கப்பட்ட விவகாரங்கள்', en: 'Accepted issues' }, unit: 'count' },
  { key: 'closed_with_evidence', label: { ta: 'சான்றுடன் மூடப்பட்டவை', en: 'Closed with evidence' }, unit: 'count' },
  { key: 'resolution_rate', label: { ta: 'தீர்வு வீதம்', en: 'Resolution rate' }, unit: 'percent' },
  { key: 'on_time_rate', label: { ta: 'உரிய நேரத்தில் தீர்ந்தவை', en: 'Resolved on time' }, unit: 'percent' },
  { key: 'currently_delayed', label: { ta: 'தற்போது தாமதமானவை', en: 'Currently delayed' }, unit: 'count' },
  { key: 'average_processing_days', label: { ta: 'சராசரிச் செயலாக்க நாட்கள்', en: 'Average processing time' }, unit: 'days' },
  { key: 'member_confirmed_rate', label: { ta: 'உறுப்பினர் உறுதிப்படுத்திய முடிவுகள்', en: 'Outcomes confirmed by members' }, unit: 'percent' },
  { key: 'reopen_rate', label: { ta: 'மீளத் திறக்கப்பட்ட வீதம்', en: 'Reopen rate' }, unit: 'percent' },
];

export type MetricValue = { key: string; value: number | null; numerator: number | null; denominator: number | null };
export type AreaFigures = { areaKey: string; insufficient: boolean; metrics: MetricValue[] };

const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const record = (value: unknown) => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});

/**
 * The API's figures ({areaKey: {insufficient} or {metrics}}) as rows: districts first, then DS
 * divisions, then GN divisions. An area under 10 accepted cases has no figures at all.
 */
export function readFigures(figures: Readonly<Record<string, unknown>>): AreaFigures[] {
  const order = (key: string) => ['district', 'ds', 'gn'].indexOf(key.split(':')[0]);
  return Object.entries(figures)
    .map(([areaKey, raw]) => {
      const entry = record(raw);
      const metrics = record(entry.metrics);
      return {
        areaKey,
        insufficient: entry.insufficient !== false,
        metrics: METRICS.map(({ key }) => {
          const value = record(metrics[key]);
          return { key, value: numberOrNull(value.value), numerator: numberOrNull(value.numerator), denominator: numberOrNull(value.denominator) };
        }),
      };
    })
    .sort((a, b) => order(a.areaKey) - order(b.areaKey) || a.areaKey.localeCompare(b.areaKey));
}

/**
 * A value with its parts: "62.5% (5 ÷ 8)", "14", "9 (of 14 accepted)", "6.2 days (over 9 closed cases)";
 * "—" when there is none (M20: the numerator and denominator go with every value that has them).
 */
export function metricText(metric: MetricValue): string {
  const unit = METRICS.find((m) => m.key === metric.key)?.unit ?? 'count';
  if (metric.value === null) return '—';
  if (unit === 'percent') return `${metric.value}% (${metric.numerator ?? 0} ÷ ${metric.denominator ?? 0})`;
  if (unit === 'days') return `${metric.value} days (over ${metric.denominator ?? 0} closed cases)`;
  if (metric.denominator !== null) return `${metric.value} (of ${metric.denominator} accepted)`;
  return String(metric.value);
}

/** An area's context note, in both languages, or null. */
export function noteFor(notes: Readonly<Record<string, unknown>>, areaKey: string): { en: string; ta: string } | null {
  const note = notes[areaKey];
  if (typeof note !== 'object' || note === null) return null;
  const { en, ta } = note as Record<string, unknown>;
  return { en: typeof en === 'string' ? en : '', ta: typeof ta === 'string' ? ta : '' };
}

/**
 * A quarter is finished when its last day has ended in Sri Lanka (UTC+05:30); the API refuses an
 * unfinished one as "period_not_finished".
 */
export function quarterFinished(period: string, now: Date): boolean {
  if (!PERIOD.test(period)) return false;
  const year = Number(period.slice(0, 4));
  const quarter = Number(period.slice(-1));
  const endUtc = Date.UTC(quarter === 4 ? year + 1 : year, quarter === 4 ? 0 : quarter * 3, 1) - (5 * 60 + 30) * 60 * 1000;
  return now.getTime() >= endUtc;
}

/** The last finished quarter, offered as the default ("2026-Q3" on 13 November 2026). */
export function lastFinishedQuarter(now: Date): string {
  const local = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  const quarter = Math.floor(local.getUTCMonth() / 3) + 1;
  return quarter === 1 ? `${local.getUTCFullYear() - 1}-Q4` : `${local.getUTCFullYear()}-Q${quarter - 1}`;
}

export function readPeriod(form: FormLike): { period: string | null; problems: string[] } {
  const period = text(form, 'period').toUpperCase();
  if (!PERIOD.test(period)) return { period: null, problems: ['period_invalid'] };
  return { period, problems: [] };
}

/** Accept or reject a correction; both need the note that explains the decision. */
export function readCorrectionDecision(form: FormLike): { input: { accept: boolean; note: string } | null; problems: string[] } {
  const choice = text(form, 'decision');
  const note = text(form, 'note');
  const problems = [...(choice === 'accept' || choice === 'reject' ? [] : ['decision_required']), ...(note.length >= 3 ? [] : ['decision_note_required'])];
  return problems.length ? { input: null, problems } : { input: { accept: choice === 'accept', note }, problems };
}
