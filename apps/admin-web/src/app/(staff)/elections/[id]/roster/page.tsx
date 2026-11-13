import { ApiError, type RosterShift } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag, BilingualText } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn } from '@/components/PageSection';
import { RecordTable } from '@/components/RecordTable';
import { ShiftForm } from '@/features/elections/ShiftForm';
import { api } from '@/lib/api';
import { areaOptionsFor, loadAreaNames } from '@/lib/areas';
import { areaText, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const REFUSED = 'The election duty roster needs the roster permission (election.roster.manage).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FR-ELX-006: the duty shifts of one election period, and a new shift. */
export default function RosterPage(props: PageProps<'/elections/[id]/roster'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={6} />}>
      <Roster params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Roster({ params, searchParams }: Pick<PageProps<'/elections/[id]/roster'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const header = (
    <>
      <BackLink href={UUID.test(id) ? `/elections/${id}` : '/elections'}>Back to the election period</BackLink>
      <PageHeader ta="தேர்தல் பணிப் பட்டியல்" en="Election duty roster" />
    </>
  );
  if (!UUID.test(id)) {
    return (
      <>
        {header}
        <PageProblem locale={locale} message="This election period does not exist." />
      </>
    );
  }
  let shifts: RosterShift[];
  try {
    shifts = await (await staffApi()).listRosterShifts(id);
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
  const areaNames = await loadAreaNames(shifts.map((shift) => shift.areaKey));
  const areaOptions = await areaOptionsFor(staff.assignments, 'election.roster.manage');

  return (
    <>
      {header}
      <Feedback done={one(query.done)} />
      <p className="text-sm text-muted">Shifts in your areas for this period. A shift can be made only while the period is declared, inside its election area.</p>
      <RecordTable
        caption="Duty shifts"
        locale={locale}
        rows={shifts}
        rowKey={(shift) => shift.id}
        refHeader="Shift"
        href={(shift) => `/elections/${id}/roster/${shift.id}`}
        linkText={(shift) => formatDateTime(shift.startsAt)}
        empty="No shifts for this period yet."
        columns={[
          { header: 'State', cell: (shift) => <BilingualTag label={shift.state === 'open' ? { ta: 'திறந்துள்ளது', en: 'Open' } : { ta: 'இரத்து செய்யப்பட்டது', en: 'Cancelled' }} tone={shift.state === 'open' ? 'waiting' : 'neutral'} /> },
          { header: 'Role', cell: (shift) => <BilingualText ta={shift.roleTa} en={shift.roleEn} /> },
          { header: 'Site', cell: (shift) => <BilingualText ta={shift.siteTa} en={shift.siteEn} /> },
          { header: 'Area', cell: (shift) => <span className="text-text">{areaText(shift.areaKey, areaNames, 'en')}</span> },
          { header: 'Places', cell: (shift) => <span className="flex flex-col text-xs tabular-nums"><span className="text-text">{shift.accepted} of {shift.places} accepted</span><span className="text-muted">{shift.offered} offered</span></span> },
        ]}
      />
      <ShiftForm periodId={id} areaOptions={areaOptions} />
    </>
  );
}
