import { ApiError, type GuideEntryManaged, type GuideManagedReport } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { ButtonLink, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { SimpleForm } from '@/components/SimpleForm';
import { resolveGuideReport } from '@/features/livelihood/actions';
import { RESOLUTION_FIELDS } from '@/features/livelihood/fields';
import {
  CATEGORY_LABELS,
  EXPIRED_LABEL,
  GUIDE_TARGETS,
  REPORT_REASON_LABELS,
  REVERIFY_LABEL,
  STATES,
  STATE_LABELS,
  STATE_TONES,
  readFilter,
} from '@/features/livelihood/forms';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const CONTROL = `min-h-11 rounded-lg border border-line bg-card px-3 font-normal ${FOCUS_RING}`;
const REFUSED = 'The livelihood guide needs guide editing or guide review.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D28: guide entries by state with a search box, the expired entries, and members' reports of outdated entries. */
export default function LivelihoodPage(props: PageProps<'/livelihood'>) {
  return (
    <>
      <PageHeader ta="வாழ்வாதார வழிகாட்டி" en="Welfare, jobs and livelihood guide">
        <Suspense fallback={null}>
          <NewEntryLink />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <EntryList searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<ConsoleLoading rows={3} />}>
        <ReportQueue />
      </Suspense>
    </>
  );
}

async function NewEntryLink() {
  await connection();
  const staff = await requireStaff();
  return staff.permissions.has('guide.edit') ? <ButtonLink href="/livelihood/new">New entry</ButtonLink> : null;
}

async function EntryList({ searchParams }: { searchParams: PageProps<'/livelihood'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const filter = readFilter(one(query.state));
  const search = (one(query.q) ?? '').trim().slice(0, 80);

  let rows: GuideEntryManaged[];
  try {
    rows = await (await staffApi()).listManagedGuideEntries({
      state: filter === 'expired' ? undefined : filter,
      expired: filter === 'expired',
      q: search || undefined,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="The livelihood guide" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The guide entries are not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">
        Every entry is written in Tamil and English with its source link and dates. Editors save drafts, even incomplete ones; a
        second person reviews each entry before members see it, and an entry leaves the guide the day after its end date. The guide
        never says that someone qualifies.
      </p>
      <form role="search" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label htmlFor="guide-state" className="flex min-w-52 flex-col gap-1 text-sm font-semibold text-text">
          State
          <select id="guide-state" name="state" defaultValue={filter ?? ''} className={CONTROL}>
            <option value="">All entries</option>
            {STATES.map((code) => (
              <option key={code} value={code}>
                {STATE_LABELS[code].ta} · {STATE_LABELS[code].en}
              </option>
            ))}
            <option value="expired">
              {EXPIRED_LABEL.ta} · Expired entries
            </option>
          </select>
        </label>
        <label htmlFor="guide-search" className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-semibold text-text">
          Search in Tamil or English
          <input id="guide-search" name="q" type="search" maxLength={80} defaultValue={search} className={CONTROL} />
        </label>
        <button type="submit" className={`min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary ${FOCUS_RING}`}>
          Apply
        </button>
        {filter || search ? (
          <Link href="/livelihood" className={`inline-flex min-h-11 items-center text-sm font-semibold text-primary underline ${FOCUS_RING}`}>
            Clear
          </Link>
        ) : null}
      </form>
      <RecordTable
        caption="Livelihood guide entries"
        locale={locale}
        rows={rows}
        rowKey={(row) => row.id}
        refHeader="Reference"
        href={(row) => `/livelihood/${row.id}`}
        linkText={(row) => row.entryRef}
        empty={filter || search ? 'No entries match these filters.' : 'No guide entries yet. Start with “New entry”.'}
        columns={[
          {
            header: 'State',
            cell: (row) => (
              <span className="flex flex-col gap-1">
                <BilingualTag label={STATE_LABELS[row.state]} tone={STATE_TONES[row.state]} />
                {row.expired ? <BilingualTag label={EXPIRED_LABEL} tone="refused" /> : null}
                {row.needsReverification ? <BilingualTag label={REVERIFY_LABEL} tone="waiting" /> : null}
              </span>
            ),
          },
          { header: 'Entry', cell: (row) => <BilingualText ta={row.titleTa || '—'} en={row.titleEn || '(no English title yet)'} className="max-w-xs" /> },
          { header: 'Category', cell: (row) => <BilingualText ta={CATEGORY_LABELS[row.category].ta} en={CATEGORY_LABELS[row.category].en} /> },
          {
            header: 'Dates',
            cell: (row) => (
              <span className="flex flex-col text-xs tabular-nums text-muted">
                <span>checked {formatDate(row.verifiedOn)}</span>
                <span>{row.expiresOn ? `ends ${formatDate(row.expiresOn)}` : 'no end date'}</span>
              </span>
            ),
          },
          {
            header: 'Reports',
            cell: (row) =>
              row.openReports > 0 ? (
                <span className="text-xs font-semibold text-warning">{row.openReports} open</span>
              ) : (
                <span className="text-xs text-muted">none</span>
              ),
          },
        ]}
      />
    </div>
  );
}

/** FR-LIV-006: members' reports of outdated entries, oldest first. The reporter is never named. */
async function ReportQueue() {
  await connection();
  if (!api) return null;
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let reports: GuideManagedReport[];
  try {
    reports = await (await staffApi()).listGuideReports('open');
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return null;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The report queue is not available." />;
  }
  const canResolve = staff.permissions.has('guide.edit');
  return (
    <Section
      id="reports"
      ta="முறையிடப்பட்ட பதிவுகள்"
      en={`Reported entries (${reports.length})`}
      intro="Members report entries that look outdated. Check the entry against its source, correct it if needed (a change goes through review again), then mark the report fixed, or dismiss it with a reason. The member is told it was checked.">
      {reports.length === 0 ? (
        <p className="text-sm text-muted">No reports are waiting.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((report) => (
            <li key={report.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <Link href={`/livelihood/${report.entryId}`} className={`font-mono font-semibold text-primary underline ${FOCUS_RING}`}>
                  {report.entryRef}
                </Link>
                <BilingualTag label={REPORT_REASON_LABELS[report.reason]} tone="waiting" />
                <span className="text-xs tabular-nums text-muted">reported {formatDateTime(report.createdAt)}</span>
              </p>
              <BilingualText ta={report.entryTitleTa || '—'} en={report.entryTitleEn || '—'} />
              {report.note ? <p className="whitespace-pre-wrap text-text">“{report.note}”</p> : null}
              {canResolve ? (
                <SimpleForm
                  id={`report-${report.id.slice(0, 8)}`}
                  action={resolveGuideReport}
                  hidden={{ reportId: report.id, entryId: report.entryId, returnTo: 'list' }}
                  fields={RESOLUTION_FIELDS}
                  submits={[{ label: 'Record outcome' }]}
                  targets={GUIDE_TARGETS}
                />
              ) : (
                <p className="text-xs text-muted">An editor with guide editing resolves reports.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
