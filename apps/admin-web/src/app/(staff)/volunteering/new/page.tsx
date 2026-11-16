import { ApiError, type VolunteerAssignmentEvent, type VolunteerSkill } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { OpportunityForm } from '@/features/volunteering/OpportunityForm';
import { api } from '@/lib/api';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const REFUSED = 'Volunteering opportunities need the volunteer management permission (volunteers.manage).';

export default function NewOpportunityPage() {
  return (
    <>
      <Link href="/volunteering" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
        ← Back to volunteering opportunities
      </Link>
      <PageHeader ta="புதிய தன்னார்வ வாய்ப்பு" en="New volunteering opportunity" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewOpportunity />
      </Suspense>
    </>
  );
}

async function NewOpportunity() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const client = await staffApi();

  let skills: VolunteerSkill[];
  try {
    skills = (await client.getVolunteerSkills()).skills;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') {
      return <p className="rounded-xl border border-line bg-card p-6 text-sm text-muted">Volunteering is not switched on yet.</p>;
    }
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The skills list is not available." />;
  }
  // The event list only offers a link; without it the opportunity can still be saved on its own.
  let events: VolunteerAssignmentEvent[] = [];
  try {
    events = await client.listVolunteerAssignmentEvents();
  } catch {
    events = [];
  }
  const areaOptions = await areaOptionsFor(staff.assignments, 'volunteers.manage');

  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <OpportunityForm
        areaOptions={areaOptions}
        skills={skills}
        events={events.map((event) => ({ id: event.id, eventRef: event.eventRef, titleEn: event.titleEn }))}
      />
    </div>
  );
}
