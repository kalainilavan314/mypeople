import type { PrivacyRegisterEntry, PrivacyRequest } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { StateTag } from '@/components/StateTag';
import { DueTag } from '@/features/privacy/DueTag';
import { dueStatus, kindText } from '@/features/privacy/register';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { en, getAdminLocale, getDictionary, ta } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'privacy.requests.handle';
const LIMIT = 500;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const FILTERS = {
  open: ['open'],
  completed: ['completed'],
  refused: ['refused'],
  all: ['open', 'completed', 'refused'],
} as const satisfies Record<string, readonly PrivacyRequest['state'][]>;
type Filter = keyof typeof FILTERS;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isFilter = (value: string | undefined): value is Filter => value !== undefined && Object.hasOwn(FILTERS, value);

export default function PrivacyRegisterPage(props: PageProps<'/privacy'>) {
  return (
    <>
      <PageHeader ta={ta.privacy.title} en={en.privacy.title} />
      <Suspense fallback={<ConsoleLoading />}>
        <RegisterContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function RegisterContent({ searchParams }: { searchParams: PageProps<'/privacy'>['searchParams'] }) {
  // Everything below is read when the request comes in: API_URL may be set only on the running
  // server, and the due-date marks depend on the current time.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = getDictionary(locale).privacy;
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  const requested = one((await searchParams).state);
  const filter: Filter = isFilter(requested) ? requested : 'open';

  let entries: PrivacyRegisterEntry[];
  let openEntries: PrivacyRegisterEntry[];
  try {
    const client = await staffApi();
    entries = await client.listPrivacyRegister({ states: FILTERS[filter], limit: LIMIT });
    // The overdue alert always counts open requests, whichever status is being looked at.
    openEntries =
      filter === 'open' || filter === 'all'
        ? entries.filter((entry) => entry.state === 'open')
        : await client.listPrivacyRegister({ states: ['open'], limit: LIMIT });
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={words.refused} notFound={words.notFound} />;
  }
  const now = new Date();
  const overdue = openEntries.filter((entry) => dueStatus(entry, now).kind === 'overdue').length;

  const filterNames: Record<Filter, string> = {
    open: words.filterOpen,
    completed: words.filterCompleted,
    refused: words.filterRefused,
    all: words.filterAll,
  };

  return (
    <>
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>{words.subtitle}</p>
        <p lang={locale}>{words.laterNote}</p>
      </div>

      {overdue > 0 ? (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-error bg-error-bg px-4 py-3 text-sm font-semibold text-error">
          <span aria-hidden="true">!</span>
          <p lang={locale}>{overdue === 1 ? words.overdueAlertOne : words.overdueAlertMany.replace('{count}', String(overdue))}</p>
        </div>
      ) : null}

      <form role="search" className="flex w-fit flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-3">
        <label htmlFor="request-state" className="flex flex-col gap-1 text-sm font-semibold">
          <span lang={locale}>{words.filterLabel}</span>
          <select id="request-state" name="state" defaultValue={filter} className={`min-h-11 rounded-lg border border-line bg-card px-3 ${FOCUS}`}>
            {(Object.keys(FILTERS) as Filter[]).map((key) => (
              <option key={key} value={key}>
                {filterNames[key]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary hover:bg-surface ${FOCUS}`}>
          <span lang={locale}>{words.filterButton}</span>
        </button>
      </form>

      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>{words.shownCount.replace('{count}', String(entries.length))}</p>
        <p lang={locale} className="text-xs">
          {words.dueDateNote}
        </p>
        {entries.length === LIMIT ? (
          <p lang={locale} className="text-warning">
            {words.limitNote.replace('{count}', String(LIMIT))}
          </p>
        ) : null}
      </div>

      {entries.length === 0 ? (
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
                <th scope="col" className="px-3 py-2 font-semibold">{words.colRequest}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colMember}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colReceived}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colDue}</th>
                <th scope="col" className="px-3 py-2 font-semibold">{words.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">
                    <Link href={`/privacy/${entry.id}`} className={`inline-flex min-h-11 items-center font-mono font-semibold text-primary underline ${FOCUS}`}>
                      {entry.requestRef}
                    </Link>
                  </td>
                  <td lang={locale} className="px-3 py-2">
                    {kindText(entry.kind, words)}
                  </td>
                  <td className="px-3 py-2 font-mono">{entry.memberCode}</td>
                  <td className="px-3 py-2">{formatDate(entry.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="block">{formatDate(entry.dueAt)}</span>
                    <DueTag status={dueStatus(entry, now)} words={words} locale={locale} />
                  </td>
                  <td className="px-3 py-2">
                    <StateTag state={entry.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
