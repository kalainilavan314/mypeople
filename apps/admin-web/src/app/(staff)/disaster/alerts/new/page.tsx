import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { PageHeader } from '@/components/PageHeader';
import { PageProblem } from '@/components/PageProblem';
import { Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { relayAlert } from '@/features/disaster/actions';
import { relayFields } from '@/features/disaster/alertFields';
import { DisasterNav } from '@/features/disaster/DisasterNav';
import { SAFETY_TARGETS } from '@/features/disaster/forms';
import { api } from '@/lib/api';
import { areaOptionsFor } from '@/lib/areas';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { requireStaff } from '@/lib/staff';

/** D26 alert composer: copy an official warning into the app for the areas it covers (FR-DIS-001, 002). */
export default function RelayAlertPage() {
  return (
    <>
      <PageHeader ta="அதிகாரபூர்வ எச்சரிக்கையை அனுப்புதல்" en="Relay an official alert" />
      <DisasterNav current="/disaster/alerts/new" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <Composer />
      </Suspense>
    </>
  );
}

async function Composer() {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  if (!staff.permissions.has('disaster.relay')) {
    return <PageProblem locale={locale} message="Relaying alerts needs the disaster relay permission (disaster.relay, PRM-53)." />;
  }
  const ownAreas = await areaOptionsFor(staff.assignments, 'disaster.relay');
  return (
    <Section
      id="relay"
      ta="எச்சரிக்கை விவரங்கள்"
      en="The official warning"
      intro="Only the Disaster Management Centre and the Department of Meteorology are accepted, with a link to the warning on their own website. Members of the targeted District, DS and GN divisions are told at once (unless they turned emergency notices off) and see it with the emergency numbers and the statement that the app sends no help. Check the source again at least every 6 hours.">
      <SimpleForm
        id="relay-alert"
        action={relayAlert}
        fields={relayFields(ownAreas)}
        submits={[{ label: 'Relay to members' }]}
        targets={SAFETY_TARGETS}
      />
    </Section>
  );
}
