import { ApiError, type SupportStatistics } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn } from '@/components/PageSection';
import { CATEGORY_LABELS, STATE_LABELS } from '@/features/support/forms';
import { SupportNav } from '@/features/support/SupportNav';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText } from '@/lib/format';
import { countText, countTextTa } from '@/lib/formState';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

/** FR-AST-012: counts only, by area, kind of help and state; any group under 10 shows as "fewer than 10". */
export default function SupportStatisticsPage() {
  return (
    <>
      <PageHeader ta="சமூக உதவிப் புள்ளிவிவரங்கள்" en="Community support statistics" />
      <SupportNav current="/support/statistics" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Statistics />
      </Suspense>
    </>
  );
}

async function Statistics() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  let statistics: SupportStatistics;
  try {
    statistics = await (await staffApi()).getSupportStatistics();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Community support" />;
    return <LoadFailure error={error} locale={locale} refused="Support statistics need an assistance permission." notFound="The statistics are not available." />;
  }
  const areaNames = await loadAreaNames(statistics.cells.map((cell) => cell.areaKey));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Counts only: no names, no cases. Any group from 1 to 9 shows as “fewer than 10” so that nobody can be singled out.
      </p>
      {statistics.cells.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">No support cases to count yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Support cases by area, kind of help and state</caption>
            <thead className="border-b border-line text-xs">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Area</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Kind of help</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">State</th>
                <th scope="col" className="px-3 py-2 font-semibold text-text">Cases</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {statistics.cells.map((cell, index) => (
                <tr key={`${cell.areaKey}-${cell.category}-${cell.state}-${index}`}>
                  <td className="px-3 py-2 text-text">{areaText(cell.areaKey, areaNames, 'en')}</td>
                  <td className="px-3 py-2"><BilingualText ta={CATEGORY_LABELS[cell.category].ta} en={CATEGORY_LABELS[cell.category].en} /></td>
                  <td className="px-3 py-2"><BilingualText ta={STATE_LABELS[cell.state]?.ta ?? cell.state} en={STATE_LABELS[cell.state]?.en ?? cell.state} /></td>
                  <td className="px-3 py-2 tabular-nums">
                    {cell.count === null ? (
                      <span className="flex flex-col text-xs text-muted">
                        <span lang="ta">{countTextTa(cell.count)}</span>
                        <span lang="en">{countText(cell.count)}</span>
                      </span>
                    ) : (
                      <span className="font-semibold text-text">{countText(cell.count)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
