import type { CommunityReportSummary } from '@my-people/api-client';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { ConsolePagination } from '@/components/ConsolePagination';
import { PageHeader } from '@/components/PageHeader';
import { RecordTable } from '@/components/RecordTable';
import { StateTag } from '@/components/StateTag';
import { formatDateTime, words } from '@/lib/format';
import { getAdminLocale, getLocalizedMessage } from '@/lib/i18n';
import { CONSOLE_PAGE_SIZE, consolePage } from '@/lib/pagination';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

type SearchParams = Promise<{ page?: string | string[]; status?: string | string[] }>;
const REPORT_STATES = ['submitted', 'under_review', 'in_progress', 'resolved'] as const;

export default function ReportsPage(props: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader ta="சமூகப் புகார்கள்" en="Community reports" />
      <Suspense fallback={<ConsoleLoading rows={5} />}>
        <ReportsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ReportsContent({ searchParams }: { searchParams: SearchParams }) {
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const resolvedParams = await searchParams;
  const page = consolePage(resolvedParams.page);
  const rawStatus = Array.isArray(resolvedParams.status) ? resolvedParams.status[0] : resolvedParams.status;
  const reportStatus = REPORT_STATES.find((state) => state === rawStatus);

  let reports: CommunityReportSummary[] = [];
  let total = 0;

  try {
    const api = await staffApi();
    const result = await api.listCommunityReports({
      status: reportStatus,
      limit: CONSOLE_PAGE_SIZE + 1,
      offset: (page - 1) * CONSOLE_PAGE_SIZE,
    });
    reports = result.items;
    total = result.total;
  } catch (error) {
    if (isRefusal(error)) {
      return (
        <p className="rounded-lg border border-line bg-card p-5 text-sm text-error">
          ! {getLocalizedMessage(error.code, locale)}
        </p>
      );
    }
    throw error;
  }

  const hasMore = reports.length > CONSOLE_PAGE_SIZE;
  const pageReports = reports.slice(0, CONSOLE_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p>
          Citizen-submitted local issues and community concerns across your assigned areas.
        </p>
        <span className="text-xs">
          {total} total reports in scope
        </span>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-card p-4">
        <label className="flex min-w-52 flex-col gap-1 text-sm font-medium text-text">
          Report status
          <select name="status" defaultValue={reportStatus ?? ''} className="min-h-11 rounded-lg border border-line bg-surface px-3">
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          Apply filter
        </button>
      </form>

      <RecordTable
        caption="Community reports"
        locale={locale}
        rows={pageReports}
        rowKey={(report) => report.id}
        refHeader="Report ID"
        href={(report) => `/reports/${report.id}`}
        linkText={(report) => report.id.slice(0, 8).toUpperCase()}
        empty={
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted">
            <p className="text-sm font-semibold">
              No community reports found in your assigned areas.
            </p>
          </div>
        }
        columns={[
          {
            header: 'Status',
            cell: (report) => <StateTag state={report.status} />,
          },
          {
            header: 'Category',
            cell: (report) => (
              <span className="font-medium text-text">
                {words(report.category)}
              </span>
            ),
          },
          {
            header: 'Title',
            cell: (report) => (
              <span className="line-clamp-1 max-w-xs text-text">
                {report.title}
              </span>
            ),
          },
          {
            header: 'Priority',
            cell: (report) => (
              <span
                className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${
                  report.priority === 'high'
                    ? 'bg-error-bg text-error'
                    : report.priority === 'medium'
                    ? 'bg-warning-bg text-warning'
                    : 'bg-surface text-muted'
                }`}>
                {report.priority}
              </span>
            ),
          },
          {
            header: 'Submitted',
            cell: (report) => (
              <span className="text-xs text-muted">
                {formatDateTime(report.createdAt)}
              </span>
            ),
          },
        ]}
      />

      <ConsolePagination pathname="/reports" page={page} hasMore={hasMore} filters={{ status: reportStatus }} />
    </div>
  );
}
