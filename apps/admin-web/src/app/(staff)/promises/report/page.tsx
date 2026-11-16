import { ApiError, type PromiseReportRow, type PromiseStatus, type PromiseTheme } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';

import { BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn } from '@/components/PageSection';
import { STATUSES, STATUS_LABELS, THEME_LABELS } from '@/features/promises/forms';
import { totalsBy, type ReportTotal } from '@/features/promises/report';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

/** FR-PRM-010, D16: published promises counted per status, per area, per theme and per office, and all four together. */
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
  if (rows.length === 0) {
    return <p className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted">No promises to count yet.</p>;
  }
  // Statuses in the tracker's own order; the other totals largest first.
  const statusTotals = totalsBy(rows, (row) => row.status);
  const byStatus = STATUSES.flatMap((status) => statusTotals.filter((item) => item.key === status));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{total} published promises in your areas.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <TotalsTable
          ta="நிலைவாரியாக"
          en="Per status"
          heading="Status"
          totals={byStatus}
          label={(key) => <BilingualText ta={STATUS_LABELS[key as PromiseStatus].ta} en={STATUS_LABELS[key as PromiseStatus].en} />}
        />
        <TotalsTable
          ta="பகுதிவாரியாக"
          en="Per area"
          heading="Area"
          totals={totalsBy(rows, (row) => row.areaKey)}
          label={(key) => <BilingualText ta={areaText(key, areaNames, 'ta')} en={areaText(key, areaNames, 'en')} />}
        />
        <TotalsTable
          ta="கருப்பொருள்வாரியாக"
          en="Per theme"
          heading="Theme"
          totals={totalsBy(rows, (row) => row.theme)}
          label={(key) => <BilingualText ta={THEME_LABELS[key as PromiseTheme].ta} en={THEME_LABELS[key as PromiseTheme].en} />}
        />
        <TotalsTable
          ta="அலுவலகவாரியாக"
          en="Per office"
          heading="Office"
          totals={totalsBy(rows, (row) => row.officeEn)}
          label={(key) => <span className="text-text">{key}</span>}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="px-3 pt-3 text-left">
            <span className="flex flex-col font-semibold">
              <span lang="ta" className="text-text">அனைத்தும் சேர்த்து</span>
              <span lang="en" className="text-xs font-medium text-muted">By status, theme, office and area together</span>
            </span>
          </caption>
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
    </div>
  );
}

type TotalsProps = { ta: string; en: string; heading: string; totals: ReportTotal[]; label: (key: string) => ReactNode };

/** One way of adding the report up: a caption in Tamil and English, then each value with its count. */
function TotalsTable({ ta, en, heading, totals, label }: TotalsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <caption className="px-3 pt-3 text-left">
          <span className="flex flex-col font-semibold">
            <span lang="ta" className="text-text">{ta}</span>
            <span lang="en" className="text-xs font-medium text-muted">{en}</span>
          </span>
        </caption>
        <thead className="border-b border-line text-xs">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold text-text">{heading}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-text">Promises</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {totals.map((item) => (
            <tr key={item.key}>
              <th scope="row" className="px-3 py-2 text-left font-normal">{label(item.key)}</th>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-text">{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
