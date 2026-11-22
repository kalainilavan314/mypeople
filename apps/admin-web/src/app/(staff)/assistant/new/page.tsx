import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { BackLink } from '@/components/PageSection';
import { defaultReviewDue, KNOWLEDGE_PERMISSION, KNOWLEDGE_REFUSED } from '@/features/assistant/forms';
import { SourceForm } from '@/features/assistant/SourceForm';
import { api } from '@/lib/api';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/** D20: a new approved source, saved as a draft for a second Knowledge Editor to approve. */
export default function NewSourcePage() {
  return (
    <>
      <BackLink href="/assistant">Back to the knowledge base</BackLink>
      <PageHeader ta="புதிய மூலம்" en="New source" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewSource />
      </Suspense>
    </>
  );
}

async function NewSource() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  if (!staff.permissions.has(KNOWLEDGE_PERMISSION)) {
    return <PageProblem locale={await getAdminLocale(staff.member.language)} message={KNOWLEDGE_REFUSED} />;
  }
  return (
    <div className="rounded-2xl border border-line bg-card shadow-card p-4 sm:p-6">
      <SourceForm current={{ reviewDue: defaultReviewDue(new Date()) }} />
    </div>
  );
}
