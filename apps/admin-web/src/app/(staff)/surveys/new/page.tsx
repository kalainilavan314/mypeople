import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { SurveyForm } from '@/features/surveys/SurveyForm';
import { api } from '@/lib/api';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function NewSurveyPage() {
  return (
    <>
      <Link href="/surveys" className={`inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline ${FOCUS}`}>
        ← Back to surveys
      </Link>
      <PageHeader ta="புதிய கருத்துக்கணிப்பு" en="New survey" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <NewSurvey />
      </Suspense>
    </>
  );
}

async function NewSurvey() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const areaOptions = await areaOptionsFor(staff.assignments, 'surveys.manage');
  return (
    <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
      <SurveyForm areaOptions={areaOptions} />
    </div>
  );
}
