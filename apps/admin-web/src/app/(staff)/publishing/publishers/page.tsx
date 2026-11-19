import { ApiError, type OfficialPublisher } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { registerPublisher, revokePublisher } from '@/features/publishing/actions';
import { PUBLISHER_FIELDS, REVOKE_FIELDS } from '@/features/publishing/fields';
import { OFFICIAL_TARGETS } from '@/features/publishing/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Registering publishers needs Tier 5 system configuration over the whole platform.';
const STATE_LABELS = {
  active: { ta: 'பதிவில் உள்ளார்', en: 'Registered' },
  revoked: { ta: 'மீளப்பெறப்பட்டது', en: 'Revoked' },
} as const;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * D30, FR-AUT-001: Tier 5 registers the approved publisher identities that may sign official
 * statements. The person must already hold content.sign_publish, and nobody registers themselves.
 */
export default function PublishersPage(props: PageProps<'/publishing/publishers'>) {
  return (
    <>
      <BackLink href="/publishing">Back to official publishing</BackLink>
      <PageHeader ta="அங்கீகரிக்கப்பட்ட வெளியீட்டாளர்கள்" en="Approved publishers" />
      <Suspense fallback={<ConsoleLoading rows={4} />}>
        <Publishers searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Publishers({ searchParams }: { searchParams: PageProps<'/publishing/publishers'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  let publishers: OfficialPublisher[];
  try {
    publishers = await (await staffApi()).listOfficialPublishers();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Official publishing" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The publisher list is not available." />;
  }
  const active = publishers.filter((publisher) => publisher.state === 'active');
  const revoked = publishers.filter((publisher) => publisher.state === 'revoked');

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <Section
        id="register"
        ta="வெளியீட்டாளரைப் பதிவுசெய்க"
        en="Register a publisher"
        intro="Only a registered publisher can sign. What they sign names them as shown here, so use a role or office rather than a personal name.">
        <SimpleForm id="register-form" action={registerPublisher} fields={PUBLISHER_FIELDS} submits={[{ label: 'Register publisher' }]} targets={OFFICIAL_TARGETS} />
      </Section>
      <Section id="active" ta="பதிவிலுள்ள வெளியீட்டாளர்கள்" en={`Registered publishers (${active.length})`} intro="Revoking stops them signing; what they signed before still verifies.">
        {active.length === 0 ? (
          <p className="text-sm text-muted">No one is registered yet, so nothing can be signed.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {active.map((publisher) => (
              <li key={publisher.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
                <PublisherSummary publisher={publisher} />
                <SimpleForm
                  id={`revoke-${publisher.id.slice(0, 8)}`}
                  action={revokePublisher}
                  hidden={{ publisherId: publisher.id }}
                  fields={REVOKE_FIELDS}
                  submits={[{ label: 'Revoke registration', tone: 'danger' }]}
                  targets={OFFICIAL_TARGETS}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {revoked.length > 0 ? (
        <Section id="revoked" ta="மீளப்பெறப்பட்ட பதிவுகள்" en={`Revoked registrations (${revoked.length})`}>
          <ul className="flex flex-col gap-3">
            {revoked.map((publisher) => (
              <li key={publisher.id} className="flex flex-col gap-1 rounded-lg border border-line p-3 text-sm">
                <PublisherSummary publisher={publisher} />
                <p className="text-xs text-muted">
                  Revoked {formatDateTime(publisher.revokedAt)}: {publisher.revokeReason}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function PublisherSummary({ publisher }: { publisher: OfficialPublisher }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-2">
        <BilingualTag label={STATE_LABELS[publisher.state]} tone={publisher.state === 'active' ? 'done' : 'neutral'} />
        <span lang="ta" className="font-semibold text-text">
          {publisher.nameTa}
        </span>
        <span className="text-muted">/ {publisher.nameEn}</span>
      </p>
      <p className="text-xs text-muted">
        {publisher.fullName} · <span className="font-mono">{publisher.memberCode}</span> · registered {formatDateTime(publisher.registeredAt)}
      </p>
    </>
  );
}
