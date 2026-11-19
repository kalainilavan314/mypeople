import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { BackLink } from '@/components/PageSection';
import { ProfileForm } from '@/features/representatives/ProfileForm';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/** D29: a new representative profile, saved as a draft until it is published. */
export default function NewRepresentativePage() {
  return (
    <>
      <BackLink href="/representatives">Back to representatives</BackLink>
      <PageHeader ta="புதிய பிரதிநிதி விவரம்" en="New representative profile" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewProfile />
      </Suspense>
    </>
  );
}

async function NewProfile() {
  await connection();
  const staff = await requireStaff();
  if (!staff.permissions.has('appointment.profile.manage')) {
    const locale = await getAdminLocale(staff.member.language);
    return <PageProblem locale={locale} message="Creating representative profiles needs the permission to publish representative profiles." />;
  }
  const areaOptions = (await areaOptionsFor(staff.assignments, 'appointment.profile.manage')).filter((option) => !option.value.startsWith('province:'));
  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <ProfileForm areaOptions={areaOptions} />
    </div>
  );
}
