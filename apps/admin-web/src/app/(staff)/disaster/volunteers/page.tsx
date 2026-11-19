import { ApiError, type ReliefVolunteer } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn, Section } from '@/components/PageSection';
import { DisasterNav } from '@/features/disaster/DisasterNav';
import { RELIEF_TASK_LABELS } from '@/features/disaster/forms';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Relief volunteers are shown to relief coordinators (relief.logistics, PRM-54).';

/**
 * FR-DIS-004: members who offered relief help in the coordinator's areas and are still available. Names,
 * areas, tasks and dates only; never a phone number. Work is arranged through a volunteering opportunity.
 */
export default function ReliefVolunteersPage() {
  return (
    <>
      <PageHeader ta="நிவாரணத் தன்னார்வலர்கள்" en="Relief volunteers" />
      <DisasterNav current="/disaster/volunteers" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Volunteers />
      </Suspense>
    </>
  );
}

async function Volunteers() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  if (!staff.permissions.has('relief.logistics')) return <PageProblem locale={locale} message={REFUSED} />;
  let rows: ReliefVolunteer[];
  try {
    rows = await (await staffApi()).listReliefVolunteers();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Disaster alerts" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The relief volunteers are not available." />;
  }
  const areaNames = await loadAreaNames(rows.map((row) => row.areaKey));
  return (
    <Section
      id="volunteers"
      ta="கிடைக்கக்கூடியோர்"
      en={`Available now (${rows.length})`}
      intro="Ordered by name, never by how much anyone has done. To give someone a task, publish a volunteering opportunity in their area; they offer through the app, where you confirm the role and meeting point.">
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nobody in your areas has offered relief help yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {rows.map((row, index) => (
            <li key={`${row.fullName}-${index}`} className="flex flex-col gap-1 py-2">
              <span className="font-semibold text-text">{row.fullName}</span>
              <span className="text-xs text-muted">
                {areaText(row.areaKey, areaNames, 'en')} · until {formatDate(row.availableUntil)}
              </span>
              <span className="text-xs text-muted">{row.tasks.map((task) => RELIEF_TASK_LABELS[task]?.en ?? task).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
