import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { BackLink } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { registerModel } from '@/features/ai-models/actions';
import { MODEL_FIELDS } from '@/features/ai-models/fields';
import { APPROVE, MODEL_TARGETS, MONITOR, REGISTRY_REFUSED } from '@/features/ai-models/forms';
import { api } from '@/lib/api';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/** D21, NFR-AI-01: register a model. It starts in shadow mode and is never shown to members until live. */
export default function RegisterModelPage() {
  return (
    <>
      <BackLink href="/ai-models">Back to the model registry</BackLink>
      <PageHeader ta="மாதிரியைப் பதிவுசெய்தல்" en="Register a model" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <RegisterModel />
      </Suspense>
    </>
  );
}

async function RegisterModel() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  if (!staff.permissions.has(MONITOR) && !staff.permissions.has(APPROVE)) {
    return <PageProblem locale={await getAdminLocale(staff.member.language)} message={REGISTRY_REFUSED} />;
  }
  return (
    <div className="rounded-2xl border border-line bg-card shadow-card p-4 sm:p-6">
      <SimpleForm
        id="register"
        action={registerModel}
        fields={MODEL_FIELDS}
        submits={[{ label: 'Register in shadow mode' }]}
        targets={MODEL_TARGETS}
      />
    </div>
  );
}
