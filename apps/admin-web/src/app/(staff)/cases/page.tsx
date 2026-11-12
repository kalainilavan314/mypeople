import { ApiError, type CaseList } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { ConsolePagination } from '@/components/ConsolePagination';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { RecordTable } from '@/components/RecordTable';
import { CaseStageTag, OverdueTag } from '@/features/cases/CaseStageTag';
import { CASE_STAGES, OPEN_STAGES, STAGE_LABELS, caseAreaKey, isCaseStage, type CaseStageCode } from '@/features/cases/stages';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { CONSOLE_PAGE_SIZE, consolePage } from '@/lib/pagination';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'Community cases need a case permission (collect, research, decide, plan, approve or implement) or content moderation.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The case queue (FR-WEB-022, FR-WEB-028): cases in the viewer's areas, overdue ones marked. */
export default function CasesPage(props: PageProps<'/cases'>) {
  return (
    <>
      <PageHeader ta="சமூக விவகாரங்கள்" en="Community cases" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <CaseQueue searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CaseQueue({ searchParams }: { searchParams: PageProps<'/cases'>['searchParams'] }) {
  // Read when the request comes in: API_URL may be set only on the running server.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const page = consolePage(query.page);
  const requestedStage = one(query.stage);
  const stage: CaseStageCode | undefined = isCaseStage(requestedStage) ? requestedStage : undefined;
  const mine = one(query.mine) === '1';
  const overdue = one(query.overdue) === '1';
  const closures = one(query.closures) === '1';
  const search = (one(query.q) ?? '').trim().slice(0, 60);
  // District closures are reviewed by the region and the executive (FR-WEB-022).
  const reviewsClosures = staff.assignments.some((assignment) => assignment.tier === '4' || assignment.tier === '5');

  let list: CaseList;
  try {
    list = await (await staffApi()).listCases({
      stage: stage ? [stage] : undefined,
      mine,
      overdue,
      districtClosures: closures,
      search: search || undefined,
      limit: CONSOLE_PAGE_SIZE + 1,
      offset: (page - 1) * CONSOLE_PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return (
        <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">
          Community cases are not switched on yet. Cases appear here once the community issues module is switched on.
        </p>
      );
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The case list is not available." />;
  }

  const hasMore = list.items.length > CONSOLE_PAGE_SIZE;
  const rows = list.items.slice(0, CONSOLE_PAGE_SIZE);
  const areaNames = await loadAreaNames(rows.map(caseAreaKey));
  const filters = {
    stage,
    mine: mine ? '1' : undefined,
    overdue: overdue ? '1' : undefined,
    closures: closures ? '1' : undefined,
    q: search || undefined,
  };
  const filtered = Boolean(stage || mine || overdue || closures || search);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p>Reports from the member app, from GN collection to closing. Overdue cases are marked.</p>
        <p>
          Reports sent from the older member web app stay in{' '}
          <Link href="/reports" className="font-semibold text-primary underline">
            Community reports
          </Link>
          .
        </p>
      </div>

      <section aria-labelledby="counts-heading" className="flex flex-col gap-2">
        <h2 id="counts-heading" className="text-sm font-semibold text-text">
          Cases in your areas by stage
        </h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/cases?overdue=1"
              aria-current={overdue && !stage ? 'page' : undefined}
              className={`flex min-h-11 flex-col rounded-lg border border-error bg-error-bg px-3 py-2 text-error ${FOCUS}`}>
              <span className="text-lg font-bold tabular-nums">{list.counts.overdue ?? 0}</span>
              <span className="text-xs font-semibold">
                <span lang="ta">காலம் கடந்தவை</span> · Overdue
              </span>
            </Link>
          </li>
          {CASE_STAGES.map((code) => (
            <li key={code}>
              <Link
                href={`/cases?stage=${code}`}
                aria-current={stage === code ? 'page' : undefined}
                className={`flex min-h-11 flex-col rounded-lg border px-3 py-2 ${FOCUS} ${
                  stage === code ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'
                }`}>
                <span className="text-lg font-bold tabular-nums">{list.counts[code] ?? 0}</span>
                <span lang="ta" className="text-xs font-semibold">
                  {STAGE_LABELS[code].ta}
                </span>
                <span className="text-xs text-muted">{STAGE_LABELS[code].en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label htmlFor="case-search" className="flex min-w-56 flex-col gap-1 text-sm font-semibold text-text">
          Case ID or title
          <input
            id="case-search"
            name="q"
            type="search"
            maxLength={60}
            defaultValue={search}
            className={`min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS}`}
          />
        </label>
        <label htmlFor="case-stage" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          Stage
          <select id="case-stage" name="stage" defaultValue={stage ?? ''} className={`min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS}`}>
            <option value="">All stages</option>
            {CASE_STAGES.map((code) => (
              <option key={code} value={code}>
                {STAGE_LABELS[code].en}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="sr-only">Show only</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5" />
            Mine
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-5" />
            Overdue
          </label>
          {reviewsClosures ? (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="closures" value="1" defaultChecked={closures} className="size-5" />
              District closures
            </label>
          ) : null}
        </fieldset>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS}`}>
          Apply filters
        </button>
        {filtered ? (
          <Link href="/cases" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
            Clear filters
          </Link>
        ) : null}
      </form>

      <p className="text-xs text-muted">
        {list.total} {list.total === 1 ? 'case matches' : 'cases match'}
        {closures ? ' · resolved at district level, for review' : ''}
      </p>

      <RecordTable
        caption="Community cases"
        locale={locale}
        rows={rows}
        rowKey={(item) => item.id}
        refHeader="Case ID"
        href={(item) => `/cases/${item.id}`}
        linkText={(item) => item.caseNumber}
        empty={filtered ? 'No cases match these filters.' : 'No cases in your areas yet.'}
        columns={[
          { header: 'Stage', cell: (item) => <CaseStageTag stage={item.stage} /> },
          {
            header: 'Title',
            cell: (item) => (
              <span className="flex flex-col">
                <span className="line-clamp-2 max-w-xs text-text">{item.title}</span>
                <span className="text-xs text-muted">{words(item.category)}</span>
              </span>
            ),
          },
          { header: 'Area', cell: (item) => <span className="text-text">{areaText(caseAreaKey(item), areaNames, 'en')}</span> },
          {
            header: 'Owner',
            cell: (item) =>
              item.ownerName ? (
                <span className="text-text">{item.ownerName}</span>
              ) : OPEN_STAGES.has(item.stage) ? (
                <span className="font-semibold text-warning">Unassigned</span>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
          {
            header: 'Stage due',
            cell: (item) => (
              <span className="flex flex-col gap-1">
                <span className="text-xs tabular-nums text-muted">{OPEN_STAGES.has(item.stage) ? formatDateTime(item.stageDueAt) : '—'}</span>
                {item.overdue ? <OverdueTag /> : null}
              </span>
            ),
          },
        ]}
      />

      <ConsolePagination pathname="/cases" page={page} hasMore={hasMore} filters={filters} />
    </div>
  );
}
