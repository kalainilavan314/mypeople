import type { Place } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { DeclarePeriodForm } from '@/features/elections/DeclarePeriodForm';
import { api } from '@/lib/api';
import { en, getAdminLocale, getDictionary, ta } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const PERMISSION = 'election.mode.manage';

export default function DeclarePeriodPage() {
  return (
    <>
      <PageHeader ta={ta.elections.declareTitle} en={en.elections.declareTitle} />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <DeclareContent />
      </Suspense>
    </>
  );
}

async function DeclareContent() {
  // API_URL may be set only on the running server, so it is read when the request comes in,
  // never frozen into the page at build time.
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const words = getDictionary(locale).elections;
  if (!staff.permissions.has(PERMISSION)) return <PageProblem locale={locale} message={words.refused} />;

  // The district list only suggests codes in the area field; when it cannot be read, codes are
  // typed by hand and the API still checks every one ("unknown_area").
  let districts: Place[] = [];
  try {
    districts = await (await staffApi()).listDistricts();
  } catch {
    districts = [];
  }

  return (
    <>
      <Link
        href="/elections"
        className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span lang={locale}>← {words.backToList}</span>
      </Link>
      <div className="flex flex-col gap-1 text-sm text-muted">
        <p lang={locale}>{words.declareIntro}</p>
        <p lang={locale}>{words.noVoterData}</p>
      </div>
      <DeclarePeriodForm
        districts={districts.map((district) => ({
          code: district.code,
          name: (locale === 'ta' ? district.nameTa ?? district.nameEn : district.nameEn ?? district.nameTa) ?? district.code,
        }))}
      />
    </>
  );
}
