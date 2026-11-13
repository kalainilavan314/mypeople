import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { BackLink } from '@/components/PageSection';
import { TownHallForm } from '@/features/townhalls/TownHallForm';
import { areaOptionsFor } from '@/lib/areas';
import { requireStaff } from '@/lib/staff';

export default function NewTownHallPage() {
  return (
    <>
      <BackLink href="/town-halls">Back to town halls</BackLink>
      <PageHeader ta="புதிய மக்கள் மன்ற அமர்வு" en="New town hall session" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewTownHall />
      </Suspense>
    </>
  );
}

async function NewTownHall() {
  await connection();
  const staff = await requireStaff();
  const areaOptions = await areaOptionsFor(staff.assignments, 'townhall.produce');
  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <TownHallForm areaOptions={areaOptions} />
    </div>
  );
}
