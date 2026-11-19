import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { BackLink, Section } from '@/components/PageSection';
import { KNOWLEDGE_PERMISSION, TRY_REFUSED } from '@/features/assistant/forms';
import { TryForm } from '@/features/assistant/TryForm';
import { APPROVE, MONITOR } from '@/features/ai-models/forms';
import { api } from '@/lib/api';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/**
 * Try a question against the approved sources with the configured model, in shadow mode too, before
 * members see it (15B.5). Knowledge Editors and the AI Governance Lead.
 */
export default function TryQuestionPage() {
  return (
    <>
      <BackLink href="/assistant">Back to the knowledge base</BackLink>
      <PageHeader ta="கேள்வியைச் சோதித்தல்" en="Try a question" />
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <TryQuestion />
      </Suspense>
    </>
  );
}

async function TryQuestion() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  if (![KNOWLEDGE_PERMISSION, MONITOR, APPROVE].some((permission) => staff.permissions.has(permission))) {
    return <PageProblem locale={await getAdminLocale(staff.member.language)} message={TRY_REFUSED} />;
  }
  return (
    <Section
      id="try"
      ta="உதவியாளரைச் சோதித்தல்"
      en="See how the assistant would answer"
      intro="Uses the approved sources and the model the server is set up to call, even while it is in shadow mode. The answer is shown only to you; the API logs it as a staff preview and keeps nothing else.">
      <TryForm />
    </Section>
  );
}
