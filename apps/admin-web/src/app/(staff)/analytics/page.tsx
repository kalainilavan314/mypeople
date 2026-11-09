import type { AnalyticsPeriod, OperationsAnalytics } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { en, getAdminLocale, getDictionary, ta } from '@/lib/i18n';
import type { TranslationDictionary } from '@/lib/i18n/types';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'analytics.view'; // PRM-24
const PERIODS: readonly AnalyticsPeriod[] = [7, 30, 90];
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

type Words = TranslationDictionary['analytics'];
type Figure = { label: string; value: number | null; kind?: 'count' | 'rate' | 'hours' };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const asPeriod = (value: string | undefined): AnalyticsPeriod =>
  PERIODS.find((period) => String(period) === value) ?? 30;

/**
 * D32: registration, identity reviews, the review queue and event attendance for the viewer's
 * areas (MP-DEC-001 5.2). The API returns counts only and hides any group of 1 to 9 people, so
 * a hidden figure is written as "Hidden", never estimated here.
 */
export default function AnalyticsPage(props: PageProps<'/analytics'>) {
  return (
    <>
      <PageHeader ta={ta.analytics.title} en={en.analytics.title} />
      <Suspense fallback={<ConsoleLoading />}>
        <AnalyticsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function AnalyticsContent({ searchParams }: { searchParams: PageProps<'/analytics'>['searchParams'] }) {
  // Read when the request comes in: API_URL may be set only on the running server.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = getDictionary(locale).analytics;
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  const period = asPeriod(one((await searchParams).periodDays));
  let figures: OperationsAnalytics;
  try {
    figures = await (await staffApi()).getOperationsAnalytics(period);
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={words.refused} notFound={words.notFound} />;
  }

  const periodNames: Record<AnalyticsPeriod, string> = { 7: words.period7, 30: words.period30, 90: words.period90 };

  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>{words.subtitle}</p>
        <p lang={locale}>{figures.platformWide ? words.scopePlatform : words.scopeAreas}</p>
      </div>

      <form role="search" className="flex w-fit flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
        <label htmlFor="analytics-period" className="flex flex-col gap-1 text-sm font-semibold">
          <span lang={locale}>{words.periodLabel}</span>
          <select id="analytics-period" name="periodDays" defaultValue={String(period)} className={`min-h-11 rounded-lg border border-line bg-card px-3 ${FOCUS}`}>
            {PERIODS.map((value) => (
              <option key={value} value={value}>
                {periodNames[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary hover:bg-surface ${FOCUS}`}>
          <span lang={locale}>{words.periodButton}</span>
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <FigureCard
          title={words.registrationTitle}
          words={words}
          locale={locale}
          figures={[
            { label: words.started, value: figures.started },
            { label: words.submitted, value: figures.submitted },
            { label: words.verified, value: figures.verified },
            { label: words.active, value: figures.active },
            { label: words.completionRate, value: figures.completionRate, kind: 'rate' },
          ]}
        />
        <FigureCard
          title={words.verificationTitle}
          words={words}
          locale={locale}
          figures={[
            { label: words.decided, value: figures.decided },
            { label: words.medianWait, value: figures.medianHours, kind: 'hours' },
            { label: words.withinTarget, value: figures.withinTargetRate, kind: 'rate' },
          ]}
        />
        <FigureCard
          title={words.queueTitle}
          words={words}
          locale={locale}
          figures={[
            { label: words.waiting, value: figures.waiting },
            { label: words.overTarget, value: figures.overTarget },
          ]}
        />
        <FigureCard
          title={words.eventsTitle}
          words={words}
          locale={locale}
          figures={[
            { label: words.eventsHeld, value: figures.events },
            { label: words.going, value: figures.going },
            { label: words.attended, value: figures.attended },
            { label: words.attendanceRate, value: figures.attendanceRate, kind: 'rate' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted">
        <p lang={locale}>{words.hiddenNote}</p>
        <p lang={locale}>{words.generatedAt.replace('{time}', formatDateTime(figures.generatedAt))}</p>
      </div>
    </>
  );
}

function show(figure: Figure, words: Words): string {
  if (figure.value === null) return words.hidden;
  if (figure.kind === 'rate') return `${Math.round(figure.value * 100)}%`;
  if (figure.kind === 'hours') return `${figure.value} ${words.hoursUnit}`;
  return figure.value.toLocaleString('en-LK');
}

function FigureCard({ title, figures, words, locale }: { title: string; figures: Figure[]; words: Words; locale: string }) {
  return (
    <section className="rounded-xl border border-line bg-card p-4" aria-labelledby={`figures-${title}`}>
      <h2 id={`figures-${title}`} lang={locale} className="mb-3 text-base font-semibold">
        {title}
      </h2>
      <dl className="flex flex-col divide-y divide-line">
        {figures.map((figure) => (
          <div key={figure.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt lang={locale} className="text-sm text-muted">
              {figure.label}
            </dt>
            <dd lang={locale} className={figure.value === null ? 'text-sm italic text-muted' : 'text-lg font-semibold tabular-nums'}>
              {show(figure, words)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
