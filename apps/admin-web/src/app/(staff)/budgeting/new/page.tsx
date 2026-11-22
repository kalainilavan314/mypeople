import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { BackLink } from '@/components/PageSection';
import { CycleForm } from '@/features/budgeting/CycleForm';
import { MANAGE } from '@/features/budgeting/forms';
import { areaOptionsFor } from '@/lib/areas';
import { requireStaff } from '@/lib/staff';

/** D19: a new budgeting cycle, saved as a draft that members do not see until its rules are published. */
export default function NewBudgetCyclePage() {
  return (
    <>
      <BackLink href="/budgeting">Back to participatory budgeting</BackLink>
      <PageHeader ta="புதிய வரவுசெலவுச் சுழற்சி" en="New budgeting cycle" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewCycle />
      </Suspense>
    </>
  );
}

async function NewCycle() {
  await connection();
  const staff = await requireStaff();
  const areaOptions = await areaOptionsFor(staff.assignments, MANAGE);
  return (
    <div className="rounded-2xl border border-line bg-card shadow-card p-4 sm:p-6">
      <CycleForm areaOptions={areaOptions} />
    </div>
  );
}
