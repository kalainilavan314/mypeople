import { ApiError, type RosterPeriod } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'The election duty roster needs the roster permission (election.roster.manage).';

/**
 * S15 on the web: the declared election periods covering the coordinator's areas. A roster
 * coordinator does not need election mode management to reach the shifts of a period.
 */
export default function RosterPeriodsPage() {
  return (
    <Suspense fallback={<ConsoleLoading rows={4} />}>
      <RosterPeriods />
    </Suspense>
  );
}

async function RosterPeriods() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const header = <PageHeader ta="தேர்தல் பணிப் பட்டியல்" en="Election duty roster" />;
  let periods: RosterPeriod[];
  try {
    periods = await (await staffApi()).listRosterPeriods();
  } catch (error) {
    return (
      <>
        {header}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="The election duty roster" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The roster is not available." />
        )}
      </>
    );
  }
  const areaNames = await loadAreaNames(periods.map((period) => period.areaKey));

  return (
    <>
      {header}
      <p className="text-sm text-muted">
        Declared election periods that cover your areas. Open one to schedule duty shifts and offer them to Verified and Active members.
        Nothing here records how anyone votes.
      </p>
      <RecordTable
        caption="Declared election periods"
        locale={locale}
        rows={periods}
        rowKey={(period) => period.id}
        refHeader="Period"
        href={(period) => `/elections/${period.id}/roster`}
        linkText={(period) => period.periodRef}
        empty="No declared election period covers your areas."
        columns={[
          { header: 'Election', cell: (period) => <BilingualText ta={period.titleTa} en={period.titleEn} /> },
          { header: 'Area', cell: (period) => <span className="text-text">{areaText(period.areaKey, areaNames, 'en')}</span> },
          {
            header: 'Period',
            cell: (period) => (
              <span className="flex flex-col text-xs tabular-nums">
                <span className="text-text">from {formatDateTime(period.startsAt)}</span>
                <span className="text-muted">to {formatDateTime(period.endsAt)}</span>
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
