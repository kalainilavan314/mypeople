import { ApiError, type PromiseReportRow } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn } from '@/components/PageSection';
import { STATUS_LABELS, THEME_LABELS } from '@/features/promises/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

/** FR-PRM-010: published promises counted by status, theme, office and area. */
export default function PromiseReportPage() {
  return (
    <>
      <BackLink href="/promises">Back to the promise tracker</BackLink>
      <PageHeader ta="வாக்குறுதி முன்னேற்ற அறிக்கை" en="Promise progress report" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Report />
      </Suspense>
    </>
  );
}

async function Report() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let rows: PromiseReportRow[];
  try {
    rows = await (await staffApi()).getPromiseReport();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="The promise tracker" />;
    return <LoadFailure error={error} locale={locale} refused="The progress report needs a promise permission." notFound="The progress report is not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{total} promises in your areas, counted by status, theme, office and area.</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">No promises to count yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Promises by status, theme, office and area</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Status</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Theme</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Office</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Area</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Promises</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <tr key={`${row.status}-${row.theme}-${row.areaKey}-${index}`}>
                  <td className="px-3 py-2"><BilingualText ta={STATUS_LABELS[row.status].ta} en={STATUS_LABELS[row.status].en} /></td>
                  <td className="px-3 py-2"><BilingualText ta={THEME_LABELS[row.theme].ta} en={THEME_LABELS[row.theme].en} /></td>
                  <td className="px-3 py-2 text-text">{row.officeEn}</td>
                  <td className="px-3 py-2 text-text">{areaText(row.areaKey, areaNames, 'en')}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums text-text">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
