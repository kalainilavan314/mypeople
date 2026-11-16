import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { IntakeForm } from '@/features/support/IntakeForm';
import { SupportNav } from '@/features/support/SupportNav';
import { api } from '@/lib/api';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

/** S11 on the web: a hotline call or partner referral (assistance.intake). */
export default function SupportIntakePage() {
  return (
    <>
      <PageHeader ta="உதவிக் கோரிக்கையைப் பதிவுசெய்தல்" en="Record a support request" />
      <SupportNav current="/support/new" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <Intake />
      </Suspense>
    </>
  );
}

async function Intake() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const areaOptions = await areaOptionsFor(staff.assignments, 'assistance.intake');
  // The partner list only fills the partner choice; a hotline call needs none.
  let partners: { id: string; name: string }[] = [];
  try {
    partners = (await (await staffApi()).listSupportPartners()).filter((partner) => partner.active).map(({ id, name }) => ({ id, name }));
  } catch {
    partners = [];
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-text">
        For danger to life, give the emergency numbers first: Police 119, Suwa Seriya ambulance 1990, Disaster Management Centre 117.
        Nobody needs to be a member to get help, and nothing about membership or politics is asked.
      </p>
      <div className="rounded-xl border border-line bg-card p-4 sm:p-6">
        <IntakeForm areaOptions={areaOptions} partners={partners} />
      </div>
    </div>
  );
}
