import type { ElectionPeriod, ElectionPeriodState } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StateTag } from '@/components/StateTag';
import { areaKeyText, electionTypeText, silenceStatus, silenceText } from '@/features/elections/periods';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { en, getAdminLocale, getDictionary, ta } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'election.mode.manage';
const LIMIT = 200;
const FILTERS = {
  declared: ['declared'],
  ended: ['ended'],
  withdrawn: ['withdrawn'],
  all: ['declared', 'ended', 'withdrawn'],
} as const satisfies Record<string, readonly ElectionPeriodState[]>;
type Filter = keyof typeof FILTERS;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isFilter = (value: string | undefined): value is Filter => value !== undefined && Object.hasOwn(FILTERS, value);

export default function ElectionPeriodsPage(props: PageProps<'/elections'>) {
  return (
    <>
      <PageHeader ta={ta.elections.title} en={en.elections.title} />
      <Suspense fallback={<ConsoleLoading />}>
        <PeriodsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function PeriodsContent({ searchParams }: { searchParams: PageProps<'/elections'>['searchParams'] }) {
  // Everything below is read when the request comes in: API_URL may be set only on the running
  // server, and the silence marks depend on the current time.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = getDictionary(locale).elections;
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  const requested = one((await searchParams).state);
  const filter: Filter = isFilter(requested) ? requested : 'declared';

  let periods: ElectionPeriod[];
  try {
    periods = await (await staffApi()).listElectionPeriods({ states: FILTERS[filter], limit: LIMIT });
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={words.refused} notFound={words.notFound} />;
  }
  const now = new Date();

  const filterNames: Record<Filter, string> = {
    declared: words.filterDeclared,
    ended: words.filterEnded,
    withdrawn: words.filterWithdrawn,
    all: words.filterAll,
  };

  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>{words.subtitle}</p>
        <p lang={locale}>{words.noVoterData}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form role="search" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
          <label htmlFor="period-state" className="flex flex-col gap-1 text-sm font-semibold">
            <span lang={locale}>{words.filterLabel}</span>
            <select
              id="period-state"
              name="state"
              defaultValue={filter}
              className="min-h-11 rounded-lg border border-line bg-card px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {(Object.keys(FILTERS) as Filter[]).map((key) => (
                <option key={key} value={key}>
                  {filterNames[key]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span lang={locale}>{words.filterButton}</span>
          </button>
        </form>
        <Link
          href="/elections/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span lang={locale}>+ {words.declareButton}</span>
        </Link>
      </div>

      <p lang={locale} className="text-sm text-muted">
        {words.shownCount.replace('{count}', String(periods.length))}
      </p>
      {periods.length === LIMIT ? (
        <p lang={locale} className="text-sm text-warning">
          {words.limitNote.replace('{count}', String(LIMIT))}
        </p>
      ) : null}

      {periods.length === 0 ? (
        <p lang={locale} className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">
          {words.empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{words.tableCaption}</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colReference}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colStatus}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colElection}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colArea}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colPeriod}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colSilence}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colPollingDay}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {periods.map((period) => {
                const silence = silenceStatus(period, now);
                return (
                  <tr key={period.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/elections/${period.id}`}
                        className="inline-flex min-h-11 items-center font-mono font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {period.periodRef}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <StateTag state={period.state} />
                    </td>
                    <td className="px-3 py-2">
                      <p lang={locale} className="font-medium">
                        {locale === 'ta' ? period.titleTa : period.titleEn}
                      </p>
                      <p lang={locale} className="text-xs text-muted">
                        {electionTypeText(period.electionType, words)}
                      </p>
                    </td>
                    <td lang={locale} className="px-3 py-2">
                      {areaKeyText(period.areaKey, words)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDateTime(period.startsAt)} – {formatDateTime(period.endsAt)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <p>
                        {formatDateTime(period.silenceStartsAt)} – {formatDateTime(period.silenceEndsAt)}
                      </p>
                      <p
                        lang={locale}
                        className={`mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                          silence === 'active' ? 'bg-warning-bg text-warning' : 'bg-surface text-muted'
                        }`}>
                        {silence === 'active' ? <span aria-hidden="true">●</span> : null}
                        {silenceText(silence, words)}
                      </p>
                    </td>
                    <td className="px-3 py-2">{formatDate(period.pollingDay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
