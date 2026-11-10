import type { CommunityReportSummary } from '@my-people/api-client';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/PageHeader';
import { StateTag } from '@/components/StateTag';
import { areaText, formatDateTime, words } from '@/lib/format';
import { staffApi } from '@/lib/session';
import { isRefusal, requireStaff } from '@/lib/staff';

export default function CommunityReportPage(props: PageProps<'/reports/[id]'>) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading report…</p>}>
      <CommunityReport params={props.params} />
    </Suspense>
  );
}

async function CommunityReport({ params }: Pick<PageProps<'/reports/[id]'>, 'params'>) {
  await requireStaff();
  const { id } = await params;
  let report: CommunityReportSummary;
  try {
    report = await (await staffApi()).getCommunityReport(id);
  } catch (error) {
    if (isRefusal(error)) {
      return (
        <div className="flex flex-col gap-4">
          <Link href="/reports" className="text-sm font-semibold text-primary underline">← Back to community reports</Link>
          <p className="rounded-lg border border-line bg-card p-5 text-sm text-error">This report is unavailable or outside your assigned area.</p>
        </div>
      );
    }
    throw error;
  }

  const location = report.gsCode
    ? `GN ${report.gsCode}`
    : report.dsCode
      ? `DS ${report.dsCode}`
      : report.districtCode
        ? `District ${report.districtCode}`
        : areaText((report.areaPath ?? []).at(-1) ?? 'platform');

  return (
    <>
      <Link href="/reports" className="text-sm font-semibold text-primary underline">← Back to community reports</Link>
      <PageHeader ta={report.title} en={report.title} locale="en" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <section aria-labelledby="report-description" className="rounded-lg border border-line bg-card p-6">
          <h2 id="report-description" className="text-base font-semibold text-text">Report description</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">{report.description}</p>
        </section>

        <aside aria-label="Report details" className="rounded-lg border border-line bg-card p-5">
          <dl className="grid gap-4 text-sm">
            <div><dt className="text-xs text-muted">Status</dt><dd className="mt-1"><StateTag state={report.status} /></dd></div>
            <div><dt className="text-xs text-muted">Priority</dt><dd className="mt-1 font-medium text-text">{words(report.priority)}</dd></div>
            <div><dt className="text-xs text-muted">Category</dt><dd className="mt-1 font-medium text-text">{words(report.category)}</dd></div>
            <div><dt className="text-xs text-muted">Area at submission</dt><dd className="mt-1 font-medium text-text">{location}</dd></div>
            <div><dt className="text-xs text-muted">Submitted</dt><dd className="mt-1 tabular-nums text-text">{formatDateTime(report.createdAt)}</dd></div>
            <div><dt className="text-xs text-muted">Report ID</dt><dd className="mt-1 font-mono text-xs text-text">{report.id}</dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}
