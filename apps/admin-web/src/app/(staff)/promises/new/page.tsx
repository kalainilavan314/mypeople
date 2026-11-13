import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { BackLink } from '@/components/PageSection';
import { PromiseForm } from '@/features/promises/PromiseForm';
import { areaOptionsFor } from '@/lib/areas';
import { requireStaff } from '@/lib/staff';

export default function NewPromisePage() {
  return (
    <>
      <BackLink href="/promises">Back to the promise tracker</BackLink>
      <PageHeader ta="புதிய வாக்குறுதி" en="New promise" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewPromise />
      </Suspense>
    </>
  );
}

async function NewPromise() {
  await connection();
  const staff = await requireStaff();
  const areaOptions = await areaOptionsFor(staff.assignments, 'promise.edit');
  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <PromiseForm areaOptions={areaOptions} />
    </div>
  );
}
