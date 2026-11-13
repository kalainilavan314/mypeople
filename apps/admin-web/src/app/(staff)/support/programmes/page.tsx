import { ApiError, type SupportPartner, type SupportProgramme } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { Both, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { addPartner, createProgramme, publishCriteria, setProgrammeActive } from '@/features/support/actions';
import { CATEGORIES, CATEGORY_LABELS, PARTNER_KINDS, PARTNER_KIND_LABELS, SUPPORT_TARGETS } from '@/features/support/forms';
import { SupportNav } from '@/features/support/SupportNav';
import { api } from '@/lib/api';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Programmes and partners need the programme management permission (assistance.programme.manage).';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D14: assistance programmes with their published criteria versions, and the partner organisations. */
export default function SupportProgrammesPage(props: PageProps<'/support/programmes'>) {
  return (
    <>
      <PageHeader ta="உதவித் திட்டங்களும் பங்காளர்களும்" en="Support programmes and partners" />
      <SupportNav current="/support/programmes" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Programmes searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Programmes({ searchParams }: { searchParams: PageProps<'/support/programmes'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const client = await staffApi();
  let programmes: SupportProgramme[];
  let partners: SupportPartner[];
  try {
    [programmes, partners] = await Promise.all([client.listSupportProgrammes(), client.listSupportPartners()]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Community support" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="The programmes are not available." />;
  }
  const manager = staff.permissions.has('assistance.programme.manage');

  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      <Section id="programmes" ta="திட்டங்கள்" en={`Programmes (${programmes.length})`} intro="A decision cites the criteria version it used; publishing new criteria never changes decisions already made.">
        {programmes.length === 0 ? (
          <p className="text-sm text-muted">No programmes yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {programmes.map((programme) => (
              <li key={programme.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <BilingualTag label={programme.active ? { ta: 'செயலில் உள்ளது', en: 'Active' } : { ta: 'ஓய்வுபெற்றது', en: 'Retired' }} tone={programme.active ? 'done' : 'neutral'} />
                  <span className="text-xs text-muted">{programme.criteriaVersion ? `Criteria version ${programme.criteriaVersion}` : 'No criteria published yet'}</span>
                </div>
                <h3 className="flex flex-col font-semibold text-text">
                  <span lang="ta">{programme.nameTa}</span>
                  <span lang="en" className="text-sm font-medium text-muted">
                    {programme.nameEn}
                  </span>
                </h3>
                <Both ta={programme.descriptionTa} en={programme.descriptionEn} />
                <p className="text-xs text-muted">{programme.categories.map((category) => CATEGORY_LABELS[category].en).join(' · ')}</p>
                {programme.criteriaEn || programme.criteriaTa ? (
                  <details className="text-sm">
                    <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">Read the current criteria</summary>
                    <Both ta={programme.criteriaTa} en={programme.criteriaEn} />
                  </details>
                ) : null}
                {manager ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <SimpleForm
                      id={`criteria-${programme.id.slice(0, 8)}`}
                      title="Publish new criteria"
                      action={publishCriteria}
                      hidden={{ programmeId: programme.id }}
                      fields={[
                        { name: 'criteriaTa', label: 'Criteria in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 9000, rows: 5 },
                        { name: 'criteriaEn', label: 'Criteria in English', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 6000, rows: 5 },
                      ]}
                      submits={[{ label: 'Publish criteria version' }]}
                      targets={SUPPORT_TARGETS}
                    />
                    <SimpleForm
                      id={`active-${programme.id.slice(0, 8)}`}
                      title={programme.active ? 'Retire the programme' : 'Activate the programme'}
                      intro={programme.active ? 'New decisions can no longer use it.' : 'Decisions can use its current criteria again.'}
                      action={setProgrammeActive}
                      hidden={{ programmeId: programme.id, active: programme.active ? '0' : '1' }}
                      fields={[]}
                      submits={[{ label: programme.active ? 'Retire' : 'Activate', tone: programme.active ? 'danger' : 'primary' }]}
                      targets={SUPPORT_TARGETS}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {manager ? (
        <Section id="new-programme" ta="புதிய திட்டம்" en="New programme">
          <SimpleForm
            id="programme"
            action={createProgramme}
            fields={[
              { name: 'nameTa', label: 'Name in Tamil', lang: 'ta', required: true, minLength: 3, maxLength: 220 },
              { name: 'nameEn', label: 'Name in English', lang: 'en', required: true, minLength: 3, maxLength: 160 },
              { name: 'descriptionTa', label: 'Description in Tamil', kind: 'textarea', lang: 'ta', required: true, minLength: 10, maxLength: 4500 },
              { name: 'descriptionEn', label: 'Description in English', kind: 'textarea', lang: 'en', required: true, minLength: 10, maxLength: 3000 },
              {
                name: 'categories',
                label: 'Kinds of help it covers',
                kind: 'checks',
                required: true,
                options: CATEGORIES.map((category) => ({ value: category, label: `${CATEGORY_LABELS[category].ta} · ${CATEGORY_LABELS[category].en}` })),
              },
            ]}
            submits={[{ label: 'Create programme' }]}
            targets={SUPPORT_TARGETS}
          />
        </Section>
      ) : null}

      <Section id="partners" ta="பங்காளர் நிறுவனங்கள்" en={`Partner organisations (${partners.length})`} intro="A case is referred to a partner only with the applicant's consent.">
        {partners.length === 0 ? (
          <p className="text-sm text-muted">No partners yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {partners.map((partner) => (
              <li key={partner.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-col">
                  <span className="font-semibold text-text">{partner.name}</span>
                  <span className="text-xs text-muted">
                    {PARTNER_KIND_LABELS[partner.kind]?.en ?? partner.kind} · {partner.contact}
                  </span>
                </span>
                <BilingualTag label={partner.active ? { ta: 'செயலில் உள்ளது', en: 'Active' } : { ta: 'செயலற்றது', en: 'Inactive' }} tone={partner.active ? 'done' : 'neutral'} />
              </li>
            ))}
          </ul>
        )}
        {manager ? (
          <SimpleForm
            id="partner"
            action={addPartner}
            fields={[
              { name: 'name', label: 'Organisation name', required: true, minLength: 2, maxLength: 200 },
              { name: 'kind', label: 'Kind', kind: 'select', required: true, options: [{ value: '', label: 'Choose the kind' }, ...PARTNER_KINDS.map((kind) => ({ value: kind, label: `${PARTNER_KIND_LABELS[kind].ta} · ${PARTNER_KIND_LABELS[kind].en}` }))] },
              { name: 'contact', label: 'Office contact (not a personal number)', required: true, minLength: 3, maxLength: 300, wide: true },
            ]}
            submits={[{ label: 'Add partner', tone: 'secondary' }]}
            targets={SUPPORT_TARGETS}
          />
        ) : null}
      </Section>
    </div>
  );
}
