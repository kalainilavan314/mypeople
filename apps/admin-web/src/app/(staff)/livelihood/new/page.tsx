import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { BackLink } from '@/components/PageSection';
import { EntryForm } from '@/features/livelihood/EntryForm';
import { getAdminLocale } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/** D28: a new guide entry, saved as a draft (incomplete is fine) until a second person reviews it. */
export default function NewGuideEntryPage() {
  return (
    <>
      <BackLink href="/livelihood">Back to the livelihood guide</BackLink>
      <PageHeader ta="புதிய வழிகாட்டிப் பதிவு" en="New guide entry" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewEntry />
      </Suspense>
    </>
  );
}

async function NewEntry() {
  await connection();
  const staff = await requireStaff();
  if (!staff.permissions.has('guide.edit')) {
    const locale = await getAdminLocale(staff.member.language);
    return <PageProblem locale={locale} message="Writing guide entries needs guide editing." />;
  }
  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <EntryForm />
    </div>
  );
}
